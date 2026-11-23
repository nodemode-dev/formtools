import io
import os
import random
import stat
import tarfile
import zipfile

import pytest
import zstandard

from .support import make_source, post_job, tree

FORMATS = ["zip", "tar", "tar.gz", "tar.xz", "tar.zst"]


def create(client, paths, out, fmt):
    job = post_job(client, "/api/archive/create", {"paths": [str(p) for p in paths], "out": str(out), "format": fmt})
    assert job["state"] == "done", job
    return job


def read_back(path, fmt):
    found = {}
    if fmt == "zip":
        with zipfile.ZipFile(path) as zf:
            assert zf.testzip() is None
            for info in zf.infolist():
                if not info.is_dir():
                    found[info.filename] = zf.read(info)
        return found
    if fmt == "tar.zst":
        stream = zstandard.ZstdDecompressor().stream_reader(open(path, "rb"))
        tf = tarfile.open(fileobj=stream, mode="r|")
    else:
        tf = tarfile.open(path)
    with tf:
        for member in tf:
            if member.isreg():
                found[member.name] = tf.extractfile(member).read()
    return found


@pytest.mark.parametrize("fmt", FORMATS)
def test_an_archive_made_by_the_app_reads_back_byte_for_byte_with_the_standard_library(client, tmp_path, fmt):
    src = make_source(tmp_path)
    out = tmp_path / f"made.{fmt}"
    job = create(client, [src], out, fmt)
    expected = {f"src/{name}": data for name, data in tree(src).items()}
    assert read_back(out, fmt) == expected
    assert job["result"]["path"] == str(out)
    assert job["result"]["files"] == 4
    assert job["result"]["bytes"] == out.stat().st_size


@pytest.mark.parametrize("fmt", FORMATS)
def test_a_folder_becomes_an_archive_entry_for_every_subfolder_including_empty_ones(client, tmp_path, fmt):
    src = tmp_path / "proj"
    (src / "empty").mkdir(parents=True)
    (src / "full").mkdir()
    (src / "full" / "f.txt").write_bytes(b"x")
    out = tmp_path / f"o.{fmt}"
    create(client, [src], out, fmt)
    if fmt == "zip":
        with zipfile.ZipFile(out) as zf:
            names = sorted(zf.namelist())
    elif fmt == "tar.zst":
        with tarfile.open(fileobj=zstandard.ZstdDecompressor().stream_reader(open(out, "rb")), mode="r|") as tf:
            names = sorted(m.name + ("/" if m.isdir() else "") for m in tf)
    else:
        with tarfile.open(out) as tf:
            names = sorted(m.name + ("/" if m.isdir() else "") for m in tf)
    assert names == ["proj/", "proj/empty/", "proj/full/", "proj/full/f.txt"]


def test_the_zip_made_by_the_app_stores_the_file_modification_time(client, tmp_path):
    src = tmp_path / "f.txt"
    src.write_bytes(b"data")
    os.utime(src, (1_500_000_000, 1_500_000_000))
    out = tmp_path / "t.zip"
    create(client, [src], out, "zip")
    with zipfile.ZipFile(out) as zf:
        stamp = zf.getinfo("f.txt").date_time
    assert (2017, 7, 13) <= stamp[:3] <= (2017, 7, 15)


def test_the_tar_made_by_the_app_keeps_mtime_and_executable_bit_and_clears_owner(client, tmp_path):
    src = tmp_path / "run.sh"
    src.write_bytes(b"#!/bin/sh\n")
    src.chmod(0o755)
    os.utime(src, (1_500_000_000, 1_500_000_000))
    out = tmp_path / "t.tar"
    create(client, [src], out, "tar")
    with tarfile.open(out) as tf:
        info = tf.getmember("run.sh")
    assert info.mtime == 1_500_000_000
    assert info.mode & 0o777 == 0o755
    assert (info.uid, info.gid, info.uname, info.gname) == (0, 0, "", "")


def test_several_sources_with_the_same_name_get_numbered_names_inside_the_archive(client, tmp_path):
    (tmp_path / "one").mkdir()
    (tmp_path / "two").mkdir()
    (tmp_path / "one" / "same.txt").write_bytes(b"first")
    (tmp_path / "two" / "same.txt").write_bytes(b"second")
    out = tmp_path / "both.zip"
    create(client, [tmp_path / "one" / "same.txt", tmp_path / "two" / "same.txt"], out, "zip")
    found = read_back(out, "zip")
    assert len(found) == 2 and sorted(found.values()) == [b"first", b"second"]
    assert found["same.txt"] == b"first"


def test_a_missing_extension_is_added_to_the_archive_name(client, tmp_path):
    src = tmp_path / "f.txt"
    src.write_bytes(b"x")
    job = create(client, [src], tmp_path / "bundle", "tar.gz")
    assert job["result"]["path"] == str(tmp_path / "bundle.tar.gz")
    assert (tmp_path / "bundle.tar.gz").is_file()


def test_an_existing_archive_is_never_overwritten_the_new_one_gets_a_number(client, tmp_path):
    src = tmp_path / "f.txt"
    src.write_bytes(b"new content")
    (tmp_path / "keep.zip").write_bytes(b"precious")
    job = create(client, [src], tmp_path / "keep.zip", "zip")
    assert (tmp_path / "keep.zip").read_bytes() == b"precious"
    assert job["result"]["path"] == str(tmp_path / "keep (2).zip")
    assert read_back(tmp_path / "keep (2).zip", "zip") == {"f.txt": b"new content"}


