import json
import logging
import os
import time
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core import startup

LOG_NAME = "formtools-engine.log"
LOCK_NAME = "engine.lock"
PORT_NAME = "engine.port"
LOG_BYTES = 1_048_576
LOG_KEEP = 3
STARTED = time.time()
LOGGERS = ("formtools", "uvicorn", "uvicorn.error", "uvicorn.access")
FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


AlreadyRunning = startup.Busy


def start_logging(data: Path) -> Path:
    folder = data / "Logs"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / LOG_NAME
    for held in logging.getLogger("formtools").handlers:
        if held.get_name() == "formtools-file" and getattr(held, "baseFilename", "") == os.path.abspath(path):
            for name in LOGGERS:
                if held not in logging.getLogger(name).handlers:
                    logging.getLogger(name).addHandler(held)
            return path
    stop_logging()
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
    return startup.alive(pid)


def claim(data: Path) -> Path:
    lock, replaced = startup.claim(data, startup.shell_pid())
    if replaced:
        logging.getLogger("formtools").warning("an engine left running without its app was stopped (process %s)", replaced)
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
