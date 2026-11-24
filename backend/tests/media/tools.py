import json
import os
import sys
from collections import OrderedDict
from pathlib import Path

import pytest

FFPROBE = """#!{py}
import json, os, sys
log = os.environ.get("FAKE_LOG")
if log:
    open(log, "a").write(json.dumps(["ffprobe"] + sys.argv[1:]) + "\\n")
code = int(os.environ.get("FAKE_PROBE_CODE", "0"))
if code:
    sys.exit(code)
sys.stdout.write(open(os.environ["FAKE_PROBE_JSON"]).read())
"""

FFMPEG = """#!{py}
import json, os, sys
args = sys.argv[1:]
if args[:2] == ["-hide_banner", "-version"]:
    print("ffmpeg version " + os.environ.get("FAKE_VERSION", "1.2.3") + " Copyright (c) test")
    sys.exit(0)
log = os.environ.get("FAKE_LOG")
if log:
    open(log, "a").write(json.dumps(["ffmpeg"] + args) + "\\n")
if os.environ.get("FAKE_FFMPEG_FAIL"):
    sys.stderr.write(os.environ["FAKE_FFMPEG_FAIL"] + "\\n")
    sys.exit(1)
payload = b""
if os.environ.get("FAKE_PAYLOAD"):
    payload = open(os.environ["FAKE_PAYLOAD"], "rb").read()
last = args[-1]
if "-progress" in args:
    sys.stdout.write("out_time_us=2500000\\nprogress=continue\\n")
    sys.stdout.flush()
if last == "pipe:1":
    sys.stdout.buffer.write(payload)
    sys.stdout.buffer.flush()
else:
    open(last, "wb").write(payload)
"""

EXIFTOOL = """#!{py}
import json, os, sys, time
args = sys.argv[1:]
if args == ["-ver"]:
    print(os.environ.get("FAKE_EXIF_VERSION", "12.76"))
    sys.exit(0)
log = os.environ.get("FAKE_EXIF_LOG")
pending = []
lines = iter(sys.stdin.readline, "")
for line in lines:
    line = line.rstrip("\\n")
    if line == "-stay_open":
        sys.stdin.readline()
        break
    if not line.startswith("-execute"):
        pending.append(line)
        continue
    seq = line[len("-execute"):]
    name = os.path.basename(pending[-1])
    if log:
        open(log, "a").write(json.dumps(pending) + "\\n")
    if "crash" in name:
        sys.stderr.write("boom\\n")
        sys.stderr.flush()
        os._exit(1)
    if "slow" in name:
        time.sleep(3)
    if "garbage" in name:
        body = "this is not json"
    else:
        body = open(os.environ["FAKE_EXIF_JSON"]).read()
    sys.stdout.write(body + "\\n{ready" + seq + "}\\n")
    sys.stdout.flush()
    pending = []
"""


def script(folder: Path, name: str, body: str) -> Path:
    target = folder / name
    target.write_text(body.replace("{py}", sys.executable), encoding="utf-8")
    target.chmod(0o755)
    return target


def stream(index, kind, codec, **more) -> dict:
    return {"index": index, "codec_type": kind, "codec_name": codec, **more}


def video(index=0, codec="h264", **more) -> dict:
    return stream(index, "video", codec, **{"width": 1920, "height": 1080, "avg_frame_rate": "30/1", "pix_fmt": "yuv420p", **more})


def audio(index=1, codec="aac", **more) -> dict:
    return stream(index, "audio", codec, **{"channels": 2, "channel_layout": "stereo", "sample_rate": "48000", **more})


def probe_doc(streams, names="mov,mp4,m4a,3gp,3g2,mj2", duration="10.000000", chapters=None, tags=None) -> dict:
    return {
        "streams": streams,
        "format": {"format_name": names, "format_long_name": "x", "duration": duration, "bit_rate": "1000", "size": "5", "tags": tags or {}},
        "chapters": chapters or [],
    }


