#!/usr/bin/env python3
"""Record the engine's answers for the three browser demo pages.

Run the engine (./formtools backend, or any port with FORMTOOLS_PORT), then from the
repository root, with the engine's Python:

    python -B scripts/demo-record.py --engine http://127.0.0.1:8240

The engine makes its demo folders if they are missing. For each demo the script asks the
engine what the window asks when the folder is browsed, its files are opened and the
read-only tools run on it, rewrites the data folder to /demo, refuses to write anything
that still names this computer, and writes assets/recording.js beside the page.
"""
import argparse
import base64
import getpass
import hashlib
import io
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAGES = {"photos": ROOT / "demo", "family": ROOT / "demos" / "family", "bench": ROOT / "demos" / "bench"}
PUBLIC = "/demo"
IGNORED = {"v", "size", "max", "points", "limit", "hidden"}
NATIVE_IMAGE = {"jpg", "jpeg", "jpe", "jfif", "png", "apng", "gif", "webp", "bmp", "svg"}
NATIVE_MODEL = {"glb", "gltf", "obj", "stl", "ply", "fbx", "3mf", "dae", "usdz"}
TEXT_KINDS = {"text"}
CSV = {"csv", "tsv", "tab"}
SQLITE = {"sqlite", "sqlite3", "db", "db3", "s3db"}
VIEW_MAX = 1024
RAW_LIMIT = 160_000
COVER = (640, 480)


def canon(value) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def key(method: str, path: str, params: dict | None = None, body=None) -> str:
    pairs = sorted((k, str(v)) for k, v in (params or {}).items() if k not in IGNORED)
    out = f"{method} {path}" + ("?" + "&".join(f"{k}={v}" for k, v in pairs) if pairs else "")
    return out + (" " + canon(body) if body is not None else "")


class Engine:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def call(self, method: str, path: str, params: dict | None = None, body=None) -> tuple[int, str, bytes]:
        url = self.base + path + ("?" + urllib.parse.urlencode(params, quote_via=urllib.parse.quote) if params else "")
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"} if data else {})
        try:
            with urllib.request.urlopen(req, timeout=300) as res:
                return res.status, res.headers.get_content_type(), res.read()
        except urllib.error.HTTPError as err:
            return err.code, err.headers.get_content_type(), err.read()

    def json(self, method: str, path: str, params: dict | None = None, body=None) -> tuple[int, object]:
        status, _, raw = self.call(method, path, params, body)
        return status, json.loads(raw or b"null")


class Recording:
    def __init__(self, demo: str, engine: Engine, made: str) -> None:
        self.demo = demo
        self.engine = engine
        self.real_root = made
        self.real_base = os.path.dirname(made)
        self.root = f"{PUBLIC}/{demo}"
        self.answers: dict[str, dict] = {}
        self.bin: list[str] = []
        self.seen: dict[str, int] = {}
        self.jobs = 0
        user = getpass.getuser()
        self.leaks = [s for s in {self.real_base, os.path.expanduser("~"), os.path.dirname(self.real_base)} if len(s) > 1]
        self.leaks += [f"/{user}/", f"\\{user}\\"] if len(user) > 2 else []

    def pub(self, text: str) -> str:
        for real in (self.real_base, json.dumps(self.real_base)[1:-1]):
            text = text.replace(real, PUBLIC)
        return text

    def real(self, path: str) -> str:
        return self.real_base + path[len(PUBLIC):] if path.startswith(PUBLIC) else path

    def clean(self, value):
        text = self.pub(json.dumps(value, ensure_ascii=False))
        for leak in self.leaks:
            if leak in text:
                sys.exit(f"{self.demo}: an answer still names this computer ({leak!r}); nothing was written")
        return json.loads(text)

    def blob(self, data: bytes) -> int:
        for leak in self.leaks:
            if leak.encode() in data:
                sys.exit(f"{self.demo}: a file answer names this computer ({leak!r}); nothing was written")
        digest = hashlib.sha256(data).hexdigest()
        if digest not in self.seen:
            self.seen[digest] = len(self.bin)
            self.bin.append(base64.b64encode(data).decode())
        return self.seen[digest]

    def put(self, k: str, status: int, ctype: str, data: bytes) -> None:
        if ctype == "application/json":
            self.answers[k] = {"s": status, "j": self.clean(json.loads(data or b"null"))}
        else:
            self.answers[k] = {"s": status, "t": ctype, "b": self.blob(data)}

    def to_real(self, value):
        if isinstance(value, str):
            return self.real(value) if value == PUBLIC or value.startswith(PUBLIC + "/") else value
        if isinstance(value, list):
            return [self.to_real(v) for v in value]
        if isinstance(value, dict):
            return {k: self.to_real(v) for k, v in value.items()}
        return value

    def get(self, path: str, params: dict | None = None) -> tuple[int, str, bytes]:
        status, ctype, data = self.engine.call("GET", path, self.to_real(params or {}))
        self.put(key("GET", path, params), status, ctype, data)
        return status, ctype, data

    def smaller(self, path: str, params: dict, file: str) -> None:
        status, ctype, data = self.engine.call("GET", "/api/image/view", {"path": self.real(file), "max": VIEW_MAX})
        self.put(key("GET", path, params), status, ctype, data)

    def job(self, path: str, body: dict) -> None:
        status, started = self.engine.json("POST", path, body=self.to_real(body))
        if status != 200 or not isinstance(started, dict) or "id" not in started:
            sys.exit(f"{self.demo}: {path} did not start ({status}: {started})")
        end = started
        for _ in range(600):
            if end.get("state") != "running":
                break
            time.sleep(0.25)
            _, end = self.engine.json("GET", f"/api/jobs/{started['id']}")
        self.jobs += 1
        end = dict(end, id=f"rec-{self.demo}-{self.jobs}")
        self.answers[key("POST", path, body=body)] = {"s": 200, "j": self.clean(end)}
        self.answers[key("GET", f"/api/jobs/{end['id']}")] = {"s": 200, "j": self.clean(end)}


