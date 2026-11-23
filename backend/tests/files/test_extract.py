import bz2
import gzip
import io
import lzma
import os
import stat
import tarfile
import zipfile

import pytest
import zstandard

from .support import file_info, link_info, post_job, tar_with, tree, zip_with

LINKS = pytest.mark.skipif(os.name == "nt", reason="symbolic links need privileges on Windows")


def extract(client, archive, dest=None, members=None):
    body = {"path": str(archive)}
    if dest is not None:
        body["dest"] = str(dest)
    if members is not None:
        body["members"] = members
    return post_job(client, "/api/archive/extract", body)


def errors_by_name(job):
    return {e["path"]: e["error"] for e in job["errors"]}


def test_a_tar_member_that_climbs_out_with_dot_dot_is_refused_and_nothing_is_written_outside(client, tmp_path):
    arc = tar_with(tmp_path / "evil.tar", [(file_info("../escaped.txt"), b"bad"), (file_info("ok.txt"), b"fine")])
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert not (tmp_path / "escaped.txt").exists()
    assert tree(dest) == {"ok.txt": b"fine"}
    assert errors_by_name(job)["../escaped.txt"] == "refused: the name climbs out of the destination with .."
    assert (job["result"]["written"], job["result"]["skipped"]) == (1, 1)


def test_a_dot_dot_in_the_middle_of_a_name_is_refused(client, tmp_path):
    arc = tar_with(tmp_path / "evil.tar", [(file_info("a/../../escaped.txt"), b"bad")])
    job = extract(client, arc, tmp_path / "dest")
    assert not (tmp_path / "escaped.txt").exists()
    assert errors_by_name(job)["a/../../escaped.txt"].startswith("refused: the name climbs")


def test_an_absolute_member_name_is_refused_and_the_target_file_is_not_created(client, tmp_path):
    target = tmp_path / "absolute-target.txt"
    arc = tar_with(tmp_path / "evil.tar", [(file_info(str(target)), b"bad")])
    job = extract(client, arc, tmp_path / "dest")
    assert not target.exists()
    assert errors_by_name(job)[str(target)] == "refused: the name is absolute"


def test_a_windows_drive_letter_name_is_refused(client, tmp_path):
    arc = zip_with(tmp_path / "evil.zip", {"C:/Windows/evil.txt": b"bad", "fine.txt": b"ok"})
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert tree(dest) == {"fine.txt": b"ok"}
    assert errors_by_name(job)["C:/Windows/evil.txt"] == "refused: the name starts with a drive letter"


def test_a_backslash_dot_dot_name_in_a_zip_is_refused(client, tmp_path):
    arc = zip_with(tmp_path / "evil.zip", {"..\\escaped.txt": b"bad"})
    job = extract(client, arc, tmp_path / "dest")
    assert not (tmp_path / "escaped.txt").exists()
    assert errors_by_name(job)["..\\escaped.txt"].startswith("refused: the name climbs")


def test_a_leading_backslash_name_in_a_zip_is_refused_as_absolute(client, tmp_path):
    arc = zip_with(tmp_path / "evil.zip", {"\\etc\\evil": b"bad"})
    job = extract(client, arc, tmp_path / "dest")
    assert errors_by_name(job)["\\etc\\evil"] == "refused: the name is absolute"


