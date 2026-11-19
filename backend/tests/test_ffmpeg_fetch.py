import hashlib
import io
import os
import shutil
import tarfile
from pathlib import Path

import pytest

from app.tools.media import fetch

OLD = "https://github.com/nodemode-dev/formcut-binaries/releases/download"
NEW = "https://github.com/nodemode-dev/formai-binaries/releases/download"


def archive(path: Path, files: dict[str, bytes]) -> None:
    with tarfile.open(path, "w:gz") as bundle:
        for name, data in files.items():
            info = tarfile.TarInfo(f"pkg/{name}")
            info.size = len(data)
            bundle.addfile(info, io.BytesIO(data))


@pytest.fixture
def rig(tmp_path, monkeypatch):
    triple = fetch.host_triple()
    good = {f"ffmpeg-{triple}": b"the pinned ffmpeg", f"ffprobe-{triple}": b"the pinned ffprobe"}
    pins = tuple((name, hashlib.sha256(data).hexdigest()) for name, data in good.items())
    monkeypatch.setitem(fetch.FILES, triple, pins)
    monkeypatch.setenv("XDG_DATA_HOME", str(tmp_path / "share"))
    monkeypatch.setenv("HOME", str(tmp_path))
    monkeypatch.setenv("LOCALAPPDATA", str(tmp_path / "share"))
    monkeypatch.delenv("FORMCUT_FFMPEG_RELEASE", raising=False)
    monkeypatch.setenv("PATH", os.environ.get("PATH", ""))
    made = {"good": tmp_path / "good.tar.gz", "bad": tmp_path / "bad.tar.gz"}
    archive(made["good"], good)
    archive(made["bad"], {**good, f"ffmpeg-{triple}": b"not what the record says"})
    served: list[str] = []

    def serve(table: dict[str, str]):
        def download(url: str, target: Path) -> None:
            served.append(url)
            answer = table.get(url.split("/releases/")[0])
            if answer is None:
                raise OSError("HTTP Error 404: Not Found")
            shutil.copy(made[answer], target)

        monkeypatch.setattr(fetch, "_download", download)

    return serve, served


def test_the_new_address_comes_first_and_the_old_one_second():
    assert fetch.SOURCES == (NEW, OLD)
    urls = fetch.sources()
    assert [u.split("/releases/")[0] for u in urls] == [NEW.split("/releases/")[0], OLD.split("/releases/")[0]]
    assert all(u.endswith(f"/ffmpeg-{fetch.RELEASE}/ffmpeg-lgpl-{fetch.RELEASE}-{fetch.host_triple()}.tar.gz") for u in urls)


def test_the_override_is_the_only_source_when_set(monkeypatch):
    monkeypatch.setenv("FORMCUT_FFMPEG_RELEASE", "http://127.0.0.1:1/mirror/")
    assert fetch.sources() == [f"http://127.0.0.1:1/mirror/ffmpeg-lgpl-{fetch.RELEASE}-{fetch.host_triple()}.tar.gz"]


def test_the_install_folder_name_did_not_change():
    assert fetch.folder().parts[-2:] == ("formcut-binaries", f"ffmpeg-{fetch.RELEASE}")


def test_an_address_that_does_not_answer_falls_back_to_the_old_one(rig):
    serve, served = rig
    serve({OLD.split("/releases/")[0]: "good"})
    assert fetch.fetch() is not None
    assert len(served) == 2 and served[0].startswith(NEW) and served[1].startswith(OLD)
    assert (fetch.folder() / f"ffmpeg-{fetch.host_triple()}").read_bytes() == b"the pinned ffmpeg"


def test_bytes_that_do_not_match_the_record_try_the_next_address_and_install_nothing_from_them(rig):
    serve, served = rig
    serve({NEW.split("/releases/")[0]: "bad", OLD.split("/releases/")[0]: "good"})
    fetch.fetch()
    assert len(served) == 2
    assert (fetch.folder() / f"ffmpeg-{fetch.host_triple()}").read_bytes() == b"the pinned ffmpeg"


def test_when_every_address_answers_with_wrong_bytes_nothing_is_installed(rig):
    serve, served = rig
    serve({NEW.split("/releases/")[0]: "bad", OLD.split("/releases/")[0]: "bad"})
    with pytest.raises(ValueError, match="does not match the record"):
        fetch.fetch()
    assert not fetch.folder().exists()