def listing(rec: Recording, path: str) -> list[dict]:
    status, _, data = rec.get("/api/fs/list", {"path": path, "hidden": 0})
    if status != 200:
        sys.exit(f"{rec.demo}: the engine could not list {path}")
    entries = rec.answers[key("GET", "/api/fs/list", {"path": path})]["j"]["entries"]
    rec.get("/api/fs/dirs", {"path": path, "hidden": 0})
    files = []
    for e in entries:
        files += listing(rec, e["path"]) if e["kind"] == "dir" else [e]
    return files


def record_file(rec: Recording, e: dict) -> None:
    p, t, ext = e["path"], e["type"], e["ext"]
    if t in ("image", "family"):
        rec.get("/api/image/thumb", {"path": p, "size": 320})
        rec.get("/api/image/info", {"path": p})
        if t == "image" and ext in NATIVE_IMAGE:
            if e["size"] > RAW_LIMIT:
                rec.smaller("/api/file/raw", {"path": p}, p)
            else:
                rec.get("/api/file/raw", {"path": p})
        else:
            rec.smaller("/api/image/view", {"path": p}, p)
    elif t in ("video", "audio"):
        rec.get("/api/media/thumb", {"path": p, "size": 320})
        rec.get("/api/media/info", {"path": p})
        rec.get("/api/file/raw", {"path": p})
        if t == "audio":
            rec.get("/api/media/waveform", {"path": p, "points": 1200})
        else:
            rec.get("/api/media/subtitles", {"path": p})
    elif t == "model":
        rec.get("/api/model/info", {"path": p})
        rec.get("/api/file/raw" if ext in NATIVE_MODEL else "/api/model/view", {"path": p})
    elif t in ("pdf", "font") or ext not in CSV | SQLITE and t not in TEXT_KINDS and t != "archive":
        if t == "font":
            rec.get("/api/font/info", {"path": p})
        if t in ("pdf", "font") or e["size"] <= RAW_LIMIT:
            rec.get("/api/file/raw", {"path": p})
    if ext in CSV:
        rec.get("/api/data/csv", {"path": p, "limit": 5000})
    elif ext in SQLITE:
        _, tables = rec.engine.json("GET", "/api/data/sqlite/tables", {"path": rec.real(p)})
        rec.get("/api/data/sqlite/tables", {"path": p})
        for table in (tables or {}).get("tables", []):
            rec.get("/api/data/sqlite/rows", {"path": p, "table": table["name"], "offset": 0, "limit": 200})
    elif t in TEXT_KINDS:
        rec.get("/api/text", {"path": p, "max": 2097152})
    elif t == "archive":
        rec.get("/api/archive/list", {"path": p, "limit": 20000})