@LINKS
def test_a_symbolic_link_member_is_never_created(client, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    arc = tar_with(tmp_path / "l.tar", [(link_info("link", str(outside)), None), (file_info("real.txt"), b"r")])
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert not os.path.lexists(dest / "link")
    assert errors_by_name(job)["link"] == "skipped: links are never created or followed"
    assert (dest / "real.txt").read_bytes() == b"r"


def test_a_hard_link_member_is_never_created(client, tmp_path):
    secret = tmp_path / "secret.txt"
    secret.write_bytes(b"secret")
    arc = tar_with(tmp_path / "h.tar", [(link_info("hard", str(secret), tarfile.LNKTYPE), None)])
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert not os.path.lexists(dest / "hard")
    assert errors_by_name(job)["hard"] == "skipped: links are never created or followed"
    assert secret.read_bytes() == b"secret"


@LINKS
def test_a_file_written_through_a_link_planted_earlier_in_the_archive_stays_inside_the_destination(client, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    arc = tar_with(tmp_path / "two.tar", [(link_info("hop", str(outside)), None), (file_info("hop/pwned.txt"), b"bad")])
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert list(outside.iterdir()) == []
    assert not os.path.islink(dest / "hop")


@LINKS
def test_a_symbolic_link_folder_already_in_the_destination_is_not_followed(client, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    dest = tmp_path / "dest"
    dest.mkdir()
    os.symlink(outside, dest / "trap")
    arc = zip_with(tmp_path / "z.zip", {"trap/pwned.txt": b"bad", "ok.txt": b"fine"})
    job = extract(client, arc, dest)
    assert list(outside.iterdir()) == []
    assert errors_by_name(job)["trap/pwned.txt"] == "refused: a folder on the way is a symbolic link"
    assert (dest / "ok.txt").read_bytes() == b"fine"


@LINKS
def test_a_symbolic_link_entry_inside_a_zip_is_skipped(client, tmp_path):
    arc = tmp_path / "s.zip"
    with zipfile.ZipFile(arc, "w") as zf:
        info = zipfile.ZipInfo("ln")
        info.create_system = 3
        info.external_attr = (stat.S_IFLNK | 0o777) << 16
        zf.writestr(info, "/etc/passwd")
        zf.writestr("plain.txt", b"p")
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert tree(dest) == {"plain.txt": b"p"}
    assert errors_by_name(job)["ln"] == "skipped: links are never created or followed"


def test_a_device_node_member_is_skipped(client, tmp_path):
    node = tarfile.TarInfo("dev0")
    node.type = tarfile.CHRTYPE
    arc = tar_with(tmp_path / "d.tar", [(node, None), (file_info("n.txt"), b"n")])
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert errors_by_name(job)["dev0"] == "skipped: not a regular file or folder"
    assert tree(dest) == {"n.txt": b"n"}


def test_a_dot_slash_prefix_and_doubled_slashes_are_tidied_not_refused(client, tmp_path):
    arc = tar_with(tmp_path / "t.tar", [(file_info("./a//b.txt"), b"x")])
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert job["errors"] == []
    assert tree(dest) == {"a/b.txt": b"x"}


def test_an_existing_file_is_kept_and_the_new_one_is_written_with_a_number(client, tmp_path):
    dest = tmp_path / "dest"
    dest.mkdir()
    (dest / "a.txt").write_bytes(b"mine")
    arc = zip_with(tmp_path / "z.zip", {"a.txt": b"theirs"})
    job = extract(client, arc, dest)
    assert (dest / "a.txt").read_bytes() == b"mine"
    assert (dest / "a (2).txt").read_bytes() == b"theirs"
    assert job["result"]["written"] == 1


def test_extracting_twice_gives_three_distinct_copies(client, tmp_path):
    dest = tmp_path / "dest"
    arc = zip_with(tmp_path / "z.zip", {"a.txt": b"v"})
    extract(client, arc, dest)
    extract(client, arc, dest)
    extract(client, arc, dest)
    assert sorted(tree(dest)) == ["a (2).txt", "a (3).txt", "a.txt"]


def test_without_a_destination_a_new_folder_named_after_the_archive_is_made_beside_it(client, tmp_path):
    arc = zip_with(tmp_path / "pack.zip", {"a.txt": b"1"})
    job = extract(client, arc)
    assert job["result"]["dest"] == str(tmp_path / "pack")
    assert (tmp_path / "pack" / "a.txt").read_bytes() == b"1"
    again = extract(client, arc)
    assert again["result"]["dest"] == str(tmp_path / "pack (2)")


def test_a_double_extension_tar_archive_is_unpacked_into_a_folder_without_either_extension(client, tmp_path):
    arc = tar_with(tmp_path / "bundle.tar.gz", [(file_info("a.txt"), b"1")])
    assert extract(client, arc)["result"]["dest"] == str(tmp_path / "bundle")


def test_a_destination_that_is_a_file_is_refused(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"a": b"1"})
    (tmp_path / "file").write_bytes(b"x")
    reply = client.post("/api/archive/extract", json={"path": str(arc), "dest": str(tmp_path / "file")})
    assert (reply.status_code, reply.json()["error"]) == (400, "the destination is a file, not a folder")


def test_only_the_asked_members_and_the_contents_of_asked_folders_are_extracted(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"top.txt": b"t", "dir/one.txt": b"1", "dir/two.txt": b"2", "other/x.txt": b"x"})
    dest = tmp_path / "dest"
    job = extract(client, arc, dest, ["dir", "top.txt"])
    assert tree(dest) == {"top.txt": b"t", "dir/one.txt": b"1", "dir/two.txt": b"2"}
    assert job["errors"] == []


def test_asking_for_a_member_that_is_not_in_the_archive_is_reported(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"a.txt": b"1"})
    job = extract(client, arc, tmp_path / "dest", ["a.txt", "nope.txt"])
    assert errors_by_name(job) == {"nope.txt": "that member is not in the archive"}
    assert (tmp_path / "dest" / "a.txt").exists()


