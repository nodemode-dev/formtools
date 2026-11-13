import errno
import hashlib
import ipaddress
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime
from pathlib import Path

from app.core import config
from app.core.errors import ApiError
from app.tools.desktop import elevate

LABEL = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$")
LINES = re.compile(r"[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+")
MAX_BYTES = 8_000_000
MAX_ENTRIES = 20000
BOM = b"\xef\xbb\xbf"
STALE = "the hosts file changed since it was read; reload it and try again"


def hosts_path() -> Path:
    raw = os.environ.get("FORMTOOLS_HOSTS_PATH", "").strip()
    if raw:
        return Path(raw).expanduser()
    if sys.platform.startswith("win"):
        root = os.environ.get("SystemRoot") or r"C:\Windows"
        return Path(root) / "System32" / "drivers" / "etc" / "hosts"
    return Path("/etc/hosts")


def valid_address(text: str) -> bool:
    try:
        ipaddress.ip_address(text)
    except ValueError:
        return False
    return True


def valid_name(name: str) -> bool:
    if not name or len(name) > 253:
        return False
    return all(LABEL.match(label) for label in name.split("."))


def parse_body(body: str) -> dict | None:
    text = body.strip()
    enabled = True
    if text.startswith("#"):
        enabled = False
        text = text[1:].strip()
    if not text:
        return None
    code, _, comment = text.partition("#")
    parts = code.split()
    if len(parts) < 2 or not valid_address(parts[0]):
        return None
    names = parts[1:]
    if not all(valid_name(name) for name in names):
        return None
    return {"enabled": enabled, "address": parts[0], "names": names, "comment": comment.strip()}


def split_terminator(piece: str) -> tuple[str, str]:
    for eol in ("\r\n", "\n", "\r"):
        if piece.endswith(eol):
            return piece[: -len(eol)], eol
    return piece, ""


class Snapshot:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.exists = path.exists()
        data = b""
        if self.exists:
            try:
                if path.stat().st_size > MAX_BYTES:
                    raise ApiError(400, "that hosts file is larger than 8 MB")
                data = path.read_bytes()
            except PermissionError:
                raise ApiError(403, "formtools is not allowed to read the hosts file")
            except OSError as exc:
                raise ApiError(500, f"the hosts file could not be read ({exc.strerror or type(exc).__name__})")
        self.data = data
        self.version = hashlib.sha256(data).hexdigest()
        self.bom = data.startswith(BOM)
        body = data[len(BOM):] if self.bom else data
        try:
            self.text = body.decode("utf-8")
            self.encoding = "utf-8"
        except UnicodeDecodeError:
            self.text = body.decode("latin-1")
            self.encoding = "latin-1"
        self.lines = [split_terminator(piece) for piece in LINES.findall(self.text)]
        self.entries: list[dict] = []
        for number, (body_text, _) in enumerate(self.lines, start=1):
            parsed = parse_body(body_text)
            if parsed:
                self.entries.append({"line": number, **parsed})

    def default_eol(self) -> str:
        crlf = sum(1 for _, eol in self.lines if eol == "\r\n")
        lf = sum(1 for _, eol in self.lines if eol == "\n")
        if crlf or lf:
            return "\r\n" if crlf > lf else "\n"
        return "\r\n" if sys.platform.startswith("win") else "\n"

    def encode(self, text: str) -> bytes:
        raw = text.encode(self.encoding)
        return BOM + raw if self.bom else raw


def writable(path: Path) -> bool:
    try:
        if path.exists():
            with open(path, "r+b"):
                pass
            return True
        return os.access(path.parent, os.W_OK)
    except OSError:
        return False


def read() -> dict:
    snap = Snapshot(hosts_path())
    return {"path": str(snap.path), "writable": writable(snap.path), "entries": snap.entries, "raw": snap.text, "version": snap.version}