def covers(rec: Recording) -> None:
    for demo in PAGES:
        status, _, data = rec.engine.call("GET", f"/api/demos/{demo}/cover.png")
        if status != 200:
            continue
        out = io.BytesIO()
        Image.open(io.BytesIO(data)).convert("RGB").resize(COVER).save(out, "WEBP", quality=72, method=6)
        rec.put(key("GET", f"/api/demos/{demo}/cover.png"), 200, "image/webp", out.getvalue())


def record(engine: Engine, demo: str) -> Recording:
    status, made = engine.json("POST", f"/api/demos/{demo}")
    if status != 200:
        sys.exit(f"{demo}: the engine could not make the demo ({made})")
    rec = Recording(demo, engine, made["path"])
    rec.answers[key("POST", f"/api/demos/{demo}")] = {"s": 200, "j": rec.clean(made)}
    _, base = engine.json("GET", "/api/fs/list", {"path": rec.real_base, "hidden": 0})
    own = [e for e in base["entries"] if e["name"] == demo]
    rec.answers[key("GET", "/api/fs/list", {"path": PUBLIC})] = {"s": 200, "j": rec.clean({"path": rec.real_base, "parent": "/", "entries": own})}
    _, dirs = engine.json("GET", "/api/fs/dirs", {"path": rec.real_base, "hidden": 0})
    rec.answers[key("GET", "/api/fs/dirs", {"path": PUBLIC})] = {"s": 200, "j": rec.clean({"path": rec.real_base, "dirs": [d for d in dirs["dirs"] if d["name"] == demo]})}
    rec.answers[key("GET", "/api/fs/dirs", {"path": "/"})] = {"s": 200, "j": {"path": "/", "dirs": [{"name": PUBLIC[1:], "path": PUBLIC, "has_children": True}]}}
    top = {"name": PUBLIC[1:], "path": PUBLIC, "kind": "dir", "ext": "", "size": 0, "mtime": own[0]["mtime"], "type": "other"}
    rec.answers[key("GET", "/api/fs/list", {"path": "/"})] = {"s": 200, "j": {"path": "/", "parent": None, "entries": [top]}}
    files = listing(rec, rec.root)
    for e in files:
        record_file(rec, e)
    rec.answers[key("POST", "/api/meta/read")] = {"s": 200, "j": rec.clean(engine.json("POST", "/api/meta/read", body={"paths": [rec.real(e["path"]) for e in files]})[1])}
    covers(rec)
    rec.get("/api/batch/actions")
    rec.get("/api/batch/presets")
    rec.job("/api/diskusage/scan", {"root": rec.root, "include_hidden": False})
    rec.job("/api/hash", {"paths": [rec.root], "algorithms": ["sha256", "blake3"]})
    if demo == "photos":
        for mode in ("exact", "similar-images"):
            rec.job("/api/dupes/scan", {"roots": [rec.root], "recursive": True, "min_size": 1, "mode": mode, "threshold": 6, "include_hidden": False})
        rec.job("/api/files/broken", {"root": rec.root})
        rec.job("/api/files/empty-folders", {"root": rec.root})
    if demo == "family":
        rec.job("/api/hash/verify", {"path": f"{rec.root}/SHA256SUMS"})
    return rec


def write(rec: Recording) -> Path:
    out = PAGES[rec.demo] / "assets" / "recording.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    body = {
        "demo": rec.demo,
        "root": rec.root,
        "home": {"home": rec.root, "roots": [{"name": "Demo", "path": PUBLIC}]},
        "answers": dict(sorted(rec.answers.items())),
        "bin": rec.bin,
    }
    out.write_text(f"window.FT_RECORDING = {json.dumps(body, ensure_ascii=True, separators=(',', ':'))};\n", encoding="utf-8")
    return out


def main() -> int:
    parser = argparse.ArgumentParser(prog="demo-record", description="record the engine's answers for the browser demo pages")
    parser.add_argument("--engine", default=f"http://127.0.0.1:{os.environ.get('FORMTOOLS_PORT', '8240')}")
    parser.add_argument("demos", nargs="*", help=f"any of {', '.join(PAGES)} (all when none is named)")
    args = parser.parse_args()
    unknown = [d for d in args.demos if d not in PAGES]
    if unknown:
        parser.error(f"there is no demo called {', '.join(unknown)}")
    engine = Engine(args.engine)
    for demo in args.demos or list(PAGES):
        out = write(record(engine, demo))
        print(f"{out.relative_to(ROOT)}  {out.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
