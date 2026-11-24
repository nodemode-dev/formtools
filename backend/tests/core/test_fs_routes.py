import pytest


@pytest.fixture
def tree(tmp_path):
    root = tmp_path / "shoot"
    root.mkdir()
    (root / "frame10.png").write_bytes(b"\x89PNG\r\n\x1a\n" + b"x" * 7)
    (root / "frame2.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    (root / "Frame1.png").write_bytes(b"abc")
    (root / "notes.md").write_text("# hello\n", encoding="utf-8")
    (root / "clip.MOV").write_bytes(b"\x00" * 12)
    (root / ".secret").write_text("hidden", encoding="utf-8")
    (root / "zeta").mkdir()
    (root / "alpha").mkdir()
    (root / "alpha" / "inner").mkdir()
    (root / ".cache").mkdir()
    (root / ".cache" / "deep").mkdir()
    return root


def names(reply):
    return [entry["name"] for entry in reply["entries"]]


def test_listing_puts_folders_first_then_files_in_natural_number_order(client, tree):
    reply = client.get("/api/fs/list", params={"path": str(tree)}).json()
    assert names(reply) == ["alpha", "zeta", "clip.MOV", "Frame1.png", "frame2.png", "frame10.png", "notes.md"]


def test_listing_hides_dot_files_unless_hidden_is_asked_for(client, tree):
    plain = names(client.get("/api/fs/list", params={"path": str(tree)}).json())
    shown = names(client.get("/api/fs/list", params={"path": str(tree), "hidden": 1}).json())
    assert ".secret" not in plain and ".cache" not in plain
    assert set(shown) - set(plain) == {".secret", ".cache"}


def test_listing_reports_each_file_size_in_bytes_written(client, tree):
    entries = {e["name"]: e for e in client.get("/api/fs/list", params={"path": str(tree)}).json()["entries"]}
    assert entries["frame10.png"]["size"] == 15
    assert entries["Frame1.png"]["size"] == 3
    assert entries["notes.md"]["size"] == len("# hello\n")
    assert entries["alpha"]["size"] == 0


def test_listing_names_kind_extension_and_family_of_each_entry(client, tree):
    entries = {e["name"]: e for e in client.get("/api/fs/list", params={"path": str(tree)}).json()["entries"]}
    assert (entries["clip.MOV"]["kind"], entries["clip.MOV"]["ext"], entries["clip.MOV"]["type"]) == ("file", "mov", "video")
    assert (entries["notes.md"]["ext"], entries["notes.md"]["type"]) == ("md", "text")
    assert (entries["frame2.png"]["ext"], entries["frame2.png"]["type"]) == ("png", "image")
    assert (entries["alpha"]["kind"], entries["alpha"]["ext"]) == ("dir", "")


def test_listing_gives_each_entry_its_full_path_inside_the_folder(client, tree):
    reply = client.get("/api/fs/list", params={"path": str(tree)}).json()
    assert reply["path"] == str(tree)
    assert reply["parent"] == str(tree.parent)
    assert all(entry["path"] == str(tree / entry["name"]) for entry in reply["entries"])


def test_listing_the_filesystem_root_has_no_parent(client):
    assert client.get("/api/fs/list", params={"path": "/"}).json()["parent"] is None


def test_folder_tree_lists_only_folders_and_says_which_have_subfolders(client, tree):
    reply = client.get("/api/fs/dirs", params={"path": str(tree)}).json()
    assert [(d["name"], d["has_children"]) for d in reply["dirs"]] == [("alpha", True), ("zeta", False)]


def test_folder_tree_shows_hidden_folders_only_when_asked(client, tree):
    reply = client.get("/api/fs/dirs", params={"path": str(tree), "hidden": 1}).json()
    assert [(d["name"], d["has_children"]) for d in reply["dirs"]] == [(".cache", True), ("alpha", True), ("zeta", False)]


def test_folder_tree_hides_a_hidden_grandchild_when_judging_has_children(client, tmp_path):
    (tmp_path / "outer" / ".only-hidden").mkdir(parents=True)
    plain = client.get("/api/fs/dirs", params={"path": str(tmp_path)}).json()["dirs"]
    shown = client.get("/api/fs/dirs", params={"path": str(tmp_path), "hidden": 1}).json()["dirs"]
    assert plain == [{"name": "outer", "path": str(tmp_path / "outer"), "has_children": False}]
    assert shown[0]["has_children"] is True


@pytest.mark.parametrize("route", ["/api/fs/list", "/api/fs/dirs"])
def test_folder_routes_refuse_a_relative_path_with_a_sentence(client, route):
    reply = client.get(route, params={"path": "relative/place"})
    assert (reply.status_code, reply.json()) == (400, {"ok": False, "error": "the path must be absolute"})


@pytest.mark.parametrize("route", ["/api/fs/list", "/api/fs/dirs"])
def test_folder_routes_say_a_missing_folder_does_not_exist(client, tmp_path, route):
    reply = client.get(route, params={"path": str(tmp_path / "gone")})
    assert (reply.status_code, reply.json()) == (404, {"ok": False, "error": "that folder does not exist"})


@pytest.mark.parametrize("route", ["/api/fs/list", "/api/fs/dirs"])
def test_folder_routes_refuse_a_file_given_as_a_folder(client, tree, route):
    reply = client.get(route, params={"path": str(tree / "notes.md")})
    assert (reply.status_code, reply.json()) == (400, {"ok": False, "error": "that path is not a folder"})


@pytest.mark.parametrize("route", ["/api/fs/list", "/api/fs/dirs", "/api/file/raw"])
def test_path_routes_refuse_an_empty_path(client, route):
    reply = client.get(route, params={"path": ""})
    assert (reply.status_code, reply.json()) == (400, {"ok": False, "error": "a path is needed"})


@pytest.mark.parametrize("route", ["/api/fs/list", "/api/fs/dirs", "/api/file/raw"])
def test_path_routes_refuse_a_path_holding_a_nul_byte(client, tree, route):
    reply = client.get(route, params={"path": str(tree) + "\x00/etc"})
    assert (reply.status_code, reply.json()["error"]) == (400, "a path is needed")


@pytest.mark.skipif(not hasattr(__import__("os"), "getuid") or __import__("os").getuid() == 0, reason="the root user can read every folder, so a locked folder cannot be shown")
def test_listing_a_folder_without_read_permission_is_refused_with_a_sentence(client, tmp_path):
    locked = tmp_path / "locked"
    locked.mkdir()
    locked.chmod(0)
    try:
        reply = client.get("/api/fs/list", params={"path": str(locked)})
    finally:
        locked.chmod(0o755)
    assert (reply.status_code, reply.json()["error"]) == (400, "formtools is not allowed to read that folder")


def test_raw_file_route_returns_the_exact_bytes_on_disk(client, tree):
    payload = bytes(range(256)) * 3
    (tree / "blob.bin").write_bytes(payload)
    reply = client.get("/api/file/raw", params={"path": str(tree / "blob.bin")})
    assert reply.status_code == 200
    assert reply.content == payload


@pytest.mark.parametrize(
    "name,media",
    [
        ("a.png", "image/png"),
        ("a.webp", "image/webp"),
        ("a.svg", "image/svg+xml"),
        ("a.mp4", "video/mp4"),
        ("a.mkv", "video/x-matroska"),
        ("a.flac", "audio/flac"),
        ("a.glb", "model/gltf-binary"),
        ("a.pdf", "application/pdf"),
        ("a.woff2", "font/woff2"),
    ],
)
def test_raw_file_route_labels_each_format_with_its_registered_media_type(client, tmp_path, name, media):
    (tmp_path / name).write_bytes(b"\x00\x01")
    reply = client.get("/api/file/raw", params={"path": str(tmp_path / name)})
    assert reply.headers["content-type"].split(";")[0].strip() == media


def test_raw_file_route_serves_markdown_as_utf8_text(client, tree):
    reply = client.get("/api/file/raw", params={"path": str(tree / "notes.md")})
    kind = reply.headers["content-type"].replace(" ", "").lower()
    assert kind.startswith("text/markdown") and "charset=utf-8" in kind
    assert reply.text == "# hello\n"


def test_raw_file_route_says_a_missing_file_does_not_exist(client, tree):
    reply = client.get("/api/file/raw", params={"path": str(tree / "nope.png")})
    assert (reply.status_code, reply.json()) == (404, {"ok": False, "error": "that file does not exist"})


def test_raw_file_route_refuses_a_folder(client, tree):
    reply = client.get("/api/file/raw", params={"path": str(tree / "alpha")})
    assert (reply.status_code, reply.json()) == (400, {"ok": False, "error": "that path is not a file"})


def test_raw_file_route_refuses_a_relative_path(client):
    reply = client.get("/api/file/raw", params={"path": "notes.md"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the path must be absolute")


def test_home_route_names_the_home_folder_first_and_lists_known_folders_that_exist(client):
    from pathlib import Path

    home = Path.home()
    (home / "Pictures").mkdir(exist_ok=True)
    reply = client.get("/api/fs/home").json()
    assert reply["home"] == str(home)
    assert reply["roots"][0] == {"name": "Home", "path": str(home)}
    assert {"name": "Pictures", "path": str(home / "Pictures")} in reply["roots"]
    listed = {root["name"] for root in reply["roots"][1:]}
    for name in ("Desktop", "Documents", "Downloads", "Movies", "Videos", "Music"):
        assert (name in listed) == (home / name).is_dir()