class Rig:
    def __init__(self, folder: Path, monkeypatch) -> None:
        self.folder = folder
        self.bin = folder / "bin"
        self.bin.mkdir()
        self.work = folder / "work"
        self.work.mkdir()
        self.log = folder / "calls.log"
        self.mp = monkeypatch
        monkeypatch.setenv("PATH", str(self.bin))
        monkeypatch.setenv("HOME", str(folder / "home"))
        monkeypatch.setenv("XDG_DATA_HOME", str(folder / "share"))
        monkeypatch.setenv("LOCALAPPDATA", str(folder / "share"))
        monkeypatch.setenv("FORMTOOLS_DATA_DIR", str(folder / "data"))
        monkeypatch.setenv("FAKE_LOG", str(self.log))
        for name in ("FAKE_FFMPEG_FAIL", "FAKE_PAYLOAD", "FAKE_PROBE_CODE", "FAKE_VERSION", "FORMCUT_FFMPEG_RELEASE"):
            monkeypatch.delenv(name, raising=False)
        from app.tools.media import exe, fetch, probe

        monkeypatch.setitem(fetch.STATE, "fetching", False)
        monkeypatch.setitem(fetch.STATE, "error", None)
        monkeypatch.setattr(exe, "_versions", {})
        monkeypatch.setattr(probe, "_cache", OrderedDict())
        self.count = 0

    def ffmpeg(self, payload: bytes | None = None, fail: str | None = None) -> None:
        script(self.bin, "ffmpeg", FFMPEG)
        if payload is not None:
            holder = self.folder / "payload.bin"
            holder.write_bytes(payload)
            self.mp.setenv("FAKE_PAYLOAD", str(holder))
        if fail:
            self.mp.setenv("FAKE_FFMPEG_FAIL", fail)

    def ffprobe(self, doc: dict) -> None:
        script(self.bin, "ffprobe", FFPROBE)
        holder = self.folder / "probe.json"
        holder.write_text(json.dumps(doc), encoding="utf-8")
        self.mp.setenv("FAKE_PROBE_JSON", str(holder))

    def file(self, name: str, data: bytes = b"media") -> Path:
        target = self.work / name
        target.write_bytes(data)
        return target

    def calls(self, program: str) -> list[list[str]]:
        if not self.log.exists():
            return []
        rows = [json.loads(line) for line in self.log.read_text(encoding="utf-8").splitlines()]
        return [row[1:] for row in rows if row[0] == program]


@pytest.fixture
def rig(tmp_path, monkeypatch):
    return Rig(tmp_path, monkeypatch)


class ExifRig:
    def __init__(self, folder: Path, monkeypatch) -> None:
        self.folder = folder
        self.bin = folder / "bin"
        self.bin.mkdir()
        self.mp = monkeypatch
        self.log = folder / "exif.log"
        monkeypatch.setenv("PATH", str(self.bin))
        monkeypatch.setenv("FORMTOOLS_DATA_DIR", str(folder / "data"))
        monkeypatch.setenv("FAKE_EXIF_LOG", str(self.log))
        for name in ("FORMTOOLS_EXIFTOOL", "FORMTOOLS_EXIFTOOL_REGISTRY", "FAKE_EXIF_VERSION"):
            monkeypatch.delenv(name, raising=False)
        from app.tools.exif import fetch, locate

        monkeypatch.setitem(fetch.STATE, "fetching", False)
        monkeypatch.setitem(fetch.STATE, "error", None)
        monkeypatch.setitem(fetch.STATE, "job", None)
        monkeypatch.setattr(locate, "_versions", {})

    def perl(self) -> Path:
        return script(self.bin, "perl", '#!/bin/sh\nexec "{py}" "$@"\n')

    def tool(self, answer: dict | str, where: Path | None = None, name: str = "exiftool") -> Path:
        target = script(where or self.bin, name, EXIFTOOL)
        holder = self.folder / "answer.json"
        holder.write_text(answer if isinstance(answer, str) else json.dumps([answer]), encoding="utf-8")
        self.mp.setenv("FAKE_EXIF_JSON", str(holder))
        return target

    def calls(self) -> list[list[str]]:
        if not self.log.exists():
            return []
        return [json.loads(line) for line in self.log.read_text(encoding="utf-8").splitlines()]


@pytest.fixture
def exif_rig(tmp_path, monkeypatch):
    from app.tools.exif import runner

    made = ExifRig(tmp_path, monkeypatch)
    yield made
    runner.stop()


def wait_job(client, job_id: str) -> dict:
    import time

    for _ in range(250):
        body = client.get(f"/api/jobs/{job_id}").json()
        if body["state"] != "running":
            return body
        time.sleep(0.02)
    raise AssertionError("the job did not finish")
