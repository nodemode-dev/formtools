import json
import os
import sys
from pathlib import Path

import pytest

from .support import put


def listed(client):
    return {item["name"]: item for item in client.get("/api/templates").json()["templates"]}


def test_the_templates_folder_offers_the_starter_items_folders_first(client):
    body = client.get("/api/templates").json()
    names = [item["name"] for item in body["templates"]]
    assert {"Text file.txt", "Markdown note.md", "Data.csv", "Config.json", "Project"} <= set(names)
    kinds = [item["kind"] for item in body["templates"]]
    assert kinds == sorted(kinds, key=lambda kind: kind != "folder")
    assert listed(client)["Project"]["kind"] == "folder"
    assert not any(name.startswith(".") for name in names)


def test_a_new_file_from_a_template_has_the_template_content(client, tmp_path):
    reply = client.post("/api/templates/create", json={"template": "Config.json", "folder": str(tmp_path)})
    assert reply.status_code == 200
    made = Path(reply.json()["path"])
    assert made == tmp_path / "Config.json"
    assert json.loads(made.read_text(encoding="utf-8")) == {}


def test_a_new_file_is_given_the_template_extension_when_the_name_has_none(client, tmp_path):
    made = Path(client.post("/api/templates/create", json={"template": "Markdown note.md", "folder": str(tmp_path), "name": "journal"}).json()["path"])
    assert made.name == "journal.md"
    assert made.read_text(encoding="utf-8") == "# Title\n\n"


def test_a_taken_name_gets_a_number_and_the_old_file_is_not_overwritten(client, tmp_path):
    put(tmp_path / "Data.csv", b"mine,precious\n")
    first = Path(client.post("/api/templates/create", json={"template": "Data.csv", "folder": str(tmp_path)}).json()["path"])
    second = Path(client.post("/api/templates/create", json={"template": "Data.csv", "folder": str(tmp_path)}).json()["path"])
    assert (tmp_path / "Data.csv").read_bytes() == b"mine,precious\n"
    assert first.name == "Data (2).csv"
    assert second.name == "Data (3).csv"
    assert first.read_text(encoding="utf-8") == "column1,column2\n"


def test_a_folder_template_is_copied_with_everything_in_it(client, tmp_path):
    made = Path(client.post("/api/templates/create", json={"template": "Project", "folder": str(tmp_path), "name": "Site"}).json()["path"])
    assert made == tmp_path / "Site"
    assert (made / "assets").is_dir() and (made / "exports").is_dir()
    assert (made / "README.md").read_text(encoding="utf-8") == "# Project\n\nWhat this project is for.\n"


def test_a_taken_folder_name_also_gets_a_number(client, tmp_path):
    (tmp_path / "Project").mkdir()
    made = Path(client.post("/api/templates/create", json={"template": "Project", "folder": str(tmp_path)}).json()["path"])
    assert made.name == "Project (2)"
    assert (tmp_path / "Project").is_dir() and list((tmp_path / "Project").iterdir()) == []


def test_an_unknown_template_is_refused(client, tmp_path):
    reply = client.post("/api/templates/create", json={"template": "Nothing here.txt", "folder": str(tmp_path)})
    assert reply.status_code == 404
    assert reply.json()["error"] == "there is no template with that name"


def test_a_destination_that_is_not_a_folder_is_refused(client, tmp_path):
    reply = client.post("/api/templates/create", json={"template": "Data.csv", "folder": str(tmp_path / "gone")})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the destination folder does not exist"


@pytest.mark.parametrize("name", ["../escape", "a/b", "a\\b", "..", "."])
def test_a_name_that_could_leave_the_folder_is_refused_and_nothing_is_created(client, tmp_path, name):
    target = tmp_path / "dest"
    target.mkdir()
    reply = client.post("/api/templates/create", json={"template": "Data.csv", "folder": str(target), "name": name})
    assert reply.status_code == 400
    assert reply.json()["error"] == "that name cannot be used for a file or folder"
    assert list(tmp_path.iterdir()) == [target] and list(target.iterdir()) == []


def test_a_template_name_that_climbs_out_of_the_templates_folder_is_refused(client, tmp_path):
    reply = client.post("/api/templates/create", json={"template": "../templates", "folder": str(tmp_path)})
    assert reply.status_code == 400


