import os

import pytest
from PIL import Image

from app.tools.utilities import walk
from .support import can_link, pattern, put, run_job


def collected(root, recursive=True, hidden=False):
    errors = []
    found = {os.path.relpath(path, root): info.st_size for path, info in walk.walk(str(root), recursive, hidden, lambda p, e: errors.append(p))}
    return found, errors


def test_walk_yields_every_regular_file_with_its_size(tmp_path):
    put(tmp_path / "a.txt", b"x" * 3)
    put(tmp_path / "s" / "b.txt", b"y" * 5)
    put(tmp_path / "s" / "t" / "c.txt", b"")
    found, errors = collected(tmp_path)
    assert found == {"a.txt": 3, os.path.join("s", "b.txt"): 5, os.path.join("s", "t", "c.txt"): 0}
    assert errors == []


def test_walk_that_is_not_recursive_stays_in_the_top_folder(tmp_path):
    put(tmp_path / "a.txt", b"x")
    put(tmp_path / "s" / "b.txt", b"y")
    assert set(collected(tmp_path, recursive=False)[0]) == {"a.txt"}


def test_walk_skips_dot_files_and_dot_folders_unless_hidden_are_wanted(tmp_path):
    put(tmp_path / "a.txt", b"x")
    put(tmp_path / ".h.txt", b"x")
    put(tmp_path / ".git" / "cfg", b"x")
    assert set(collected(tmp_path)[0]) == {"a.txt"}
    assert set(collected(tmp_path, hidden=True)[0]) == {"a.txt", ".h.txt", os.path.join(".git", "cfg")}


def test_walk_skips_links_that_leave_the_tree(tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    put(tmp_path / "out" / "secret.txt", b"s")
    put(tmp_path / "t" / "in.txt", b"i")
    os.symlink(tmp_path / "out", tmp_path / "t" / "dirlink", target_is_directory=True)
    os.symlink(tmp_path / "out" / "secret.txt", tmp_path / "t" / "filelink")
    assert set(collected(tmp_path / "t")[0]) == {"in.txt"}


def test_walk_reports_a_vanished_folder_to_its_error_callback(tmp_path):
    found, errors = collected(tmp_path / "missing")
    assert found == {}
    assert errors == [str(tmp_path / "missing")]


def test_folder_roots_drops_a_root_already_inside_another(tmp_path):
    (tmp_path / "t" / "inner").mkdir(parents=True)
    kept = walk.folder_roots([str(tmp_path / "t" / "inner"), str(tmp_path / "t")])
    assert kept == [str(tmp_path / "t")]
    assert walk.folder_roots([str(tmp_path / "t"), str(tmp_path / "t" / "inner")], recursive=False) == [str(tmp_path / "t"), str(tmp_path / "t" / "inner")]


def test_folder_roots_refuses_a_list_with_nothing_in_it():
    from app.core.errors import ApiError

    with pytest.raises(ApiError) as caught:
        walk.folder_roots([])
    assert caught.value.message == "at least one folder is needed"


def png_bytes(width=16, height=16):
    from io import BytesIO

    buffer = BytesIO()
    Image.new("RGB", (width, height), (200, 30, 30)).save(buffer, "PNG")
    return buffer.getvalue()


def test_empty_folders_are_listed_with_the_top_most_ones_marked(client, tmp_path):
    for name in ("t/empty1", "t/chain/a/b", "t/full/inner"):
        (tmp_path / name).mkdir(parents=True)
    put(tmp_path / "t" / "full" / "file.txt", b"x")
    job = run_job(client, "/api/files/empty-folders", {"root": str(tmp_path / "t")})
    assert job["state"] == "done"
    top = tmp_path / "t"
    assert job["result"]["folders"] == sorted(str(top / name) for name in ("chain", "chain/a", "chain/a/b", "empty1", "full/inner"))
    assert job["result"]["top"] == sorted(str(top / name) for name in ("chain", "empty1", "full/inner"))


def test_a_folder_holding_only_an_empty_file_is_not_empty(client, tmp_path):
    put(tmp_path / "t" / "d" / "zero.dat", b"")
    job = run_job(client, "/api/files/empty-folders", {"root": str(tmp_path / "t")})
    assert job["result"]["folders"] == []


def test_the_root_itself_is_never_listed_as_empty(client, tmp_path):
    (tmp_path / "t").mkdir()
    assert run_job(client, "/api/files/empty-folders", {"root": str(tmp_path / "t")})["result"]["folders"] == []


def test_empty_folder_search_never_removes_anything(client, tmp_path):
    (tmp_path / "t" / "e").mkdir(parents=True)
    run_job(client, "/api/files/empty-folders", {"root": str(tmp_path / "t")})
    assert (tmp_path / "t" / "e").is_dir()


def test_a_folder_holding_only_a_link_is_not_empty_and_is_not_followed(client, tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    (tmp_path / "t" / "d").mkdir(parents=True)
    (tmp_path / "far").mkdir()
    os.symlink(tmp_path / "far", tmp_path / "t" / "d" / "to-far", target_is_directory=True)
    job = run_job(client, "/api/files/empty-folders", {"root": str(tmp_path / "t")})
    assert job["result"]["folders"] == []


def test_empty_folder_search_of_a_missing_folder_is_refused(client, tmp_path):
    reply = client.post("/api/files/empty-folders", json={"root": str(tmp_path / "none")})
    assert reply.status_code == 404
    assert reply.json()["error"] == "that folder does not exist"


def test_a_truncated_picture_is_reported_broken_and_a_sound_one_is_not(client, tmp_path):
    good = png_bytes()
    put(tmp_path / "t" / "good.png", good)
    put(tmp_path / "t" / "bad.png", good[: len(good) // 2])
    put(tmp_path / "t" / "notes.txt", b"plain")
    job = run_job(client, "/api/files/broken", {"root": str(tmp_path / "t")})
    assert job["state"] == "done"
    assert [os.path.basename(item["path"]) for item in job["result"]["items"]] == ["bad.png"]
    assert job["result"]["items"][0]["type"] == "image"
    assert job["result"]["items"][0]["error"]


def test_a_picture_with_junk_inside_is_reported_broken(client, tmp_path):
    put(tmp_path / "t" / "junk.jpg", b"this is not a jpeg at all" * 20)
    items = run_job(client, "/api/files/broken", {"root": str(tmp_path / "t")})["result"]["items"]
    assert [os.path.basename(item["path"]) for item in items] == ["junk.jpg"]


def test_a_folder_of_sound_pictures_has_nothing_broken(client, tmp_path):
    for name in ("a.png", "b.png"):
        put(tmp_path / "t" / name, png_bytes())
    result = run_job(client, "/api/files/broken", {"root": str(tmp_path / "t")})["result"]
    assert result["items"] == []
    assert result["checked"] >= 2
