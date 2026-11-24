import base64
import hashlib
import io
import json
import tarfile
from pathlib import Path

import pytest

from app.core.errors import ApiError
from app.tools import exif
from app.tools.exif import fetch, runner

from .tools import exif_rig, script

SENTENCE_PERL = "ExifTool needs Perl and perl was not found on this computer; install Perl or put an ExifTool on PATH."
SENTENCE_MISSING = "ExifTool is not available; get it with the Get ExifTool button, or install it and put it on PATH."

RECORD = {
    "SourceFile": "x",
    "ExifTool:ExifTool:Warning": ["Minor problem one", "Minor problem two"],
    "File:System:FileName": {"desc": "File Name", "val": "photo.jpg"},
    "File:File:FileType": {"desc": "File Type", "val": "JPEG"},
    "File:File:MIMEType": {"desc": "MIME Type", "val": "image/jpeg"},
    "EXIF:IFD0:Make": {"desc": "Camera Make", "val": "Acme"},
    "EXIF:IFD0:Model": {"desc": "Camera Model Name", "val": "One"},
    "EXIF:IFD1:ThumbnailImage": {"desc": "Thumbnail Image", "val": "(Binary data 1234567 bytes, use -b option to extract)"},
    "EXIF:IFD0:Make (1)": {"desc": "Camera Make", "val": "Second"},
    "GPS:GPS:GPSLatitude": {"desc": "GPS Latitude", "val": "51 deg 30' 0.00\" N"},
    "XMP:XMP-dc:Creator": {"desc": "Creator", "val": ["Ann", "Bo"]},
    "Composite:Composite:ImageSize": {"desc": "Image Size", "val": "640x480"},
    "Zeta:Zeta:Odd": {"desc": "Odd", "val": 1},
}


@pytest.fixture
def photo(tmp_path):
    target = tmp_path / "photo.jpg"
    target.write_bytes(b"0123456789")
    return target


def read(client, path, **params):
    return client.get("/api/exif/read", params={"path": str(path), **params})


def test_status_with_nothing_installed_and_no_perl_names_the_perl_problem(client, exif_rig):
    body = client.get("/api/exif/status").json()
    assert body == {"available": False, "path": None, "version": None, "source": None, "fetching": False, "perl": None, "error": SENTENCE_PERL}


def test_status_with_perl_but_no_exiftool_is_unavailable_without_an_error(client, exif_rig):
    perl = exif_rig.perl()
    body = client.get("/api/exif/status").json()
    assert (body["available"], body["error"], body["perl"]) == (False, None, str(perl))


def test_status_finds_an_exiftool_on_path_and_its_version(client, exif_rig):
    tool = exif_rig.tool(RECORD)
    body = client.get("/api/exif/status").json()
    assert (body["available"], body["path"], body["version"], body["source"], body["error"]) == (True, str(tool), "12.76", "path", None)


def test_the_environment_variable_wins_over_an_exiftool_on_path(client, exif_rig, monkeypatch):
    exif_rig.tool(RECORD)
    other = exif_rig.tool(RECORD, where=exif_rig.folder, name="mytool")
    monkeypatch.setenv("FORMTOOLS_EXIFTOOL", str(other))
    body = client.get("/api/exif/status").json()
    assert (body["path"], body["source"]) == (str(other), "env")


def test_a_bad_environment_variable_is_reported_and_path_is_used_instead_when_it_has_one(client, exif_rig, monkeypatch):
    monkeypatch.setenv("FORMTOOLS_EXIFTOOL", str(exif_rig.folder / "nowhere"))
    broken = client.get("/api/exif/status").json()
    assert (broken["available"], broken["error"]) == (False, "FORMTOOLS_EXIFTOOL does not point to a working ExifTool.")
    exif_rig.tool(RECORD)
    fallback = client.get("/api/exif/status").json()
    assert (fallback["available"], fallback["source"], fallback["error"]) == (True, "path", None)


def verified_copy(exif_rig):
    where = fetch.folder()
    where.mkdir(parents=True)
    pinned = fetch.package()
    marker = {"exiftool": fetch.EXIFTOOL, "package": pinned["name"], "package_version": pinned["version"], "integrity": pinned["integrity"]}
    (where / fetch.MARKER).write_text(json.dumps(marker), encoding="utf-8")
    exif_rig.tool(RECORD, where=where, name=pinned["script"])
    return where


