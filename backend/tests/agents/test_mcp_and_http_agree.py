import hashlib
import threading

import pytest

from .support import as_json, call


@pytest.fixture
def folder(tmp_path):
    (tmp_path / "b10.txt").write_text("ten", encoding="utf-8")
    (tmp_path / "b2.txt").write_text("two!", encoding="utf-8")
    (tmp_path / "zeta").mkdir()
    (tmp_path / ".hidden").write_text("h", encoding="utf-8")
    return tmp_path


def test_fs_list_gives_the_same_folder_through_mcp_and_through_http(client, folder):
    failed, text = call(client, "fs_list", {"path": str(folder)})
    assert failed is False
    assert as_json(text) == client.get("/api/fs/list", params={"path": str(folder)}).json()


def test_fs_list_reports_what_is_on_disk_folders_first_and_numbers_in_counting_order(client, folder):
    listing = as_json(call(client, "fs_list", {"path": str(folder)})[1])
    assert [e["name"] for e in listing["entries"]] == ["zeta", "b2.txt", "b10.txt"]
    sizes = {e["name"]: e["size"] for e in listing["entries"]}
    assert sizes["b2.txt"] == 4 and sizes["b10.txt"] == 3
    assert listing["parent"] == str(folder.parent)


def test_fs_list_hidden_flag_agrees_on_both_paths(client, folder):
    by_mcp = as_json(call(client, "fs_list", {"path": str(folder), "hidden": True})[1])
    by_http = client.get("/api/fs/list", params={"path": str(folder), "hidden": 1}).json()
    assert by_mcp == by_http
    assert ".hidden" in [e["name"] for e in by_mcp["entries"]]


@pytest.mark.parametrize("make", ["missing", "file", "relative"])
def test_fs_list_refuses_with_the_same_words_on_both_paths(client, folder, make):
    path = {"missing": str(folder / "nowhere"), "file": str(folder / "b2.txt"), "relative": "some/folder"}[make]
    failed, text = call(client, "fs_list", {"path": path})
    response = client.get("/api/fs/list", params={"path": path})
    assert failed is True
    assert response.status_code >= 400
    assert response.json() == {"ok": False, "error": text}


def test_batch_actions_is_the_same_catalogue_on_both_paths(client):
    failed, text = call(client, "batch_actions")
    assert failed is False
    assert as_json(text) == client.get("/api/batch/actions").json()


def test_templates_list_is_the_same_on_both_paths(client):
    failed, text = call(client, "templates_list")
    assert failed is False
    assert as_json(text) == client.get("/api/templates").json()


def test_hosts_read_is_the_same_on_both_paths(client):
    failed, text = call(client, "hosts_read")
    assert failed is False
    assert as_json(text) == client.get("/api/hosts").json()


def test_text_read_returns_the_file_text_on_both_paths(client, tmp_path):
    target = tmp_path / "note.txt"
    target.write_text("first line\nsecond line\n", encoding="utf-8")
    failed, text = call(client, "text_read", {"path": str(target)})
    assert failed is False
    by_http = client.get("/api/text", params={"path": str(target)}).json()
    assert as_json(text) == by_http
    assert "first line\nsecond line\n" in by_http.values()


def test_list_commands_names_each_registered_command_once_and_describe_agrees(client, no_catalogue):
    listing = as_json(call(client, "list_commands")[1])
    ids = [c["id"] for c in listing["commands"]]
    assert ids and len(ids) == len(set(ids))
    assert "hint" in listing
    for item in listing["commands"]:
        described = as_json(call(client, "describe_command", {"id": item["id"]})[1])
        assert {k: described[k] for k in ("id", "title", "description")} == item
        assert described["params"]["type"] == "object"


def test_describe_command_refuses_an_unknown_id_and_points_at_list_commands(client, no_catalogue):
    failed, text = call(client, "describe_command", {"id": "no.such-command"})
    assert failed is True
    assert "list_commands" in text


def test_hash_files_then_job_status_give_the_digest_computed_here(client, tmp_path):
    target = tmp_path / "data.bin"
    target.write_bytes(bytes(range(256)) * 3)
    failed, text = call(client, "hash_files", {"paths": [str(target)], "algorithms": ["sha256"]})
    assert failed is False
    job = as_json(text)
    for _ in range(200):
        if job["state"] not in ("queued", "running"):
            break
        threading.Event().wait(0.02)
        job = as_json(call(client, "job_status", {"id": job["id"]})[1])
    item = job["result"]["items"][0]
    assert item["size"] == 768
    assert item["hashes"] == {"sha256": hashlib.sha256(target.read_bytes()).hexdigest()}
