import os
import re
import stat
import sys
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.errors import ApiError
from app.core.filetypes import classify, content_type, ext_of

router = APIRouter(prefix="/api")

NATURAL = re.compile(r"(\d+)")
HOME_FOLDERS = ("Desktop", "Documents", "Downloads", "Pictures", "Movies", "Videos", "Music")


def natural_key(name: str) -> list:
    return [int(part) if part.isdigit() else part.casefold() for part in NATURAL.split(name)]


def absolute(raw: str) -> Path:
    if not raw or "\x00" in raw:
        raise ApiError(400, "a path is needed")
    path = Path(raw)
    if not path.is_absolute():
        raise ApiError(400, "the path must be absolute")
    return path


def is_hidden(entry: os.DirEntry, info: os.stat_result | None) -> bool:
    if entry.name.startswith("."):
        return True
    attributes = getattr(info, "st_file_attributes", 0) if info else 0
    return bool(attributes & getattr(stat, "FILE_ATTRIBUTE_HIDDEN", 0x2))


def windows_drives() -> list[dict]:
    import ctypes

    mask = ctypes.windll.kernel32.GetLogicalDrives()
    drives = []
    for index in range(26):
        if mask & (1 << index):
            letter = chr(ord("A") + index)
            drives.append({"name": f"{letter}:", "path": f"{letter}:\\"})
    return drives


def mounted_volumes() -> list[dict]:
    if sys.platform.startswith("win"):
        return windows_drives()
    parents = []
    if sys.platform == "darwin":
        parents = [Path("/Volumes")]
    else:
        user = os.environ.get("USER") or os.environ.get("LOGNAME") or ""
        parents = [Path("/media") / user, Path("/run/media") / user, Path("/media"), Path("/mnt")]
    volumes = []
    seen = set()
    for parent in parents:
        try:
            children = sorted(parent.iterdir(), key=lambda item: natural_key(item.name))
        except OSError:
            continue
        for child in children:
            try:
                real = str(child.resolve())
                if child.name.startswith(".") or not child.is_dir() or real in seen or real == "/":
                    continue
            except OSError:
                continue
            seen.add(real)
            volumes.append({"name": child.name, "path": str(child)})
    return volumes


def home_info() -> dict:
    home = Path.home()
    roots = [{"name": "Home", "path": str(home)}]
    for folder in HOME_FOLDERS:
        candidate = home / folder
        if candidate.is_dir():
            roots.append({"name": folder, "path": str(candidate)})
    roots.extend(mounted_volumes())
    return {"home": str(home), "roots": roots}


def describe(entry: os.DirEntry) -> dict | None:
    try:
        info = entry.stat()
    except OSError:
        try:
            info = entry.stat(follow_symlinks=False)
        except OSError:
            return None
    try:
        is_dir = entry.is_dir()
    except OSError:
        is_dir = False
    ext = "" if is_dir else ext_of(entry.name)
    return {
        "name": entry.name,
        "path": entry.path,
        "kind": "dir" if is_dir else "file",
        "ext": ext,
        "size": 0 if is_dir else info.st_size,
        "mtime": info.st_mtime,
        "type": "other" if is_dir else classify(ext),
    }


def list_dir(raw: str, hidden: bool = False) -> dict:
    path = absolute(raw)
    if not path.exists():
        raise ApiError(404, "that folder does not exist")
    if not path.is_dir():
        raise ApiError(400, "that path is not a folder")
    entries = []
    try:
        with os.scandir(path) as scan:
            for entry in scan:
                try:
                    info = entry.stat(follow_symlinks=False)
                except OSError:
                    info = None
                if not hidden and is_hidden(entry, info):
                    continue
                described = describe(entry)
                if described:
                    entries.append(described)
    except PermissionError:
        raise ApiError(400, "formtools is not allowed to read that folder")
    except OSError as exc:
        raise ApiError(400, f"that folder cannot be read ({exc.strerror or 'error'})")
    entries.sort(key=lambda item: (item["kind"] != "dir", natural_key(item["name"])))
    parent = path.parent
    return {"path": str(path), "parent": None if parent == path else str(parent), "entries": entries}


def has_child_dir(path: str, hidden: bool) -> bool:
    try:
        with os.scandir(path) as scan:
            for entry in scan:
                try:
                    if not entry.is_dir():
                        continue
                    if not hidden and is_hidden(entry, entry.stat(follow_symlinks=False)):
                        continue
                except OSError:
                    continue
                return True
    except OSError:
        return False
    return False


def list_folders(raw: str, hidden: bool = False) -> dict:
    path = absolute(raw)
    if not path.exists():
        raise ApiError(404, "that folder does not exist")
    if not path.is_dir():
        raise ApiError(400, "that path is not a folder")
    dirs = []
    try:
        with os.scandir(path) as scan:
            for entry in scan:
                try:
                    if not entry.is_dir():
                        continue
                    info = entry.stat(follow_symlinks=False)
                except OSError:
                    continue
                if not hidden and is_hidden(entry, info):
                    continue
                dirs.append({"name": entry.name, "path": entry.path, "has_children": has_child_dir(entry.path, hidden)})
    except PermissionError:
        raise ApiError(400, "formtools is not allowed to read that folder")
    except OSError as exc:
        raise ApiError(400, f"that folder cannot be read ({exc.strerror or 'error'})")
    dirs.sort(key=lambda item: natural_key(item["name"]))
    return {"path": str(path), "dirs": dirs}


@router.get("/fs/dirs")
def fs_dirs(path: str, hidden: int = 0) -> dict:
    return list_folders(path, bool(hidden))


@router.get("/fs/home")
def fs_home() -> dict:
    return home_info()


@router.get("/fs/list")
def fs_list(path: str, hidden: int = 0) -> dict:
    return list_dir(path, bool(hidden))


@router.get("/file/raw")
def file_raw(path: str) -> FileResponse:
    target = absolute(path)
    if not target.exists():
        raise ApiError(404, "that file does not exist")
    if not target.is_file():
        raise ApiError(400, "that path is not a file")
    try:
        with open(target, "rb"):
            pass
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    return FileResponse(target, media_type=content_type(target.name), content_disposition_type="inline")
