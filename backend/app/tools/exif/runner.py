import collections
import itertools
import logging
import os
import queue
import subprocess
import threading
import time

from app.core.errors import ApiError

TIMEOUT = 30.0
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0) if os.name == "nt" else 0

log = logging.getLogger("formtools.exif.runner")


class Session:
    def __init__(self, command: tuple[str, ...]) -> None:
        self.command = command
        self.proc = subprocess.Popen(
            [*command, "-stay_open", "True", "-@", "-"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0,
            creationflags=NO_WINDOW,
        )
        self.chunks: queue.Queue = queue.Queue()
        self.errors: collections.deque = collections.deque(maxlen=8)
        threading.Thread(target=self.pump_out, name="exiftool-out", daemon=True).start()
        threading.Thread(target=self.pump_err, name="exiftool-err", daemon=True).start()

    def pump_out(self) -> None:
        fd = self.proc.stdout.fileno()
        try:
            while True:
                block = os.read(fd, 65536)
                if not block:
                    break
                self.chunks.put(block)
        except OSError:
            pass
        self.chunks.put(None)

    def pump_err(self) -> None:
        try:
            for line in iter(self.proc.stderr.readline, b""):
                text = line.decode("utf-8", "replace").strip()
                if text:
                    self.errors.append(text)
        except (OSError, ValueError):
            pass

    @property
    def pid(self) -> int:
        return self.proc.pid

    def alive(self) -> bool:
        return self.proc.poll() is None

    def last_error(self) -> str:
        return self.errors[-1] if self.errors else "no message"

    def run(self, args: list[str], seq: int, timeout: float) -> bytes:
        payload = "\n".join([*args, f"-execute{seq}"]) + "\n"
        self.proc.stdin.write(payload.encode("utf-8"))
        marker = f"{{ready{seq}}}".encode("ascii")
        deadline = time.monotonic() + timeout
        buffer = bytearray()
        while True:
            left = deadline - time.monotonic()
            if left <= 0:
                raise TimeoutError()
            try:
                block = self.chunks.get(timeout=left)
            except queue.Empty:
                raise TimeoutError()
            if block is None:
                raise EOFError()
            buffer += block
            at = buffer.rfind(marker)
            if at != -1 and b"\n" in buffer[at + len(marker) :]:
                return bytes(buffer[:at])

    def close(self, polite: bool) -> None:
        if polite and self.alive():
            try:
                self.proc.stdin.write(b"-stay_open\nFalse\n")
                self.proc.stdin.close()
                self.proc.wait(timeout=2)
            except (OSError, ValueError, subprocess.TimeoutExpired):
                pass
        try:
            if self.proc.poll() is None:
                self.proc.kill()
            self.proc.wait(timeout=5)
        except (OSError, subprocess.TimeoutExpired):
            pass
        for stream in (self.proc.stdin, self.proc.stdout, self.proc.stderr):
            try:
                stream.close()
            except (OSError, ValueError):
                pass


_lock = threading.Lock()
_sequence = itertools.count(1)
_session: Session | None = None
STATS = {"spawned": 0}


def _drop(polite: bool = False) -> None:
    global _session
    if _session is not None:
        _session.close(polite)
        _session = None


def _ensure(command: tuple[str, ...]) -> Session:
    global _session
    if _session is not None and _session.command == command and _session.alive():
        return _session
    _drop()
    try:
        _session = Session(command)
    except OSError as exc:
        raise ApiError(503, f"ExifTool could not be started ({exc.strerror or exc})")
    STATS["spawned"] += 1
    log.info("exiftool process %s started", _session.pid)
    return _session


def execute(command: tuple[str, ...], args: list[str], timeout: float = TIMEOUT) -> bytes:
    note = "no message"
    with _lock:
        for _ in range(2):
            session = _ensure(command)
            try:
                return session.run(args, next(_sequence), timeout)
            except TimeoutError:
                _drop()
                raise ApiError(400, "ExifTool took too long on that file")
            except (OSError, EOFError, ValueError):
                note = session.last_error()
                log.warning("exiftool process %s stopped (%s)", session.pid, note)
                _drop()
    raise ApiError(503, f"ExifTool stopped unexpectedly ({note})")


def stop() -> None:
    got = _lock.acquire(timeout=3)
    try:
        _drop(polite=got)
    finally:
        if got:
            _lock.release()