def test_a_verified_fetched_copy_is_found_and_run_through_perl(client, exif_rig):
    exif_rig.perl()
    where = verified_copy(exif_rig)
    body = client.get("/api/exif/status").json()
    assert (body["available"], body["source"], body["path"], body["version"]) == (True, "fetched", str(fetch.script_of(where)), "12.76")


def test_a_fetched_copy_without_perl_asks_for_perl(client, exif_rig):
    verified_copy(exif_rig)
    body = client.get("/api/exif/status").json()
    assert (body["available"], body["error"]) == (False, SENTENCE_PERL)


def test_a_fetched_copy_whose_marker_does_not_match_the_pinned_package_is_ignored(client, exif_rig):
    exif_rig.perl()
    where = verified_copy(exif_rig)
    (where / fetch.MARKER).write_text(json.dumps({"exiftool": fetch.EXIFTOOL, "package": "other", "integrity": "x"}), encoding="utf-8")
    body = client.get("/api/exif/status").json()
    assert (body["available"], body["error"]) == (False, None)


def test_status_says_when_the_download_is_running_or_has_failed(client, exif_rig, monkeypatch):
    exif_rig.perl()
    monkeypatch.setitem(fetch.STATE, "fetching", True)
    monkeypatch.setitem(fetch.STATE, "error", "ExifTool could not be fetched: offline")
    body = client.get("/api/exif/status").json()
    assert (body["fetching"], body["error"]) == (True, "ExifTool could not be fetched: offline")


def test_reading_with_no_exiftool_is_refused_with_the_get_exiftool_hint(client, exif_rig, photo):
    exif_rig.perl()
    answer = read(client, photo)
    assert (answer.status_code, answer.json()["error"]) == (415, SENTENCE_MISSING)


def test_reading_while_exiftool_downloads_asks_to_try_again(client, exif_rig, photo, monkeypatch):
    monkeypatch.setitem(fetch.STATE, "fetching", True)
    answer = read(client, photo)
    assert (answer.status_code, answer.json()["error"]) == (415, "ExifTool is still being downloaded, try again in a minute.")


def test_reading_after_a_failed_download_repeats_what_went_wrong(client, exif_rig, photo, monkeypatch):
    monkeypatch.setitem(fetch.STATE, "error", "ExifTool 1 could not be fetched: offline")
    assert read(client, photo).json()["error"] == "ExifTool 1 could not be fetched: offline"


def test_reading_names_a_missing_file_a_folder_a_relative_path_and_a_line_break(client, exif_rig, tmp_path):
    missing = read(client, tmp_path / "none.jpg")
    assert (missing.status_code, missing.json()["error"]) == (404, "that file does not exist")
    folder = read(client, tmp_path)
    assert (folder.status_code, folder.json()["error"]) == (400, "that path is a folder, not a file")
    relative = client.get("/api/exif/read", params={"path": "photo.jpg"})
    assert (relative.status_code, relative.json()["error"]) == (400, "the path must be absolute")
    broken = client.get("/api/exif/read", params={"path": str(tmp_path / "a\nb.jpg")})
    assert (broken.status_code, broken.json()["error"]) == (400, "that path cannot be read because its name holds a line break")


