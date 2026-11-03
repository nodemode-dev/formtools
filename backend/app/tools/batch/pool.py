import logging
import multiprocessing
import os
import threading
from concurrent.futures import Executor, Future, ProcessPoolExecutor, ThreadPoolExecutor
from typing import Any, Callable

from app.core import config

log = logging.getLogger("formtools.batch")


def worker_count() -> int:
    return max(1, (os.cpu_count() or 2) - 1)


class Runner:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._executor: Executor | None = None
        self.mode = ""
        self._force_threads = config.frozen() and os.environ.get("FORMTOOLS_BATCH_PROCESSES", "") != "1"
        if os.environ.get("FORMTOOLS_BATCH_THREADS", "") == "1":
            self._force_threads = True

    def executor(self) -> Executor:
        with self._lock:
            if self._executor is None:
                self._executor = self._create()
            return self._executor

    def _create(self) -> Executor:
        if not self._force_threads:
            try:
                made = ProcessPoolExecutor(max_workers=worker_count(), mp_context=multiprocessing.get_context("spawn"))
                self.mode = "process"
                log.info("batch runs use %s worker processes", worker_count())
                return made
            except Exception as exc:
                log.warning("batch process pool could not start (%s); using threads", exc)
        elif config.frozen():
            log.info("batch runs use threads inside the frozen engine")
        self.mode = "thread"
        return ThreadPoolExecutor(max_workers=worker_count(), thread_name_prefix="formtools-batch")

    def fall_back(self, broken: Executor | None) -> None:
        with self._lock:
            if self._executor is not broken:
                return
            if self.mode == "process":
                log.warning("batch worker processes failed; continuing with threads")
            self._force_threads = True
            self._executor = None
        if broken is not None:
            try:
                broken.shutdown(wait=False, cancel_futures=True)
            except Exception:
                pass

    def submit(self, function: Callable[..., Any], *args: Any) -> tuple[Future, Executor]:
        for _ in range(2):
            current = self.executor()
            try:
                return current.submit(function, *args), current
            except Exception:
                self.fall_back(current)
        current = self.executor()
        return current.submit(function, *args), current

    def close(self) -> None:
        with self._lock:
            held, self._executor = self._executor, None
        if held is not None:
            held.shutdown(wait=True, cancel_futures=True)


runner = Runner()