def test_file_times_from_the_archive_are_restored(client, tmp_path):
    arc = tar_with(tmp_path / "t.tar", [(file_info("a.txt", mtime=1_400_000_000), b"x")])
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert int(os.stat(dest / "a.txt").st_mtime) == 1_400_000_000


def test_an_executable_member_comes_out_executable_and_a_plain_one_does_not(client, tmp_path):
    arc = tar_with(tmp_path / "t.tar", [(file_info("run", mode=0o755), b"x"), (file_info("data", mode=0o644), b"y")])
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert os.stat(dest / "run").st_mode & stat.S_IXUSR
    assert not os.stat(dest / "data").st_mode & stat.S_IXUSR


def test_empty_folders_and_empty_files_in_an_archive_are_recreated(client, tmp_path):
    folder = tarfile.TarInfo("emptydir")
    folder.type = tarfile.DIRTYPE
    folder.mode = 0o755
    arc = tar_with(tmp_path / "t.tar", [(folder, None), (file_info("zero"), b"")])
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert (dest / "emptydir").is_dir()
    assert (dest / "zero").read_bytes() == b""


@pytest.mark.parametrize("opener,suffix", [(gzip.compress, ".gz"), (bz2.compress, ".bz2"), (lzma.compress, ".xz"), (zstandard.ZstdCompressor().compress, ".zst")])
def test_a_single_compressed_file_is_unpacked_to_its_name_without_the_suffix(client, tmp_path, opener, suffix):
    payload = b"hello single file\n" * 40 + os.urandom(64)
    arc = tmp_path / f"notes.txt{suffix}"
    arc.write_bytes(opener(payload))
    dest = tmp_path / "dest"
    job = extract(client, arc, dest)
    assert job["state"] == "done"
    assert tree(dest) == {"notes.txt": payload}


@pytest.mark.parametrize("comp,mode", [("gz", "w:gz"), ("bz2", "w:bz2"), ("xz", "w:xz")])
def test_tar_archives_in_each_compression_made_by_the_standard_library_unpack_identically(client, tmp_path, comp, mode):
    members = [(file_info("d/a.txt"), b"alpha"), (file_info("b.bin"), bytes(range(256)))]
    arc = tar_with(tmp_path / f"t.tar.{comp}", members, mode)
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert tree(dest) == {"d/a.txt": b"alpha", "b.bin": bytes(range(256))}


def test_a_zstd_tar_made_with_the_zstandard_library_unpacks(client, tmp_path):
    raw = io.BytesIO()
    with tarfile.open(fileobj=raw, mode="w") as tf:
        info = file_info("z.txt")
        info.size = 3
        tf.addfile(info, io.BytesIO(b"zzz"))
    arc = tmp_path / "t.tar.zst"
    arc.write_bytes(zstandard.ZstdCompressor().compress(raw.getvalue()))
    dest = tmp_path / "dest"
    extract(client, arc, dest)
    assert tree(dest) == {"z.txt": b"zzz"}


def test_an_archive_that_expands_past_the_ratio_limit_is_stopped_as_a_zip_bomb(client, tmp_path, monkeypatch):
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_RATIO", "10")
    arc = zip_with(tmp_path / "bomb.zip", {"zeros.bin": bytes(2_000_000)})
    reply = client.post("/api/archive/extract", json={"path": str(arc), "dest": str(tmp_path / "dest")}).json()
    from .support import finish

    job = finish(client, reply)
    assert job["state"] == "failed"
    assert job["errors"][-1]["error"] == "extraction stopped because the archive expands more than 10 times its own size, which looks like a zip bomb"
    assert not (tmp_path / "dest" / "zeros.bin").exists()


def test_an_archive_that_expands_past_the_byte_limit_is_stopped(client, tmp_path, monkeypatch):
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_BYTES", "1000")
    arc = tar_with(tmp_path / "big.tar", [(file_info("big.bin"), os.urandom(5000))], "w")
    from .support import finish

    job = finish(client, client.post("/api/archive/extract", json={"path": str(arc), "dest": str(tmp_path / "dest")}).json())
    assert job["state"] == "failed"
    assert job["errors"][-1]["error"] == "extraction stopped because the archive expands past the size limit"
    assert not (tmp_path / "dest" / "big.bin").exists()


def test_a_truncated_zip_is_refused_as_damaged(client, tmp_path):
    good = zip_with(tmp_path / "g.zip", {"a.txt": b"x" * 5000})
    cut = tmp_path / "cut.zip"
    cut.write_bytes(good.read_bytes()[:40])
    reply = client.post("/api/archive/extract", json={"path": str(cut)})
    assert (reply.status_code, reply.json()["error"]) == (400, "that archive is damaged or cut short")


