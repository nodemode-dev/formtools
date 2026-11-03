import itertools
import threading
import time
import traceback
from dataclasses import dataclass, field
from typing import Any, Callable

from app.core.errors import ApiError

KEEP = 64
_ids = itertools.count(1)
_lock = threading.Lock()
_jobs: dict[str, "Job"] = {}


class Cancelled(Exception):
    pass


@dataclass
class Job:
    id: str
    kind: str
    title: str
    total: int
    done: int = 0
    current: str = ""
    state: str = "running"
    errors: list[dict[str, str]] = field(default_factory=list)
    result: Any = None
    started: float = field(default_factory=time.time)
    finished: float | None = None
    _cancel: threading.Event = field(default_factory=threading.Event, repr=False)

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    def check(self) -> None:
        if self._cancel.is_set():
            raise Cancelled()

    def step(self, done: int | None = None, current: str | None = None, total: int | None = None) -> None:
        with _lock:
            if total is not None:
                self.total = total
            if done is not None:
                self.done = done
            else:
                self.done += 1
            if current is not None:
                self.current = current

    def error(self, path: str, message: str) -> None:
        with _lock:
            if len(self.errors) < 500:
                self.errors.append({"path": path, "error": message})

    def to_dict(self) -> dict[str, Any]:
        with _lock:
            return {
                "id": self.id,
                "kind": self.kind,
                "title": self.title,
                "state": self.state,
                "done": self.done,
                "total": self.total,
                "current": self.current,
                "errors": list(self.errors),
                "result": self.result,
                "started": self.started,
                "finished": self.finished,
            }


def _prune() -> None:
    ended = [j for j in _jobs.values() if j.state != "running"]
    ended.sort(key=lambda j: j.finished or 0)
    for job in ended[: max(0, len(_jobs) - KEEP)]:
        _jobs.pop(job.id, None)


def start(kind: str, title: str, total: int, work: Callable[[Job], Any]) -> Job:
    job = Job(id=f"j{next(_ids)}", kind=kind, title=title, total=max(0, int(total)))

    def run() -> None:
        try:
            result = work(job)
            state = "cancelled" if job.cancelled else "done"
        except Cancelled:
            result, state = None, "cancelled"
        except ApiError as exc:
            result, state = None, "failed"
            job.error("", exc.message)
        except Exception as exc:
            result, state = None, "failed"
            job.error("", f"{type(exc).__name__}: {exc}")
            traceback.print_exc()
        with _lock:
            job.result = result
            job.state = state
            job.finished = time.time()

    with _lock:
        _jobs[job.id] = job
        _prune()
    threading.Thread(target=run, name=f"formtools-{job.id}", daemon=True).start()
    return job


def get(job_id: str) -> Job:
    with _lock:
        job = _jobs.get(job_id)
    if job is None:
        raise ApiError(404, "there is no job with that id")
    return job


def cancel(job_id: str) -> Job:
    job = get(job_id)
    job._cancel.set()
    return job


def listing() -> list[dict[str, Any]]:
    with _lock:
        items = list(_jobs.values())
    return [j.to_dict() for j in sorted(items, key=lambda j: j.started, reverse=True)]
