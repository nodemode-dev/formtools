import itertools
import os
import re
import sys
import uuid
from pathlib import Path

from app.core.errors import ApiError

MAX_BYTES = 20 * 1024**3
MAX_RATIO = 1000
CHUNK = 1024 * 1024
DRIVE = re.compile(r"^[A-Za-z]:")
WINDOWS = sys.platform.startswith("win")


def limit_bytes() -> int:
    raw = os.environ.get("FORMTOOLS_ARCHIVE_MAX_BYTES", "").strip()
    return int(raw) if raw.isdigit() and int(raw) > 0 else MAX_BYTES


def limit_ratio() -> int:
    raw = os.environ.get("FORMTOOLS_ARCHIVE_MAX_RATIO", "").strip()
    return int(raw) if raw.isdigit() and int(raw) > 0 else MAX_RATIO


class Refused(Exception):
    pass


def split_name(name: str) -> list[str]:
    if not name or "\x00" in name:
        raise Refused("the name is empty or has a null character")
    if name[0] in "/\\":
        raise Refused("the name is absolute")
    if DRIVE.match(name):
        raise Refused("the name starts with a drive letter")
    parts = [part for part in re.split(r"[\\/]+", name) if part and part != "."]
    if not parts:
        raise Refused("the name has no usable part")
    for part in parts:
        if part == "..":
            raise Refused("the name climbs out of the destination with ..")
        if WINDOWS and ":" in part:
            raise Refused("the name has a colon")
    return parts


class Budget:
    def __init__(self, archive_size: int) -> None:
        self.cap = limit_bytes()
        self.ratio_cap = limit_ratio() * max(1, archive_size)
        self.ratio = limit_ratio()
        self.used = 0

    def room(self) -> int:
        return min(self.cap, self.ratio_cap) - self.used

    def declared(self, size: int | None) -> None:
        if size is not None and size > self.room():
            self.fail()

    def add(self, count: int) -> None:
        self.used += count
        if self.used > min(self.cap, self.ratio_cap):
            self.fail()

    def fail(self) -> None:
        if self.cap <= self.ratio_cap:
            raise ApiError(400, "extraction stopped because the archive expands past the size limit")
        raise ApiError(400, f"extraction stopped because the archive expands more than {self.ratio} times its own size, which looks like a zip bomb")


_counter = itertools.count(1)


def unique(path: Path) -> Path:
    if not os.path.lexists(path):
        return path
    stem, suffix = path.stem, path.suffix
    lowered = path.name.lower()
    cut = lowered.rfind(".tar.")
    if cut > 0:
        stem, suffix = path.name[:cut], path.name[cut:]
    number = 2
    while True:
        candidate = path.with_name(f"{stem} ({number}){suffix}")
        if not os.path.lexists(candidate):
            return candidate
        number += 1


def temp_beside(folder: Path) -> Path:
    return folder / f".formtools-{os.getpid()}-{next(_counter)}-{uuid.uuid4().hex[:8]}.part"


def place(temp: Path, wanted: Path) -> Path:
    final = wanted
    while True:
        try:
            os.link(temp, final)
        except FileExistsError:
            final = unique(final)
            continue
        except OSError:
            break
        try:
            os.unlink(temp)
        except OSError:
            pass
        return final
    while True:
        final = unique(final)
        try:
            if not os.path.lexists(final):
                os.rename(temp, final)
                return final
        except FileExistsError:
            continue
        except OSError as exc:
            raise ApiError(400, f"a file could not be written ({exc.strerror or 'error'})")


def discard(temp: Path) -> None:
    try:
        os.unlink(temp)
    except OSError:
        pass


def inside(root: str, candidate: str) -> bool:
    root = os.path.normcase(root)
    candidate = os.path.normcase(candidate)
    return candidate == root or candidate.startswith(root.rstrip(os.sep) + os.sep)


def safe_folder(root: Path, parts: list[str]) -> Path:
    real_root = os.path.realpath(root)
    current = Path(real_root)
    for part in parts:
        current = current / part
        if os.path.islink(current):
            raise Refused("a folder on the way is a symbolic link")
        if not os.path.lexists(current):
            os.mkdir(current)
        elif not os.path.isdir(current):
            raise Refused("a file is in the way of a folder")
    if not inside(real_root, os.path.realpath(current)):
        raise Refused("the folder resolves outside the destination")
    return current


def prepare_target(root: Path, parts: list[str]) -> Path:
    folder = safe_folder(root, parts[:-1])
    return folder / parts[-1]
