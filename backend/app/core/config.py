import os
import sys
from pathlib import Path

from app import __version__

APP_NAME = "formtools"
VERSION = __version__
FRONTEND_PORT = 5240
BACKEND_PORT = 8240
BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent


def os_name() -> str:
    if sys.platform == "darwin":
        return "macos"
    if sys.platform.startswith("win"):
        return "windows"
    return "linux"


def frozen() -> bool:
    return bool(getattr(sys, "frozen", False))


def resource_dir() -> Path:
    return Path(getattr(sys, "_MEIPASS", BACKEND_DIR))


def engine_port() -> int:
    raw = os.environ.get("FORMTOOLS_PORT", "").strip()
    if not raw:
        return BACKEND_PORT
    try:
        port = int(raw)
    except ValueError:
        return BACKEND_PORT
    return port if 0 <= port <= 65535 else BACKEND_PORT


def platform_data_dir() -> Path:
    home = Path.home()
    if sys.platform == "darwin":
        return home / "Library" / "Application Support" / APP_NAME
    if sys.platform.startswith("win"):
        return Path(os.environ.get("APPDATA") or home / "AppData" / "Roaming") / APP_NAME
    base = Path(os.environ.get("XDG_DATA_HOME") or ".")
    return (base if base.is_absolute() else home / ".local" / "share") / APP_NAME


def data_dir() -> Path:
    raw = os.environ.get("FORMTOOLS_DATA_DIR", "").strip()
    folder = Path(raw).expanduser() if raw else platform_data_dir()
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def cache_dir(*parts: str) -> Path:
    folder = data_dir().joinpath("cache", *parts)
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def dist_dir() -> Path | None:
    raw = os.environ.get("FORMTOOLS_DIST", "").strip()
    if raw:
        candidates = [Path(raw).expanduser()]
    elif frozen():
        candidates = [resource_dir() / "ui"]
    else:
        candidates = [REPO_DIR / "frontend" / "dist"]
    for folder in candidates:
        if (folder / "index.html").is_file():
            return folder
    return None
