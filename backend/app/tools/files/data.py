import csv
import itertools
import math
import sqlite3
from collections import Counter
from contextlib import closing
from pathlib import Path

from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.tools.files import text

csv.field_size_limit(1 << 24)

CANDIDATES = (",", ";", "\t", "|")
SQLITE_MAGIC = b"SQLite format 3\x00"
ROW_CEILING = 100000
SQL_CEILING = 5000


def is_number(value: str) -> bool:
    try:
        float(value.strip())
    except ValueError:
        return False
    return True


def pick_delimiter(sample: str, name: str) -> str:
    best = ","
    best_score = 0
    for candidate in CANDIDATES:
        rows = [row for row in itertools.islice(csv.reader(sample.splitlines(keepends=True), delimiter=candidate), 60) if row]
        if len(rows) > 1:
            rows = rows[:-1]
        widths = Counter(len(row) for row in rows)
        if not widths:
            continue
        width, count = widths.most_common(1)[0]
        score = count * 1000 + width if width > 1 else 0
        if candidate == "\t" and ext_of(name) == "tsv" and score:
            score += 10**6
        if score > best_score:
            best, best_score = candidate, score
    return best


def guess_header(rows: list[list[str]], sample: str, delimiter: str) -> bool:
    if len(rows) < 2:
        return False
    first = rows[0]
    if not first or any(not cell.strip() for cell in first) or len(set(first)) != len(first):
        return False
    if any(is_number(cell) for cell in first):
        return False
    for column in range(len(first)):
        values = [row[column] for row in rows[1:] if column < len(row) and row[column].strip()]
        if values and all(is_number(value) for value in values):
            return True
    try:
        return csv.Sniffer().has_header(sample)
    except csv.Error:
        return False


def read_csv(raw: str, limit: int = 5000) -> dict:
    path = text.readable(raw)
    limit = max(1, min(int(limit), ROW_CEILING))
    codec = text.stream_codec(path)
    try:
        with open(path, "r", encoding=codec, errors="replace", newline="") as handle:
            sample = handle.read(65536)
            handle.seek(0)
            delimiter = pick_delimiter(sample, path.name)
            reader = (row for row in csv.reader(handle, delimiter=delimiter) if row)
            head = list(itertools.islice(reader, 21))
            header = head[0] if head and guess_header(head, sample, delimiter) else None
            body = itertools.chain(head[1:] if header is not None else head, reader)
            rows = []
            total = 0
            for row in body:
                total += 1
                if len(rows) < limit:
                    rows.append(row)
    except csv.Error as exc:
        raise ApiError(400, f"that file is not valid delimited text ({str(exc)[:100]})")
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    return {"delimiter": delimiter, "header": header, "rows": rows, "total_rows": total, "truncated": total > len(rows)}


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def connect(raw: str) -> sqlite3.Connection:
    path = text.readable(raw)
    try:
        with open(path, "rb") as handle:
            head = handle.read(16)
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    if head != SQLITE_MAGIC:
        raise ApiError(415, "that file is not a SQLite database")
    try:
        conn = sqlite3.connect(Path(path).resolve().as_uri() + "?mode=ro", uri=True, timeout=2)
        conn.text_factory = lambda blob: blob.decode("utf-8", "replace")
        conn.execute("PRAGMA query_only=ON")
        return conn
    except sqlite3.Error as exc:
        raise ApiError(400, f"that database could not be opened read-only ({str(exc)[:100]})")


def catalogue(conn: sqlite3.Connection) -> list[tuple[str, str]]:
    cursor = conn.execute("SELECT name, type FROM sqlite_master WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\' ORDER BY type, name")
    return [(name, kind) for name, kind in cursor.fetchall()]


def count_rows(conn: sqlite3.Connection, name: str) -> int | None:
    try:
        return conn.execute(f"SELECT COUNT(*) FROM {quote(name)}").fetchone()[0]
    except sqlite3.Error:
        return None


def sqlite_tables(raw: str) -> dict:
    with closing(connect(raw)) as conn:
        try:
            tables = []
            for name, kind in catalogue(conn):
                columns = [
                    {"name": column, "type": declared or "", "pk": bool(pk)}
                    for column, declared, pk in conn.execute("SELECT name, type, pk FROM pragma_table_info(?)", (name,)).fetchall()
                ]
                tables.append({"name": name, "kind": kind, "rows": count_rows(conn, name), "columns": columns})
        except sqlite3.Error as exc:
            raise ApiError(400, f"that database could not be read ({str(exc)[:100]})")
    return {"tables": tables}


def cell(value):
    if isinstance(value, (bytes, bytearray, memoryview)):
        return {"blob": len(value)}
    if isinstance(value, float) and not math.isfinite(value):
        return str(value)
    return value


def sqlite_rows(raw: str, table: str, offset: int = 0, limit: int = 200) -> dict:
    offset = max(0, int(offset))
    limit = max(1, min(int(limit), SQL_CEILING))
    with closing(connect(raw)) as conn:
        try:
            known = {name for name, _ in catalogue(conn)}
            if table not in known:
                raise ApiError(404, "that table or view is not in the database")
            cursor = conn.execute(f"SELECT * FROM {quote(table)} LIMIT ? OFFSET ?", (limit, offset))
            columns = [item[0] for item in cursor.description or []]
            rows = [[cell(value) for value in row] for row in cursor.fetchall()]
            total = count_rows(conn, table)
        except sqlite3.Error as exc:
            raise ApiError(400, f"that table could not be read ({str(exc)[:100]})")
    return {"columns": columns, "rows": rows, "total": total if total is not None else offset + len(rows)}
