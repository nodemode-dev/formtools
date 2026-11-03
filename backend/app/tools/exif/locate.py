import os
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

from app.tools.exif import fetch

NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0
VERSION_LINE = re.compile(r"^\d+\.\d+")

_versions: dict[tuple, str | None] = {}


@dataclass(frozen=True)
class Found:
    command: tuple[str, ...]
    path: str
    source: str
    version: str


def perl_path() -> str | None:
    if os.name == "nt":
        return None
    return shutil.which("perl")


def probe(command: tuple[str, ...], target: Path) -> str | None:
    try:
        key = (command, target.stat().st_mtime_ns)
    except OSError:
        return None
    if key not in _versions:
        try:
            result = subprocess.run(
                [*command, "-ver"],
                capture_output=True,
                timeout=20,
                stdin=subprocess.DEVNULL,
                creationflags=NO_WINDOW,
            )
            text = result.stdout.decode("utf-8", "replace").strip()
            _versions[key] = text if result.returncode == 0 and VERSION_LINE.match(text) else None
        except (OSError, subprocess.TimeoutExpired):
            _versions[key] = None
    return _versions[key]


def command_for(target: Path) -> tuple[str, ...]:
    if os.name != "nt" and not os.access(target, os.X_OK):
        perl = perl_path()
        if perl:
            return (perl, str(target))
    return (str(target),)


def from_env() -> tuple[Found | None, str | None]:
    raw = os.environ.get("FORMTOOLS_EXIFTOOL", "").strip()
    if not raw:
        return None, None
    target = Path(raw).expanduser()
    if target.is_file():
        command = command_for(target)
        version = probe(command, target)
        if version:
            return Found(command, str(target), "env", version), None
    return None, "FORMTOOLS_EXIFTOOL does not point to a working ExifTool."


def from_path() -> Found | None:
    hit = shutil.which("exiftool")
    if not hit:
        return None
    target = Path(hit)
    command = command_for(target)
    version = probe(command, target)
    return Found(command, hit, "path", version) if version else None


def from_fetched() -> tuple[Found | None, str | None]:
    where = fetch.folder()
    if not fetch.verified(where):
        return None, None
    script = fetch.script_of(where)
    if os.name == "nt":
        command: tuple[str, ...] = (str(script),)
    else:
        perl = perl_path()
        if not perl:
            return None, fetch.PERL_SENTENCE
        command = (perl, str(script))
    version = probe(command, script)
    if version:
        return Found(command, str(script), "fetched", version), None
    return None, "The ExifTool copy formtools fetched does not run on this computer."


def resolve() -> tuple[Found | None, str | None]:
    found, problem = from_env()
    if found:
        return found, None
    found = from_path()
    if found:
        return found, None
    fetched, trouble = from_fetched()
    if fetched:
        return fetched, None
    return None, problem or trouble


def status() -> dict:
    found, problem = resolve()
    perl = perl_path()
    error = None
    if not found:
        error = fetch.STATE["error"] or problem
        if not error and os.name != "nt" and not perl:
            error = fetch.PERL_SENTENCE
    return {
        "available": found is not None,
        "path": found.path if found else None,
        "version": found.version if found else None,
        "source": found.source if found else None,
        "fetching": bool(fetch.STATE["fetching"]),
        "perl": perl,
        "error": error,
    }


def unavailable_sentence() -> str:
    state = status()
    if state["fetching"]:
        return "ExifTool is still being downloaded, try again in a minute."
    if state["error"]:
        return state["error"]
    return "ExifTool is not available; get it with the Get ExifTool button, or install it and put it on PATH."
