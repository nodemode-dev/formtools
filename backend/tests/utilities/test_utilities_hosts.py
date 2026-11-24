import hashlib
import os
import re
from ipaddress import ip_address

import pytest

from .support import hosts_file  # noqa: F401

SAMPLE = (
    "# Host database\n"
    "127.0.0.1\tlocalhost\n"
    "::1   localhost ip6-localhost  # loopback v6\n"
    "\n"
    "#192.168.1.5 printer.lan\n"
    "10.0.0.2    db.internal  cache.internal\n"
    "# just a remark about 10.0.0.9\n"
    "not an entry at all\n"
)


def independent_entries(text):
    found = []
    for number, line in enumerate(text.splitlines(), start=1):
        body = line.strip()
        enabled = True
        if body.startswith("#"):
            enabled = False
            body = body[1:].strip()
        code, _, comment = body.partition("#")
        parts = code.split()
        if len(parts) < 2:
            continue
        try:
            ip_address(parts[0])
        except ValueError:
            continue
        if not all(re.fullmatch(r"[A-Za-z0-9.-]+", name) for name in parts[1:]):
            continue
        found.append((number, enabled, parts[0], parts[1:], comment.strip()))
    return found


def entry(row):
    return {"line": row["line"], "enabled": row["enabled"], "address": row["address"], "names": row["names"], "comment": row["comment"]}


