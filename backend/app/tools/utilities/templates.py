import os
import shutil
import threading
from pathlib import Path

from app.core import config
from app.core.errors import ApiError
from app.routers.fs import absolute

MARKER = ".seeded"
SEED_FILES = {
    "Text file.txt": "",
    "Markdown note.md": "# Title\n\n",
    "Data.csv": "column1,column2\n",
    "Config.json": "{}\n",
}
SEED_PROJECT = "Project"
PROJECT_README = "# Project\n\nWhat this project is for.\n"
_lock = threading.Lock()


def folder() -> Path:
    path = config.data_dir() / "templates"
    path.mkdir(parents=True, exist_ok=True)
    return path


def write_new(path: Path, text: str) -> None:
    try:
        with open(path, "x", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
    except FileExistsError:
        pass


def seed(root: Path) -> None:
    if (root / MARKER).exists():
        return
    for name, text in SEED_FILES.items():
        write_new(root / name, text)
    project = root / SEED_PROJECT
    if not project.exists():
        project.mkdir()
        (project / "assets").mkdir()
        (project / "exports").mkdir()
        write_new(project / "README.md", PROJECT_README)
    write_new(root / MARKER, "")


def ready() -> Path:
    with _lock:
        root = folder()
        seed(root)
        return root


def listing() -> dict:
    root = ready()
    items = []
    with os.scandir(root) as scanner:
        for entry in scanner:
            if entry.name.startswith("."):
                continue
            try:
                is_folder = entry.is_dir()
            except OSError:
                continue
            items.append({"name": entry.name, "path": entry.path, "kind": "folder" if is_folder else "file"})
    items.sort(key=lambda item: (item["kind"] != "folder", item["name"].lower()))
    return {"folder": str(root), "templates": items}


def clean_name(raw: str) -> str:
    name = raw.strip()
    if not name or name in (".", "..") or any(mark in name for mark in ("/", "\\", "\x00")):
        raise ApiError(400, "that name cannot be used for a file or folder")
    return name


def free_name(destination: Path, name: str, is_folder: bool) -> Path:
    stem, suffix = (name, "") if is_folder else (Path(name).stem, Path(name).suffix)
    if not stem:
        stem, suffix = name, ""
    number = 1
    while True:
        candidate = destination / (name if number == 1 else f"{stem} ({number}){suffix}")
        try:
            if is_folder:
                candidate.mkdir()
            else:
                with open(candidate, "xb"):
                    pass
            return candidate
        except FileExistsError:
            number += 1
        except OSError:
            raise ApiError(400, "formtools cannot create anything in that folder")


def create(template: str, target: str, name: str | None) -> dict:
    root = ready()
    source = root / clean_name(template)
    if template.startswith(".") or not source.exists():
        raise ApiError(404, "there is no template with that name")
    destination = absolute(target)
    if not destination.is_dir():
        raise ApiError(400, "the destination folder does not exist")
    is_folder = source.is_dir()
    wanted = template
    if name is not None and name.strip():
        wanted = clean_name(name)
        if not is_folder and not Path(wanted).suffix and source.suffix:
            wanted += source.suffix
    made = free_name(destination, wanted, is_folder)
    try:
        if is_folder:
            shutil.copytree(source, made, symlinks=True, dirs_exist_ok=True)
        else:
            with open(source, "rb") as reading, open(made, "wb") as writing:
                shutil.copyfileobj(reading, writing)
            shutil.copystat(source, made)
    except OSError as exc:
        raise ApiError(500, f"the template could not be copied ({exc.strerror or type(exc).__name__})")
    return {"ok": True, "path": str(made)}
