import pytest


def read(client, tmp_path, payload, name="f.txt", **params):
    target = tmp_path / name
    target.write_bytes(payload)
    reply = client.get("/api/text", params={"path": str(target), **params})
    assert reply.status_code == 200, reply.text
    return reply.json()


@pytest.mark.parametrize(
    "payload,eol,lines",
    [
        (b"a\nb\nc\n", "lf", 3),
        (b"a\nb\nc", "lf", 3),
        (b"a\r\nb\r\n", "crlf", 2),
        (b"a\r\nb\r\nc", "crlf", 3),
        (b"a\rb\rc\r", "cr", 3),
        (b"a\r\nb\nc", "mixed", 3),
        (b"a\rb\nc\r\n", "mixed", 3),
        (b"\n\n\n", "lf", 3),
        (b"one line no break", "lf", 1),
        (b"", "lf", 0),
    ],
)
def test_line_endings_and_line_counts_match_a_hand_count(client, tmp_path, payload, eol, lines):
    result = read(client, tmp_path, payload)
    assert (result["eol"], result["lines"]) == (eol, lines)


def test_plain_ascii_is_reported_as_utf8_without_a_bom(client, tmp_path):
    result = read(client, tmp_path, b"plain text\n")
    assert (result["encoding"], result["bom"], result["text"]) == ("utf-8", False, "plain text\n")


def test_a_utf8_byte_order_mark_is_reported_and_removed_from_the_text(client, tmp_path):
    result = read(client, tmp_path, b"\xef\xbb\xbfhi")
    assert (result["encoding"], result["bom"], result["text"]) == ("utf-8", True, "hi")


@pytest.mark.parametrize("codec,label", [("utf-16-le", "utf-16le"), ("utf-16-be", "utf-16be"), ("utf-32-le", "utf-32le"), ("utf-32-be", "utf-32be")])
def test_unicode_files_with_a_byte_order_mark_are_decoded_back_to_the_original_text(client, tmp_path, codec, label):
    import codecs

    marks = {"utf-16-le": codecs.BOM_UTF16_LE, "utf-16-be": codecs.BOM_UTF16_BE, "utf-32-le": codecs.BOM_UTF32_LE, "utf-32-be": codecs.BOM_UTF32_BE}
    original = "caf\u00e9 \u4e2d\u6587 \U0001f600\nline2\n"
    result = read(client, tmp_path, marks[codec] + original.encode(codec))
    assert (result["encoding"], result["bom"], result["text"], result["lines"]) == (label, True, original, 2)


def test_utf16_without_a_byte_order_mark_is_recognised_from_its_zero_bytes(client, tmp_path):
    result = read(client, tmp_path, "hello world\n".encode("utf-16-le"))
    assert (result["encoding"], result["bom"], result["text"]) == ("utf-16le", False, "hello world\n")
    result = read(client, tmp_path, "hello world\n".encode("utf-16-be"), name="g.txt")
    assert (result["encoding"], result["text"]) == ("utf-16be", "hello world\n")


def test_valid_multibyte_utf8_is_decoded_exactly(client, tmp_path):
    original = "na\u00efve \u00fcber \u65e5\u672c\u8a9e \U0001f680"
    result = read(client, tmp_path, original.encode("utf-8"))
    assert (result["encoding"], result["text"]) == ("utf-8", original)


def test_bytes_that_are_not_utf8_are_read_as_windows_1252(client, tmp_path):
    result = read(client, tmp_path, b"caf\xe9 \x80 \x93q\x94")
    assert result["encoding"] == "cp1252"
    assert result["text"] == "caf\u00e9 \u20ac \u201cq\u201d"


def test_a_file_cut_to_max_bytes_is_marked_truncated_and_returns_that_many_bytes(client, tmp_path):
    result = read(client, tmp_path, b"abcdefghij", max=4)
    assert (result["text"], result["truncated"]) == ("abcd", True)


def test_a_file_exactly_max_bytes_long_is_not_truncated(client, tmp_path):
    result = read(client, tmp_path, b"abcd", max=4)
    assert (result["text"], result["truncated"]) == ("abcd", False)


def test_cutting_in_the_middle_of_a_multibyte_character_drops_the_partial_character(client, tmp_path):
    result = read(client, tmp_path, "\u00e9\u00e9\u00e9".encode("utf-8"), max=3)
    assert (result["text"], result["truncated"], result["encoding"]) == ("\u00e9", True, "utf-8")


def test_the_returned_text_never_exceeds_max_bytes_after_encoding(client, tmp_path):
    result = read(client, tmp_path, ("\u4e2d" * 100).encode("utf-8"), max=50)
    assert len(result["text"].encode("utf-8")) <= 50
    assert result["text"] == "\u4e2d" * 16


def test_max_below_one_is_refused(client, tmp_path):
    target = tmp_path / "f.txt"
    target.write_bytes(b"x")
    reply = client.get("/api/text", params={"path": str(target), "max": 0})
    assert (reply.status_code, reply.json()["error"]) == (400, "max must be at least 1 byte")


def test_reading_a_missing_file_is_refused(client, tmp_path):
    reply = client.get("/api/text", params={"path": str(tmp_path / "ghost.txt")})
    assert (reply.status_code, reply.json()["error"]) == (404, "that file does not exist")


def test_reading_a_folder_as_text_is_refused(client, tmp_path):
    reply = client.get("/api/text", params={"path": str(tmp_path)})
    assert (reply.status_code, reply.json()["error"]) == (400, "that path is not a file")


def test_reading_a_relative_path_is_refused(client):
    reply = client.get("/api/text", params={"path": "rel/f.txt"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the path must be absolute")


@pytest.mark.parametrize(
    "name,language",
    [("a.py", "python"), ("b.js", "javascript"), ("c.ts", "typescript"), ("d.json", "json"), ("e.yml", "yaml"), ("f.md", "markdown"), ("g.rs", "rust"), ("Dockerfile", "dockerfile"), ("Makefile", "makefile"), ("h.sh", "bash"), ("noext", None), ("x.zzz", None)],
)
def test_the_highlight_language_follows_the_file_name(client, tmp_path, name, language):
    assert read(client, tmp_path, b"x", name=name)["language"] == language


def test_a_text_file_read_through_the_mcp_tool_matches_the_route(client, tmp_path):
    target = tmp_path / "m.txt"
    target.write_bytes(b"one\r\ntwo\r\n")
    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "text_read", "arguments": {"path": str(target)}}}).json()
    assert "error" not in reply
    body = str(reply["result"])
    assert "crlf" in body and "one" in body
