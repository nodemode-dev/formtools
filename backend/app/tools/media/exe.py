import os
import shutil
import subprocess
import threading
from pathlib import Path

from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.media import fetch

NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0

_live: set = set()
_live_lock = threading.Lock()
_versions: dict[str, str | None] = {}


def find(program: str) -> str | None:
    fetch.prefer()
    return shutil.which(program)


def require(program: str) -> str:
    found = find(program)
    if found:
        return found
    if fetch.STATE["fetching"]:
        raise ApiError(503, "ffmpeg is still being downloaded, try again in a minute")
    raise ApiError(503, fetch.STATE["error"] or "ffmpeg is not installed; put it on PATH or start formtools with FORM_FFMPEG_AUTO=1")


def existing_file(raw: str) -> Path:
    target = absolute(raw)
    if not target.exists():
        raise ApiError(404, "that file does not exist")
    if not target.is_file():
        raise ApiError(400, "that path is not a file")
    try:
        with open(target, "rb"):
            pass
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    return target


def spawn(args: list[str], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL) -> subprocess.Popen:
    proc = subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr, creationflags=NO_WINDOW)
    with _live_lock:
        _live.add(proc)
    return proc


def release(proc: subprocess.Popen) -> None:
    with _live_lock:
        _live.discard(proc)


def kill(proc: subprocess.Popen) -> None:
    try:
        if proc.poll() is None:
            proc.kill()
    except OSError:
        pass
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        pass
    release(proc)


def kill_all() -> None:
    with _live_lock:
        procs = list(_live)
    for proc in procs:
        kill(proc)


def run_bytes(args: list[str], timeout: float = 120) -> tuple[int, bytes, str]:
    proc = spawn(args, stderr=subprocess.PIPE)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        kill(proc)
        raise ApiError(400, "ffmpeg took too long on that file")
    finally:
        kill(proc)
    return proc.returncode, out, err.decode("utf-8", "replace").strip()


def version() -> str | None:
    path = find("ffmpeg")
    if not path:
        return None
    if path not in _versions:
        try:
            result = subprocess.run([path, "-hide_banner", "-version"], capture_output=True, timeout=15, creationflags=NO_WINDOW, stdin=subprocess.DEVNULL)
            words = result.stdout.decode("utf-8", "replace").split()
            _versions[path] = words[2] if result.returncode == 0 and len(words) > 2 else None
        except (OSError, subprocess.TimeoutExpired):
            _versions[path] = None
    return _versions[path]


def status() -> dict:
    return {
        "ffmpeg": find("ffmpeg"),
        "ffprobe": find("ffprobe"),
        "version": version(),
        "fetching": bool(fetch.STATE["fetching"]),
        "error": fetch.STATE["error"],
    }