def test_a_gzip_file_cut_short_is_refused_as_damaged(client, tmp_path):
    cut = tmp_path / "cut.tar.gz"
    cut.write_bytes(gzip.compress(os.urandom(5000))[:6])
    reply = client.get("/api/archive/list", params={"path": str(cut)})
    assert (reply.status_code, reply.json()["error"]) == (400, "that archive is damaged or cut short")


def test_extracting_a_missing_archive_is_refused(client, tmp_path):
    reply = client.post("/api/archive/extract", json={"path": str(tmp_path / "ghost.zip")})
    assert (reply.status_code, reply.json()["error"]) == (404, "that file does not exist")


def test_extracting_a_folder_is_refused(client, tmp_path):
    reply = client.post("/api/archive/extract", json={"path": str(tmp_path)})
    assert (reply.status_code, reply.json()["error"]) == (400, "that path is not a file")


def test_a_plain_text_file_is_not_an_archive(client, tmp_path):
    from app.tools.files import archive

    from .support import finish

    plain = tmp_path / "notes.txt"
    plain.write_text("hello", encoding="utf-8")
    reply = client.get("/api/archive/list", params={"path": str(plain)})
    assert reply.status_code == 415
    if archive.LIBARCHIVE:
        assert reply.json()["error"].startswith("formtools could not read that file as an archive")
    else:
        assert reply.json()["error"] == archive.NO_LIBARCHIVE
    started = client.post("/api/archive/extract", json={"path": str(plain), "dest": str(tmp_path / "dest")})
    if started.status_code == 200:
        job = finish(client, started.json())
        assert job["state"] == "failed" and job["errors"][-1]["error"].startswith("formtools could not read that file as an archive")
    assert not (tmp_path / "dest" / "notes.txt").exists()


def test_listing_reports_names_sizes_and_the_engine_for_a_tar(client, tmp_path):
    arc = tar_with(tmp_path / "t.tar", [(file_info("dir/a.txt"), b"12345"), (file_info("b.txt"), b"")], "w")
    listing = client.get("/api/archive/list", params={"path": str(arc)}).json()
    assert listing["format"] == "tar" and listing["engine"] == "tarfile"
    assert [(e["name"], e["member"], e["size"]) for e in listing["entries"]] == [("a.txt", "dir/a.txt", 5), ("b.txt", "b.txt", 0)]


def test_listing_with_a_limit_reports_the_total_and_truncation(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {f"f{i}.txt": b"x" for i in range(7)})
    listing = client.get("/api/archive/list", params={"path": str(arc), "limit": 3}).json()
    assert (len(listing["entries"]), listing["total"], listing["truncated"]) == (3, 7, True)


def test_a_single_gzip_is_listed_as_one_entry_with_its_unpacked_size(client, tmp_path):
    arc = tmp_path / "log.txt.gz"
    arc.write_bytes(gzip.compress(b"x" * 1234))
    listing = client.get("/api/archive/list", params={"path": str(arc)}).json()
    assert [(e["member"], e["size"]) for e in listing["entries"]] == [("log.txt", 1234)]
    assert listing["format"] == "gz"


def test_a_member_is_read_out_of_a_zip_with_its_content_type(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"d/hello.txt": b"hello"})
    reply = client.get("/api/archive/member", params={"path": str(arc), "member": "d/hello.txt"})
    assert reply.status_code == 200 and reply.content == b"hello"
    assert reply.headers["content-type"].startswith("text/plain")
    assert reply.headers["x-content-type-options"] == "nosniff"
    assert reply.headers["content-security-policy"] == "sandbox"


def test_reading_a_member_that_is_not_there_is_refused(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"a": b"1"})
    reply = client.get("/api/archive/member", params={"path": str(arc), "member": "b"})
    assert (reply.status_code, reply.json()["error"]) == (404, "that member is not in the archive")


def test_reading_a_folder_member_is_refused(client, tmp_path):
    arc = zip_with(tmp_path / "z.zip", {"d/": b"", "d/a": b"1"})
    reply = client.get("/api/archive/member", params={"path": str(arc), "member": "d"})
    assert (reply.status_code, reply.json()["error"]) == (400, "that member is a folder")


def test_reading_a_link_member_is_refused(client, tmp_path):
    arc = tar_with(tmp_path / "t.tar", [(link_info("ln", "/etc/passwd"), None)], "w")
    reply = client.get("/api/archive/member", params={"path": str(arc), "member": "ln"})
    assert (reply.status_code, reply.json()["error"]) == (400, "that member is a link or a special file")
