import json
import logging
import os
import sys
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_NAME = "formtools-engine.log"
LOCK_NAME = "engine.lock"
PORT_NAME = "engine.port"
LOG_BYTES = 1_048_576
LOG_KEEP = 3
STARTED = time.time()
LOGGERS = ("formtools", "uvicorn", "uvicorn.error", "uvicorn.access")
FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


class AlreadyRunning(RuntimeError):
    pass


def start_logging(data: Path) -> Path:
    stop_logging()
    folder = data / "Logs"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / LOG_NAME
    handler = RotatingFileHandler(path, maxBytes=LOG_BYTES, backupCount=LOG_KEEP, encoding="utf-8")
    handler.setFormatter(logging.Formatter(FORMAT))
    handler.set_name("formtools-file")
    for name in LOGGERS:
        logger = logging.getLogger(name)
        logger.addHandler(handler)
        if name == "formtools":
            logger.setLevel(logging.INFO)
    logging.getLogger("formtools").info("engine started, pid %s, data folder %s", os.getpid(), data)
    return path


def stop_logging() -> None:
    for name in LOGGERS:
        logger = logging.getLogger(name)
        for handler in list(logger.handlers):
            if handler.get_name() == "formtools-file":
                logger.removeHandler(handler)
                handler.close()


def alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes

        handle = ctypes.windll.kernel32.OpenProcess(0x1000, False, pid)
        if handle:
            ctypes.windll.kernel32.CloseHandle(handle)
        return bool(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    try:
        with open(f"/proc/{pid}/stat") as stat:
            return stat.read().rpartition(")")[2].split()[0] != "Z"
    except (OSError, IndexError):
        return True


def claim(data: Path) -> Path:
    lock = data / LOCK_NAME
    try:
        held = int(json.loads(lock.read_text()).get("pid", 0))
    except (OSError, ValueError, AttributeError):
        held = 0
    if held and held != os.getpid() and alive(held):
        raise AlreadyRunning(f"formtools is already running on {data} (engine process {held}).")
    lock.write_text(json.dumps({"pid": os.getpid(), "started": int(STARTED)}))
    return lock


def release(data: Path) -> None:
    for name in (LOCK_NAME, PORT_NAME):
        path = data / name
        try:
            if int(json.loads(path.read_text()).get("pid", 0)) == os.getpid():
                path.unlink()
        except (OSError, ValueError, AttributeError):
            pass


def write_port(data: Path, port: int) -> None:
    try:
        (data / PORT_NAME).write_text(json.dumps({"pid": os.getpid(), "port": port}), encoding="utf-8")
    except OSError:
        pass