def test_a_read_lists_file_exif_xmp_and_composite_groups_first_then_the_others_alphabetically(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    body = read(client, photo).json()
    assert [g["name"] for g in body["groups"]] == ["File", "System", "IFD0", "IFD1", "XMP-dc", "Composite", "GPS", "Zeta"]
    assert [g["family0"] for g in body["groups"]] == ["File", "File", "EXIF", "EXIF", "XMP", "Composite", "GPS", "Zeta"]


def test_a_read_labels_each_tag_with_its_readable_description_and_strips_copy_numbers(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    groups = {g["name"]: g for g in read(client, photo).json()["groups"]}
    assert groups["IFD0"]["tags"] == [
        {"name": "Make", "label": "Camera Make", "value": "Acme"},
        {"name": "Model", "label": "Camera Model Name", "value": "One"},
        {"name": "Make", "label": "Camera Make", "value": "Second"},
    ]
    assert groups["XMP-dc"]["tags"][0]["value"] == ["Ann", "Bo"]


def test_a_read_turns_binary_placeholders_into_a_plain_size_sentence(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    groups = {g["name"]: g for g in read(client, photo).json()["groups"]}
    assert groups["IFD1"]["tags"][0]["value"] == "Binary data, 1,234,567 bytes"


def test_a_read_reports_file_facts_version_count_and_exiftool_warnings(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    body = read(client, photo).json()
    assert body["tool"] == "exiftool"
    assert body["version"] == "12.76"
    assert body["file"] == {"name": "photo.jpg", "size": 10, "type": "JPEG", "mime": "image/jpeg"}
    assert body["warnings"] == ["Minor problem one", "Minor problem two"]
    assert body["count"] == sum(len(g["tags"]) for g in body["groups"]) == 11
    assert all(g["family0"] != "ExifTool" for g in body["groups"])


def test_a_read_sends_exiftool_json_grouped_long_output_ending_with_the_path(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    read(client, photo)
    assert exif_rig.calls() == [["-json", "-a", "-G0:1", "-struct", "-l", "-charset", "filename=utf8", "-api", "largefilesupport=1", str(photo)]]


def test_the_numeric_and_unknown_switches_add_minus_n_and_minus_u_before_the_path(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    read(client, photo, numeric=1, unknown=1)
    args = exif_rig.calls()[0]
    assert args[-3:] == ["-n", "-u", str(photo)]


def test_several_reads_share_one_exiftool_process(client, exif_rig, photo):
    exif_rig.tool(RECORD)
    before = runner.STATS["spawned"]
    for _ in range(3):
        assert read(client, photo).status_code == 200
    assert runner.STATS["spawned"] - before == 1
    assert len(exif_rig.calls()) == 3


def test_an_exiftool_that_dies_on_a_file_gives_a_refusal_and_the_next_read_still_works(client, exif_rig, tmp_path, photo):
    exif_rig.tool(RECORD)
    crash = tmp_path / "crash.jpg"
    crash.write_bytes(b"x")
    answer = read(client, crash)
    assert answer.status_code == 503
    assert answer.json()["error"].startswith("ExifTool stopped unexpectedly (")
    assert read(client, photo).status_code == 200


@pytest.mark.parametrize("name", ["garbage.jpg"])
def test_an_answer_that_is_not_json_is_refused(client, exif_rig, tmp_path, name):
    exif_rig.tool(RECORD)
    target = tmp_path / name
    target.write_bytes(b"x")
    answer = read(client, target)
    assert (answer.status_code, answer.json()["error"]) == (400, "ExifTool gave no readable answer for that file")


def test_an_answer_with_no_records_is_refused(client, exif_rig, photo):
    exif_rig.tool("[]")
    answer = read(client, photo)
    assert (answer.status_code, answer.json()["error"]) == (400, "ExifTool gave no readable answer for that file")


def test_an_exiftool_that_takes_too_long_is_stopped_and_refused(exif_rig):
    tool = exif_rig.tool(RECORD)
    with pytest.raises(ApiError) as caught:
        runner.execute((str(tool),), ["-json", "slow.jpg"], timeout=0.4)
    assert (caught.value.status, caught.value.message) == (400, "ExifTool took too long on that file")


def test_the_mcp_read_keeps_only_the_named_groups_and_recounts(exif_rig, photo):
    exif_rig.tool(RECORD)
    result = exif.exif_read_tool({"path": str(photo), "groups": ["gps", "XMP"]})
    assert [g["name"] for g in result["groups"]] == ["XMP-dc", "GPS"]
    assert result["count"] == 2


def test_the_mcp_read_refuses_groups_that_are_not_a_list_of_names(exif_rig, photo):
    with pytest.raises(ApiError) as caught:
        exif.exif_read_tool({"path": str(photo), "groups": "GPS"})
    assert (caught.value.status, caught.value.message) == (400, "groups must be a list of group names")


def test_the_fetch_route_without_perl_is_refused_before_anything_is_downloaded(client, exif_rig):
    answer = client.post("/api/exif/fetch")
    assert (answer.status_code, answer.json()["error"]) == (503, SENTENCE_PERL)
    assert fetch.STATE["fetching"] is False


def test_the_download_address_follows_the_npm_registry_layout_and_the_registry_override(exif_rig, monkeypatch):
    monkeypatch.setenv("FORMTOOLS_EXIFTOOL_REGISTRY", "http://registry.invalid/base/")
    pinned = fetch.package()
    assert fetch.tarball_url() == f"http://registry.invalid/base/{pinned['name']}/-/{pinned['name']}-{pinned['version']}.tgz"


def test_the_integrity_string_is_sha512_in_base64_as_npm_writes_it():
    assert fetch.integrity_of(hashlib.sha512(b"").digest()) == "sha512-z4PhNX7vuL3xVChQ1m2AB9Yg5AULVxXcg/SpIdNs6c5H0NE8XYXysP+DGNKHfuwvY7kxvUdBeoGlODJ6+SfaPg=="


def test_a_download_is_hashed_as_it_is_saved(tmp_path):
    source = tmp_path / "pkg.tgz"
    data = bytes(range(256)) * 1000
    source.write_bytes(data)
    target = tmp_path / "saved.tgz"
    got = fetch.download(source.as_uri(), target, None)
    assert target.read_bytes() == data
    assert got == "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()


def make_tar(path: Path, members: dict, extra=None) -> None:
    with tarfile.open(path, "w:gz") as bundle:
        for name, data in members.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            info.mode = 0o755
            bundle.addfile(info, io.BytesIO(data))
        for info in extra or []:
            bundle.addfile(info)


def library(version: str) -> bytes:
    return f"package Image::ExifTool;\nour $VERSION = '{version}';\n1;\n".encode()


def test_unpacking_a_package_puts_the_script_and_library_in_the_staging_folder(tmp_path):
    pinned = fetch.package()
    archive = tmp_path / "p.tgz"
    make_tar(archive, {"package/bin/" + pinned["script"]: b"#!perl\n", "package/bin/" + pinned["library"]: library(fetch.EXIFTOOL), "package/LICENSE": b"licence"})
    staged = tmp_path / "staged"
    staged.mkdir()
    fetch.unpack(archive, staged)
    fetch.check_library(staged)
    assert (staged / pinned["script"]).read_bytes() == b"#!perl\n"
    assert (staged / "NPM-PACKAGE-LICENSE.txt").read_bytes() == b"licence"


def test_a_package_with_a_path_that_climbs_out_of_the_folder_is_refused(tmp_path):
    archive = tmp_path / "p.tgz"
    make_tar(archive, {"package/bin/../../evil": b"x"})
    staged = tmp_path / "staged"
    staged.mkdir()
    with pytest.raises(ValueError, match="unsafe path"):
        fetch.unpack(archive, staged)
    assert not (tmp_path / "evil").exists()


def test_a_package_holding_a_symbolic_link_is_refused(tmp_path):
    link = tarfile.TarInfo("package/bin/exiftool")
    link.type = tarfile.SYMTYPE
    link.linkname = "/etc/passwd"
    archive = tmp_path / "p.tgz"
    make_tar(archive, {}, extra=[link])
    staged = tmp_path / "staged"
    staged.mkdir()
    with pytest.raises(ValueError, match="link or special file"):
        fetch.unpack(archive, staged)


def test_a_package_of_another_exiftool_version_is_refused_and_names_both_versions(tmp_path):
    pinned = fetch.package()
    archive = tmp_path / "p.tgz"
    make_tar(archive, {"package/bin/" + pinned["script"]: b"x", "package/bin/" + pinned["library"]: library("1.00")})
    staged = tmp_path / "staged"
    staged.mkdir()
    fetch.unpack(archive, staged)
    with pytest.raises(ValueError, match=f"holds ExifTool 1.00, not {fetch.EXIFTOOL}"):
        fetch.check_library(staged)


def test_installing_a_download_whose_hash_differs_from_the_pin_places_nothing(tmp_path):
    archive = tmp_path / "p.tgz"
    make_tar(archive, {"package/bin/exiftool": b"x"})
    where = tmp_path / "out" / "exiftool"
    with pytest.raises(ValueError, match="does not match the pinned integrity"):
        fetch.install(archive, "sha512-AAAA", where)
    assert not where.exists()
