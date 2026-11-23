import csv
import hashlib
import io
import sqlite3

import pytest


def csv_of(client, tmp_path, payload, name="d.csv", **params):
    target = tmp_path / name
    target.write_bytes(payload if isinstance(payload, bytes) else payload.encode("utf-8"))
    reply = client.get("/api/data/csv", params={"path": str(target), **params})
    assert reply.status_code == 200, reply.text
    return reply.json()


@pytest.mark.parametrize("delimiter", [",", ";", "\t", "|"])
def test_each_common_delimiter_is_detected_and_the_cells_split_correctly(client, tmp_path, delimiter):
    text = "".join(delimiter.join(row) + "\n" for row in [["name", "qty", "note"], ["apple", "3", "red"], ["pear", "5", "green"]])
    result = csv_of(client, tmp_path, text)
    assert result["delimiter"] == delimiter
    assert result["header"] == ["name", "qty", "note"]
    assert result["rows"] == [["apple", "3", "red"], ["pear", "5", "green"]]
    assert result["total_rows"] == 2 and result["truncated"] is False


def test_a_quoted_cell_with_a_comma_a_quote_and_a_line_break_stays_one_cell(client, tmp_path):
    text = 'id,text\n1,"a, b ""quoted""\nsecond line"\n2,plain\n'
    result = csv_of(client, tmp_path, text)
    assert result["rows"] == [["1", 'a, b "quoted"\nsecond line'], ["2", "plain"]]


def test_a_first_row_of_numbers_is_data_not_a_header(client, tmp_path):
    result = csv_of(client, tmp_path, "1,2,3\n4,5,6\n7,8,9\n")
    assert result["header"] is None
    assert result["total_rows"] == 3


def test_text_header_over_numeric_columns_is_taken_as_header(client, tmp_path):
    result = csv_of(client, tmp_path, "x,y\n1,2\n3,4\n")
    assert result["header"] == ["x", "y"] and result["total_rows"] == 2


def test_a_tsv_file_is_read_as_tab_separated(client, tmp_path):
    result = csv_of(client, tmp_path, "a\tb\n1\t2\n", name="d.tsv")
    assert result["delimiter"] == "\t"


def test_blank_lines_are_skipped(client, tmp_path):
    result = csv_of(client, tmp_path, "h1,h2\n\n1,2\n\n\n3,4\n")
    assert result["rows"] == [["1", "2"], ["3", "4"]]


def test_a_utf8_byte_order_mark_does_not_end_up_in_the_first_header_cell(client, tmp_path):
    result = csv_of(client, tmp_path, b"\xef\xbb\xbfname,qty\nx,1\ny,2\n")
    assert result["header"] == ["name", "qty"]


def test_a_utf16_csv_is_decoded(client, tmp_path):
    payload = b"\xff\xfe" + "name,qty\nna\u00efve,1\nb,2\n".encode("utf-16-le")
    result = csv_of(client, tmp_path, payload)
    assert result["header"] == ["name", "qty"] and result["rows"][0] == ["na\u00efve", "1"]


def test_the_row_limit_truncates_but_the_total_counts_every_row(client, tmp_path):
    text = "n,v\n" + "".join(f"r{i},{i}\n" for i in range(50))
    result = csv_of(client, tmp_path, text, limit=10)
    assert (len(result["rows"]), result["total_rows"], result["truncated"]) == (10, 50, True)
    assert result["rows"][0] == ["r0", "0"] and result["rows"][9] == ["r9", "9"]


def test_rows_written_by_the_standard_csv_writer_come_back_identical(client, tmp_path):
    rows = [["1", "he said \"hi\", twice", "line\nbreak"], ["2", "", "tab\there"], ["3", "caf\u00e9", ";semi"], ["4", " padded ", "x"]]
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer)
    writer.writerow(["id", "text", "other"])
    writer.writerows(rows)
    result = csv_of(client, tmp_path, buffer.getvalue())
    assert result["header"] == ["id", "text", "other"]
    assert result["rows"] == rows


def test_csv_of_a_missing_file_is_refused(client, tmp_path):
    reply = client.get("/api/data/csv", params={"path": str(tmp_path / "ghost.csv")})
    assert (reply.status_code, reply.json()["error"]) == (404, "that file does not exist")