def test_the_template_tool_lists_and_an_outside_agent_is_not_let_create_without_consent(client, tmp_path):
    def call(name, arguments):
        reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": name, "arguments": arguments}})
        return reply.json()["result"]

    listing = json.loads(call("templates_list", {})["content"][0]["text"])
    assert "Data.csv" in {item["name"] for item in listing["templates"]}
    made = call("template_create", {"template": "Data.csv", "folder": str(tmp_path), "name": "report"})
    assert made["isError"] is True
    assert made["content"][0]["text"].startswith("formtools asks the person before an outside agent changes anything")
    assert list(tmp_path.iterdir()) == []


def test_files_held_open_name_this_process_as_the_holder(client, tmp_path):
    target = put(tmp_path / "held.bin", b"x")
    with open(target, "rb"):
        body = client.get("/api/files/locks", params={"path": str(target)}).json()
    if not body["supported"]:
        pytest.skip("this system does not let the process list be read")
    assert os.getpid() in {item["pid"] for item in body["holders"]}


def test_a_file_nobody_holds_has_no_holders(client, tmp_path):
    target = put(tmp_path / "free.bin", b"x")
    body = client.get("/api/files/locks", params={"path": str(target)}).json()
    assert os.getpid() not in {item["pid"] for item in body["holders"]}


def test_lock_lookup_of_a_missing_path_is_refused(client, tmp_path):
    reply = client.get("/api/files/locks", params={"path": str(tmp_path / "none")})
    assert reply.status_code == 404
    assert reply.json()["error"] == "that path does not exist"


def test_trashing_the_home_folder_is_refused_and_it_stays(client):
    home = str(Path.home())
    reply = client.post("/api/files/trash", json={"paths": [home]}).json()
    assert reply["trashed"] == 0
    assert reply["errors"] == [{"path": home, "error": "formtools will not trash a drive root or your home folder"}]
    assert Path(home).is_dir()


def test_trashing_a_drive_root_is_refused(client):
    root = os.path.abspath(os.sep)
    reply = client.post("/api/files/trash", json={"paths": [root]}).json()
    assert reply["trashed"] == 0
    assert reply["errors"][0]["error"] == "formtools will not trash a drive root or your home folder"


def test_trashing_a_path_that_does_not_exist_reports_it_and_touches_nothing(client, tmp_path):
    keep = put(tmp_path / "keep.txt", b"keep")
    gone = str(tmp_path / "gone.txt")
    reply = client.post("/api/files/trash", json={"paths": [gone]}).json()
    assert reply == {"trashed": 0, "errors": [{"path": gone, "error": "that path does not exist"}]}
    assert keep.read_bytes() == b"keep"


def test_a_relative_path_is_refused_per_path_and_the_others_are_still_judged(client, tmp_path):
    gone = str(tmp_path / "gone.txt")
    reply = client.post("/api/files/trash", json={"paths": ["rel/path.txt", gone]}).json()
    assert reply["trashed"] == 0
    assert reply["errors"] == [{"path": "rel/path.txt", "error": "the path must be absolute"}, {"path": gone, "error": "that path does not exist"}]


def test_trash_with_no_paths_is_refused(client):
    assert client.post("/api/files/trash", json={"paths": []}).status_code == 400


def test_more_than_five_thousand_paths_at_once_is_refused(client):
    reply = client.post("/api/files/trash", json={"paths": [f"/nope/{n}" for n in range(5001)]})
    assert reply.status_code == 400


def test_a_file_sent_to_the_trash_leaves_its_folder_and_is_recoverable_from_the_trash(client, tmp_path):
    import tempfile
    from urllib.parse import unquote

    share = Path(os.environ["XDG_DATA_HOME"])
    if sys.platform != "linux" or not str(share).startswith(tempfile.gettempdir()):
        pytest.skip("the trash is only exercised where it lies inside the temporary test sandbox")
    name = f"victim-{tmp_path.name}.txt"
    victim = put(tmp_path / "work" / name, b"recover me")
    reply = client.post("/api/files/trash", json={"paths": [str(victim)]}).json()
    kept = share / "Trash" / "files" / name
    info = share / "Trash" / "info" / f"{name}.trashinfo"
    try:
        assert reply == {"trashed": 1, "errors": []}
        assert not victim.exists()
        assert kept.read_bytes() == b"recover me"
        recorded = [line for line in info.read_text(encoding="utf-8").splitlines() if line.startswith("Path=")]
        assert [unquote(line[5:]) for line in recorded] == [str(victim)]
    finally:
        kept.unlink(missing_ok=True)
        info.unlink(missing_ok=True)