def test_an_archive_written_inside_the_folder_it_packs_does_not_contain_itself(client, tmp_path):
    src = tmp_path / "proj"
    src.mkdir()
    (src / "a.txt").write_bytes(b"a")
    create(client, [src], src / "self.zip", "zip")
    with zipfile.ZipFile(src / "self.zip") as zf:
        assert sorted(zf.namelist()) == ["proj/", "proj/a.txt"]


@pytest.mark.skipif(os.name == "nt", reason="symbolic links need privileges on Windows")
def test_symbolic_links_are_left_out_and_reported(client, tmp_path):
    src = tmp_path / "proj"
    src.mkdir()
    (src / "real.txt").write_bytes(b"real")
    os.symlink(src / "real.txt", src / "link.txt")
    out = tmp_path / "o.zip"
    job = create(client, [src], out, "zip")
    assert read_back(out, "zip") == {"proj/real.txt": b"real"}
    assert [os.path.basename(e["path"]) for e in job["errors"]] == ["link.txt"]
    assert job["errors"][0]["error"].startswith("skipped:")


@pytest.mark.skipif(os.name == "nt", reason="symbolic links need privileges on Windows")
def test_a_source_that_is_only_a_symbolic_link_leaves_nothing_to_archive(client, tmp_path):
    (tmp_path / "t.txt").write_bytes(b"x")
    os.symlink(tmp_path / "t.txt", tmp_path / "ln")
    reply = client.post("/api/archive/create", json={"paths": [str(tmp_path / "ln")], "out": str(tmp_path / "o.zip"), "format": "zip"})
    assert (reply.status_code, reply.json()["error"]) == (400, "there is nothing to put in the archive")


def test_a_missing_source_is_refused_by_name(client, tmp_path):
    reply = client.post("/api/archive/create", json={"paths": [str(tmp_path / "ghost")], "out": str(tmp_path / "o.zip"), "format": "zip"})
    assert (reply.status_code, reply.json()["error"]) == (404, "ghost does not exist")


def test_an_archive_cannot_be_written_into_a_folder_that_does_not_exist(client, tmp_path):
    (tmp_path / "f").write_bytes(b"x")
    reply = client.post("/api/archive/create", json={"paths": [str(tmp_path / "f")], "out": str(tmp_path / "nope" / "o.zip"), "format": "zip"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the folder for the new archive does not exist")


def test_a_relative_output_path_is_refused(client, tmp_path):
    (tmp_path / "f").write_bytes(b"x")
    reply = client.post("/api/archive/create", json={"paths": [str(tmp_path / "f")], "out": "o.zip", "format": "zip"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the path must be absolute")


def test_an_unknown_format_is_refused(client, tmp_path):
    (tmp_path / "f").write_bytes(b"x")
    reply = client.post("/api/archive/create", json={"paths": [str(tmp_path / "f")], "out": str(tmp_path / "o.rar"), "format": "rar"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the request is missing or has a bad value for format")
    assert not (tmp_path / "o.rar").exists()


def test_a_file_with_every_byte_value_survives_a_zip_round_trip_through_the_app(client, tmp_path):
    payload = bytes(range(256)) * 5000 + b"\r\n\x00\x00"
    src = tmp_path / "all.bin"
    src.write_bytes(payload)
    zipped = create(client, [src], tmp_path / "all.zip", "zip")["result"]["path"]
    out = tmp_path / "unpacked"
    done = post_job(client, "/api/archive/extract", {"path": zipped, "dest": str(out)})
    assert done["state"] == "done"
    assert (out / "all.bin").read_bytes() == payload


@pytest.mark.parametrize("fmt", FORMATS)
def test_extracting_what_the_app_created_reproduces_the_source_tree_exactly(client, tmp_path, fmt):
    src = make_source(tmp_path)
    (src / "sub" / "b.bin").write_bytes(random.Random(7).randbytes(300000))
    archive_path = create(client, [src], tmp_path / f"rt.{fmt}", fmt)["result"]["path"]
    out = tmp_path / "unpacked"
    done = post_job(client, "/api/archive/extract", {"path": archive_path, "dest": str(out)})
    assert done["state"] == "done" and done["errors"] == []
    assert tree(out / "src") == tree(src)
    assert (out / "src" / "sub" / "deep").is_dir()


def test_the_executable_bit_survives_a_create_and_extract_round_trip(client, tmp_path):
    src = tmp_path / "tool.sh"
    src.write_bytes(b"#!/bin/sh\n")
    src.chmod(0o755)
    path = create(client, [src], tmp_path / "t.tar.gz", "tar.gz")["result"]["path"]
    post_job(client, "/api/archive/extract", {"path": path, "dest": str(tmp_path / "out")})
    assert os.stat(tmp_path / "out" / "tool.sh").st_mode & stat.S_IXUSR


def test_a_zip_made_by_the_app_is_listed_by_the_app_with_the_same_names_and_sizes(client, tmp_path):
    src = make_source(tmp_path)
    out = create(client, [src], tmp_path / "l.zip", "zip")["result"]["path"]
    listing = client.get("/api/archive/list", params={"path": out}).json()
    with zipfile.ZipFile(out) as zf:
        expected = [(i.filename, i.file_size) for i in zf.infolist()]
    assert [(e["member"], e["size"]) for e in listing["entries"]] == expected
    assert listing["format"] == "zip" and listing["total"] == len(expected) and listing["truncated"] is False


def test_a_file_dated_before_1980_is_still_archived_into_a_zip_that_reads_back(client, tmp_path):
    src = tmp_path / "old.txt"
    src.write_bytes(b"ancient")
    os.utime(src, (0, 0))
    out = tmp_path / "old.zip"
    create(client, [src], out, "zip")
    assert read_back(out, "zip") == {"old.txt": b"ancient"}