def make_db(path):
    conn = sqlite3.connect(path)
    conn.executescript(
        '''
        create table people (id integer primary key, name text not null, score real, photo blob);
        insert into people values (1, 'Ada', 9.5, x'0102030405');
        insert into people values (2, 'Grace "G"', null, null);
        insert into people values (3, 'Linus', 1e999, null);
        create table "odd ""name""" (a, b);
        insert into "odd ""name""" values (1, 'x');
        create view top as select name from people where id < 3;
        '''
    )
    conn.commit()
    conn.close()
    return path


def test_sqlite_tables_and_views_are_listed_with_columns_row_counts_and_primary_keys(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    reply = client.get("/api/data/sqlite/tables", params={"path": str(db)}).json()
    by_name = {t["name"]: t for t in reply["tables"]}
    assert set(by_name) == {"people", 'odd "name"', "top"}
    people = by_name["people"]
    assert (people["kind"], people["rows"]) == ("table", 3)
    assert [(c["name"], c["type"], c["pk"]) for c in people["columns"]] == [("id", "INTEGER", True), ("name", "TEXT", False), ("score", "REAL", False), ("photo", "BLOB", False)]
    assert (by_name["top"]["kind"], by_name["top"]["rows"]) == ("view", 2)
    assert by_name['odd "name"']["rows"] == 1


def test_sqlite_rows_come_back_with_blobs_as_sizes_nulls_as_none_and_infinity_as_text(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": "people"}).json()
    assert reply["columns"] == ["id", "name", "score", "photo"]
    assert reply["rows"] == [[1, "Ada", 9.5, {"blob": 5}], [2, 'Grace "G"', None, None], [3, "Linus", "inf", None]]
    assert reply["total"] == 3


def test_sqlite_paging_with_offset_and_limit_returns_the_right_slice(client, tmp_path):
    db = tmp_path / "p.db"
    conn = sqlite3.connect(db)
    conn.execute("create table n (v integer)")
    conn.executemany("insert into n values (?)", [(i,) for i in range(100)])
    conn.commit()
    conn.close()
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": "n", "offset": 40, "limit": 5}).json()
    assert reply["rows"] == [[40], [41], [42], [43], [44]] and reply["total"] == 100


def test_a_table_name_with_quotes_can_be_read(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": 'odd "name"'}).json()
    assert reply["rows"] == [[1, "x"]]


def test_an_unknown_table_is_refused(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": "missing"})
    assert (reply.status_code, reply.json()["error"]) == (404, "that table or view is not in the database")


def test_a_table_name_that_is_an_sql_injection_is_not_run(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": 'people"; drop table people; --'})
    assert reply.status_code == 404
    conn = sqlite3.connect(db)
    assert conn.execute("select count(*) from people").fetchone() == (3,)
    conn.close()


def test_reading_a_database_does_not_change_the_file(client, tmp_path):
    db = make_db(tmp_path / "t.db")
    before = hashlib.sha256(db.read_bytes()).hexdigest()
    client.get("/api/data/sqlite/tables", params={"path": str(db)})
    client.get("/api/data/sqlite/rows", params={"path": str(db), "table": "people"})
    assert hashlib.sha256(db.read_bytes()).hexdigest() == before
    assert sorted(p.name for p in tmp_path.iterdir()) == ["t.db"]


def test_a_file_that_is_not_a_database_is_refused(client, tmp_path):
    target = tmp_path / "fake.db"
    target.write_bytes(b"this is not sqlite at all, just text")
    reply = client.get("/api/data/sqlite/tables", params={"path": str(target)})
    assert (reply.status_code, reply.json()["error"]) == (415, "that file is not a SQLite database")


def test_text_stored_in_a_database_that_is_not_valid_utf8_is_shown_with_replacement_marks(client, tmp_path):
    db = tmp_path / "b.db"
    conn = sqlite3.connect(db)
    conn.text_factory = bytes
    conn.execute("create table t (s text)")
    conn.execute("insert into t values (cast(x'61ff62' as text))")
    conn.commit()
    conn.close()
    reply = client.get("/api/data/sqlite/rows", params={"path": str(db), "table": "t"}).json()
    assert reply["rows"] == [["a\ufffdb"]]
