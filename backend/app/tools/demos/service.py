import json
import shutil
import threading
from pathlib import Path

from app.core import config
from app.core.errors import ApiError
from app.tools.demos import bench, family, photos

DEMOS = {
    "photos": ("A photo shoot folder", photos),
    "family": ("A shelf of Form files", family),
    "bench": ("3D and media bench", bench),
}
COVER_SIZE = (640, 480)
_locks = {demo_id: threading.Lock() for demo_id in DEMOS}


def root() -> Path:
    folder = config.data_dir() / "demos"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def marker() -> str:
    return f".demo-{config.VERSION}"


def known(demo_id: str) -> tuple[str, object]:
    found = DEMOS.get(demo_id)
    if found is None:
        raise ApiError(404, f"there is no demo called {demo_id}; the demos are {', '.join(DEMOS)}")
    return found


def listing() -> dict:
    return {"demos": [{"id": demo_id, "title": title, "path": str(root() / demo_id), "ready": (root() / demo_id / marker()).is_file()} for demo_id, (title, _) in DEMOS.items()]}


def read_notes(folder: Path) -> list[str] | None:
    try:
        notes = json.loads((folder / marker()).read_text(encoding="utf-8") or "[]")
    except (OSError, ValueError):
        return None
    return [str(n) for n in notes] if isinstance(notes, list) else None


def ensure(demo_id: str) -> dict:
    title, builder = known(demo_id)
    base = root()
    folder = base / demo_id
    with _locks[demo_id]:
        notes = read_notes(folder)
        if notes == []:
            return {"id": demo_id, "title": title, "path": str(folder), "made": False, "notes": []}
        temp = base / f".{demo_id}-building"
        shutil.rmtree(temp, ignore_errors=True)
        temp.mkdir()
        try:
            notes = builder.build(temp)
            (temp / marker()).write_text(json.dumps(notes), encoding="utf-8")
        except Exception as exc:
            shutil.rmtree(temp, ignore_errors=True)
            raise ApiError(500, f"the {title} demo could not be made ({type(exc).__name__}: {exc})") from exc
        if folder.exists():
            ours = any(item.name.startswith(".demo-") for item in folder.iterdir())
            if ours:
                shutil.rmtree(folder)
            else:
                number = 1
                while (base / f"{demo_id}-kept-{number}").exists():
                    number += 1
                folder.rename(base / f"{demo_id}-kept-{number}")
        temp.rename(folder)
        return {"id": demo_id, "title": title, "path": str(folder), "made": True, "notes": notes}


def cover(demo_id: str) -> Path:
    _, builder = known(demo_id)
    folder = root() / ".covers"
    folder.mkdir(exist_ok=True)
    path = folder / f"{demo_id}-{config.VERSION}.png"
    with _locks[demo_id]:
        if not path.is_file():
            temp = path.with_suffix(".part")
            builder.cover(*COVER_SIZE).save(temp, "PNG", optimize=True)
            temp.replace(path)
    return path