def clean_entry(entry: dict) -> dict:
    address = str(entry.get("address", "")).strip()
    if not valid_address(address):
        raise ApiError(400, f"{address or 'an empty value'} is not a valid IPv4 or IPv6 address")
    raw_names = entry.get("names") or []
    names: list[str] = []
    for item in raw_names:
        names.extend(str(item).split())
    if not names:
        raise ApiError(400, f"the entry for {address} needs at least one host name")
    for name in names:
        if not valid_name(name):
            raise ApiError(400, f"{name} is not a valid host name")
    comment = str(entry.get("comment") or "").strip()
    if "\n" in comment or "\r" in comment:
        raise ApiError(400, "a comment must stay on one line")
    return {"enabled": bool(entry.get("enabled", True)), "address": address, "names": names, "comment": comment}


def format_entry(entry: dict, indent: str = "") -> str:
    text = f"{indent}{'' if entry['enabled'] else '# '}{entry['address']}\t{' '.join(entry['names'])}"
    if entry["comment"]:
        text += f"  # {entry['comment']}"
    return text


def same(left: dict, right: dict) -> bool:
    return all(left[key] == right[key] for key in ("enabled", "address", "names", "comment"))


def build(snap: Snapshot, entries: list[dict]) -> bytes:
    existing = {item["line"]: item for item in snap.entries}
    kept: set[int] = set()
    changed: dict[int, str] = {}
    added: list[dict] = []
    for raw in entries:
        entry = clean_entry(raw)
        line = raw.get("line")
        if line is None:
            added.append(entry)
            continue
        if line not in existing:
            raise ApiError(400, STALE)
        if line in kept:
            raise ApiError(400, f"line {line} appears twice in the request")
        kept.add(line)
        if not same(entry, existing[line]):
            body = snap.lines[line - 1][0]
            changed[line] = format_entry(entry, body[: len(body) - len(body.lstrip())])
    dropped = set(existing) - kept
    rows: list[list[str]] = []
    for number, (body, eol) in enumerate(snap.lines, start=1):
        if number in dropped:
            continue
        rows.append([changed.get(number, body), eol])
    eol = snap.default_eol()
    if added and rows and not rows[-1][1]:
        rows[-1][1] = eol
    for entry in added:
        rows.append([format_entry(entry), eol])
    return snap.encode("".join(body + ending for body, ending in rows))


def backup(snap: Snapshot) -> str | None:
    if not snap.exists:
        return None
    folder = config.data_dir() / "hosts-backups"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    target = folder / f"hosts-{stamp}.bak"
    counter = 2
    while target.exists():
        target = folder / f"hosts-{stamp}-{counter}.bak"
        counter += 1
    target.write_bytes(snap.data)
    return str(target)


def write_in_place(path: Path, data: bytes) -> None:
    with open(path, "r+b" if path.exists() else "wb") as handle:
        handle.seek(0)
        handle.write(data)
        handle.truncate()
        handle.flush()
        os.fsync(handle.fileno())


def write_direct(path: Path, data: bytes) -> None:
    if not path.exists():
        write_in_place(path, data)
        return
    handle, temp = tempfile.mkstemp(dir=str(path.parent), prefix=".hosts-")
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        shutil.copymode(path, temp)
        if hasattr(os, "chown"):
            try:
                info = path.stat()
                os.chown(temp, info.st_uid, info.st_gid)
            except OSError:
                pass
        os.replace(temp, path)
    except OSError:
        try:
            os.unlink(temp)
        except OSError:
            pass
        write_in_place(path, data)


def save(entries: list[dict], version: str | None = None) -> dict:
    if len(entries) > MAX_ENTRIES:
        raise ApiError(400, "that is more entries than formtools will write")
    snap = Snapshot(hosts_path())
    if version and version != snap.version:
        raise ApiError(409, STALE)
    data = build(snap, entries)
    if snap.exists and data == snap.data:
        return {"ok": True, "backup": None, "elevated": False, "changed": False}
    saved = backup(snap)
    elevated = False
    if writable(snap.path):
        try:
            write_direct(snap.path, data)
        except PermissionError:
            elevated = True
        except OSError as exc:
            if exc.errno == errno.EROFS:
                raise ApiError(400, "the hosts file is on a read-only volume")
            raise ApiError(500, f"the hosts file could not be written ({exc.strerror or type(exc).__name__})")
    else:
        elevated = True
    if elevated:
        elevate.write_file(snap.path, data)
    return {"ok": True, "backup": saved, "elevated": elevated, "changed": True}