def test_a_hosts_file_is_parsed_into_the_entries_the_format_defines(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    body = client.get("/api/hosts").json()
    got = [(e["line"], e["enabled"], e["address"], e["names"], e["comment"]) for e in body["entries"]]
    assert got == independent_entries(SAMPLE)
    assert got[0] == (2, True, "127.0.0.1", ["localhost"], "")
    assert got[1] == (3, True, "::1", ["localhost", "ip6-localhost"], "loopback v6")
    assert got[2] == (5, False, "192.168.1.5", ["printer.lan"], "")
    assert got[3][3] == ["db.internal", "cache.internal"]


def test_read_returns_the_raw_text_the_path_and_a_content_version(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    body = client.get("/api/hosts").json()
    assert body["raw"] == SAMPLE
    assert body["path"] == str(hosts_file)
    assert body["version"] == hashlib.sha256(SAMPLE.encode()).hexdigest()
    assert body["writable"] is True


def test_remarks_and_junk_lines_are_not_entries(client, hosts_file):
    hosts_file.write_text("# comment only\nnot an entry\n999.1.1.1 badaddr\n1.2.3.4 -bad-.name\n1.2.3.4\n", encoding="utf-8")
    assert client.get("/api/hosts").json()["entries"] == []


def test_a_missing_hosts_file_reads_as_empty(client, hosts_file):
    body = client.get("/api/hosts").json()
    assert body["entries"] == [] and body["raw"] == ""


def test_saving_the_entries_unchanged_writes_nothing_and_makes_no_backup(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    rows = client.get("/api/hosts").json()["entries"]
    reply = client.post("/api/hosts", json={"entries": [entry(r) for r in rows]}).json()
    assert reply == {"ok": True, "backup": None, "elevated": False, "changed": False}
    assert hosts_file.read_text(encoding="utf-8") == SAMPLE


def test_editing_one_entry_changes_only_that_line(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[3]["names"] = ["db.internal", "replica.internal"]
    reply = client.post("/api/hosts", json={"entries": rows}).json()
    assert reply["ok"] is True and reply["changed"] is True
    lines = hosts_file.read_text(encoding="utf-8").split("\n")
    old = SAMPLE.split("\n")
    assert lines[5] == "10.0.0.2\tdb.internal replica.internal"
    assert [line for i, line in enumerate(lines) if i != 5] == [line for i, line in enumerate(old) if i != 5]


def test_a_saved_file_is_read_back_as_the_same_entries(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[1]["comment"] = "changed note"
    rows[2]["enabled"] = True
    client.post("/api/hosts", json={"entries": rows})
    back = client.get("/api/hosts").json()["entries"]
    assert back[1]["comment"] == "changed note"
    assert back[2]["enabled"] is True
    assert [(e["address"], e["names"]) for e in back] == [(r["address"], r["names"]) for r in rows]
    assert [(n, en, a, nm, c) for n, en, a, nm, c in independent_entries(hosts_file.read_text(encoding="utf-8"))] == [(e["line"], e["enabled"], e["address"], e["names"], e["comment"]) for e in back]


def test_a_disabled_entry_is_written_as_a_commented_out_line(client, hosts_file):
    hosts_file.write_text("127.0.0.1\tlocalhost\n10.1.1.1\tnas.lan\n", encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[1]["enabled"] = False
    client.post("/api/hosts", json={"entries": rows})
    assert hosts_file.read_text(encoding="utf-8") == "127.0.0.1\tlocalhost\n# 10.1.1.1\tnas.lan\n"


def test_a_new_entry_is_appended_on_its_own_line(client, hosts_file):
    hosts_file.write_text("127.0.0.1\tlocalhost", encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows.append({"address": "10.9.9.9", "names": ["new.example"], "comment": "added", "enabled": True})
    client.post("/api/hosts", json={"entries": rows})
    assert hosts_file.read_text(encoding="utf-8") == "127.0.0.1\tlocalhost\n10.9.9.9\tnew.example  # added\n"


def test_an_entry_left_out_of_the_save_is_removed_and_everything_else_is_kept(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    client.post("/api/hosts", json={"entries": rows[:1] + rows[2:]})
    assert hosts_file.read_text(encoding="utf-8") == SAMPLE.replace("::1   localhost ip6-localhost  # loopback v6\n", "")


def test_windows_line_endings_survive_an_edit(client, hosts_file):
    original = "127.0.0.1\tlocalhost\r\n# keep me\r\n10.0.0.2\tapp.lan\r\n"
    hosts_file.write_bytes(original.encode())
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[1]["address"] = "10.0.0.3"
    rows.append({"address": "10.0.0.4", "names": ["x.lan"], "enabled": True})
    client.post("/api/hosts", json={"entries": rows})
    assert hosts_file.read_bytes() == b"127.0.0.1\tlocalhost\r\n# keep me\r\n10.0.0.3\tapp.lan\r\n10.0.0.4\tx.lan\r\n"


def test_a_byte_order_mark_is_kept(client, hosts_file):
    hosts_file.write_bytes(b"\xef\xbb\xbf127.0.0.1\tlocalhost\n")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[0]["names"] = ["localhost", "home"]
    client.post("/api/hosts", json={"entries": rows})
    assert hosts_file.read_bytes() == b"\xef\xbb\xbf127.0.0.1\tlocalhost home\n"


def test_an_indented_entry_keeps_its_indentation_when_edited(client, hosts_file):
    hosts_file.write_text("    10.0.0.1\told.lan\n", encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[0]["names"] = ["new.lan"]
    client.post("/api/hosts", json={"entries": rows})
    assert hosts_file.read_text(encoding="utf-8") == "    10.0.0.1\tnew.lan\n"


def test_a_backup_of_the_old_content_is_made_before_a_change(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    rows = [entry(r) for r in client.get("/api/hosts").json()["entries"]]
    rows[0]["names"] = ["localhost", "me"]
    reply = client.post("/api/hosts", json={"entries": rows}).json()
    assert os.path.isfile(reply["backup"])
    assert open(reply["backup"], encoding="utf-8").read() == SAMPLE


def test_a_save_with_an_old_version_is_refused_and_leaves_the_file_alone(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    body = client.get("/api/hosts").json()
    hosts_file.write_text(SAMPLE + "10.5.5.5\tlate.lan\n", encoding="utf-8")
    reply = client.post("/api/hosts", json={"entries": [entry(r) for r in body["entries"]], "version": body["version"]})
    assert reply.status_code == 409
    assert reply.json()["error"] == "the hosts file changed since it was read; reload it and try again"
    assert hosts_file.read_text(encoding="utf-8") == SAMPLE + "10.5.5.5\tlate.lan\n"


def test_a_save_with_the_current_version_goes_through(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    body = client.get("/api/hosts").json()
    rows = [entry(r) for r in body["entries"]]
    rows[0]["comment"] = "me"
    assert client.post("/api/hosts", json={"entries": rows, "version": body["version"]}).json()["changed"] is True


@pytest.mark.parametrize(
    "bad,message",
    [
        ({"address": "300.1.1.1", "names": ["a.lan"]}, "300.1.1.1 is not a valid IPv4 or IPv6 address"),
        ({"address": "", "names": ["a.lan"]}, "an empty value is not a valid IPv4 or IPv6 address"),
        ({"address": "10.0.0.1", "names": []}, "the entry for 10.0.0.1 needs at least one host name"),
        ({"address": "10.0.0.1", "names": ["bad_name"]}, "bad_name is not a valid host name"),
        ({"address": "10.0.0.1", "names": ["-lead.lan"]}, "-lead.lan is not a valid host name"),
        ({"address": "10.0.0.1", "names": ["a.lan"], "comment": "two\nlines"}, "a comment must stay on one line"),
    ],
)
def test_an_invalid_entry_is_refused_with_a_message_and_nothing_is_written(client, hosts_file, bad, message):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    reply = client.post("/api/hosts", json={"entries": [bad]})
    assert reply.status_code == 400
    assert reply.json()["error"] == message
    assert hosts_file.read_text(encoding="utf-8") == SAMPLE


def test_an_entry_pointing_at_a_line_that_is_not_an_entry_is_refused_as_stale(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    reply = client.post("/api/hosts", json={"entries": [{"line": 1, "address": "10.0.0.1", "names": ["a.lan"]}]})
    assert reply.status_code == 400
    assert hosts_file.read_text(encoding="utf-8") == SAMPLE


def test_the_same_line_twice_in_one_save_is_refused(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    one = entry(client.get("/api/hosts").json()["entries"][0])
    reply = client.post("/api/hosts", json={"entries": [one, one]})
    assert reply.status_code == 400
    assert reply.json()["error"] == "line 2 appears twice in the request"


def test_ipv6_addresses_and_several_names_are_accepted(client, hosts_file):
    reply = client.post("/api/hosts", json={"entries": [{"address": "fe80::1", "names": ["a.lan b.lan"], "enabled": True}]})
    assert reply.json()["ok"] is True
    assert hosts_file.read_text(encoding="utf-8") == "fe80::1\ta.lan b.lan\n"


def test_the_hosts_tool_reads_the_same_entries_as_the_route(client, hosts_file):
    hosts_file.write_text(SAMPLE, encoding="utf-8")
    import json

    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "hosts_read", "arguments": {}}})
    body = json.loads(reply.json()["result"]["content"][0]["text"])
    assert body["entries"] == client.get("/api/hosts").json()["entries"]
    assert body["raw"] == SAMPLE
