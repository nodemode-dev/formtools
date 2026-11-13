import os
from collections import deque
from concurrent.futures import ThreadPoolExecutor
from typing import Callable, Iterable, Iterator

from app.core.errors import ApiError
from app.core.jobs import Job
from app.routers.fs import absolute

WINDOWS_HIDDEN = 0x2


class Tally:
    def __init__(self, job: Job) -> None:
        self.job = job
        self.errors = 0

    def __call__(self, path: str, exc: BaseException) -> None:
        self.errors += 1
        self.job.error(path, reason(exc))


class Progress:
    def __init__(self, job: Job) -> None:
        self.job = job
        self.total = 0
        self.done = 0
        self.pending = 0

    def grow(self, count: int = 1) -> None:
        self.total += count

    def tick(self, current: str | None = None, count: int = 1) -> None:
        self.done += count
        self.pending += count
        if self.pending >= 16:
            self.flush(current)

    def flush(self, current: str | None = None) -> None:
        self.pending = 0
        self.job.step(done=self.done, current=current, total=max(self.total, self.done))


def reason(exc: BaseException) -> str:
    if isinstance(exc, ApiError):
        return exc.message
    if isinstance(exc, PermissionError):
        return "formtools is not allowed to read that"
    if isinstance(exc, FileNotFoundError):
        return "it disappeared during the scan"
    if isinstance(exc, OSError) and exc.strerror:
        return exc.strerror
    return f"{type(exc).__name__}: {exc}"


def folder_root(raw: str) -> str:
    path = absolute(raw)
    if not path.exists():
        raise ApiError(404, "that folder does not exist")
    if not path.is_dir():
        raise ApiError(400, "that path is not a folder")
    return str(path)


def inside(child: str, parent: str) -> bool:
    head = parent.rstrip(os.sep) + os.sep
    return child.startswith(head) and not any(part.startswith(".") for part in child[len(head):].split(os.sep))


def folder_roots(raw: Iterable[str], recursive: bool = True) -> list[str]:
    roots: list[tuple[str, str]] = []
    for item in raw:
        text = folder_root(item)
        real = os.path.normcase(os.path.realpath(text))
        if any(real == other or (recursive and inside(real, other)) for _, other in roots):
            continue
        if recursive:
            roots = [(kept, other) for kept, other in roots if not inside(other, real)]
        roots.append((text, real))
    if not roots:
        raise ApiError(400, "at least one folder is needed")
    return [text for text, _ in roots]


def hidden_by_attribute(info: os.stat_result) -> bool:
    return bool(getattr(info, "st_file_attributes", 0) & WINDOWS_HIDDEN)


def walk(root: str, recursive: bool, include_hidden: bool, on_error: Callable[[str, BaseException], None]) -> Iterator[tuple[str, os.stat_result]]:
    stack = [root]
    while stack:
        folder = stack.pop()
        try:
            with os.scandir(folder) as scanner:
                entries = list(scanner)
        except OSError as exc:
            on_error(folder, exc)
            continue
        for entry in entries:
            try:
                if entry.is_symlink() or entry.is_junction():
                    continue
                if not include_hidden and entry.name.startswith("."):
                    continue
                if entry.is_dir(follow_symlinks=False):
                    if recursive:
                        stack.append(entry.path)
                    continue
                if not entry.is_file(follow_symlinks=False):
                    continue
                info = os.stat(entry.path, follow_symlinks=False) if os.name == "nt" else entry.stat(follow_symlinks=False)
            except OSError as exc:
                on_error(entry.path, exc)
                continue
            if not include_hidden and hidden_by_attribute(info):
                continue
            yield entry.path, info


def identity(info: os.stat_result) -> tuple[int, int] | None:
    if info.st_nlink > 1 and info.st_ino:
        return (info.st_dev, info.st_ino)
    return None


def settle(pair):
    item, future = pair
    try:
        return item, future.result(), None
    except Exception as exc:
        return item, None, exc


def parallel(job: Job, items: Iterable, work: Callable, workers: int = 0) -> Iterator[tuple]:
    count = workers or max(2, min(8, os.cpu_count() or 2))
    queue: deque = deque()
    with ThreadPoolExecutor(max_workers=count, thread_name_prefix="formtools-util") as pool:
        try:
            for item in items:
                job.check()
                queue.append((item, pool.submit(work, item)))
                while len(queue) >= count * 4:
                    yield settle(queue.popleft())
                    job.check()
            while queue:
                job.check()
                yield settle(queue.popleft())
        finally:
            for _, future in queue:
                future.cancel()
