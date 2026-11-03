import os

from app.core.errors import ApiError
from app.core.filetypes import AUDIO, IMAGE, VIDEO, classify, ext_of
from app.core.jobs import Cancelled, Job
from app.tools.image import decode
from app.tools.utilities import walk

NOT_PICTURES = frozenset({"svg", "jxl"})
UNSUPPORTED = (
    "not supported by this build",
    "does not decode that kind",
    "no cleared decoder",
    "shown by the window",
    "decoded by the operating system",
    "larger than 400",
    "version formtools does not read",
    "no colour channels",
    "no preview",
)


class Folder:
    __slots__ = ("path", "pending", "occupied", "kids")

    def __init__(self, path: str) -> None:
        self.path = path
        self.pending: list[str] = []
        self.occupied = False
        self.kids: list[bool] = []


def open_folder(path: str, tally: walk.Tally, progress: walk.Progress) -> Folder:
    folder = Folder(path)
    progress.tick(path)
    try:
        with os.scandir(path) as scanner:
            entries = list(scanner)
    except OSError as exc:
        tally(path, exc)
        folder.occupied = True
        return folder
    for entry in entries:
        try:
            if not entry.is_symlink() and entry.is_dir(follow_symlinks=False):
                folder.pending.append(entry.path)
                progress.grow()
                continue
        except OSError as exc:
            tally(entry.path, exc)
        folder.occupied = True
    return folder


def run_empty(job: Job, root: str) -> dict:
    tally = walk.Tally(job)
    progress = walk.Progress(job)
    progress.grow()
    found: list[str] = []
    stack = [open_folder(root, tally, progress)]
    while stack:
        job.check()
        top = stack[-1]
        if top.pending:
            stack.append(open_folder(top.pending.pop(), tally, progress))
            continue
        stack.pop()
        empty = not top.occupied and all(top.kids)
        if empty and stack:
            found.append(top.path)
        if stack:
            stack[-1].kids.append(empty)
    progress.flush()
    found.sort()
    chosen = set(found)
    top_most = [path for path in found if os.path.dirname(path) not in chosen]
    return {"folders": found, "top": top_most, "errors": tally.errors}


def media_probe():
    try:
        from app.tools.media import exe, probe
    except Exception:
        return None
    try:
        if not exe.find("ffprobe"):
            return None
    except Exception:
        return None
    return probe


def check_picture(path: str) -> None:
    try:
        decode.render(path, 64).close()
    except ApiError as exc:
        message = exc.message
        if any(marker in message for marker in UNSUPPORTED):
            return
        raise


def check_media(probe, path: str) -> None:
    from pathlib import Path

    probe.raw(Path(path))


def run_broken(job: Job, root: str) -> dict:
    tally = walk.Tally(job)
    progress = walk.Progress(job)
    probe = media_probe()
    candidates: list[str] = []
    for path, _ in walk.walk(root, True, True, tally):
        job.check()
        ext = ext_of(path)
        progress.grow()
        progress.tick(path)
        if ext in IMAGE and ext not in NOT_PICTURES:
            candidates.append(path)
        elif probe is not None and (ext in VIDEO or ext in AUDIO):
            candidates.append(path)
    progress.flush()
    progress.grow(len(candidates))

    def work(path: str) -> None:
        if ext_of(path) in IMAGE:
            check_picture(path)
        else:
            check_media(probe, path)

    items = []
    for path, _, exc in walk.parallel(job, candidates, work):
        progress.tick(path)
        if exc is None:
            continue
        if isinstance(exc, Cancelled):
            raise exc
        items.append({"path": path, "type": classify(ext_of(path)), "error": walk.reason(exc)})
    progress.flush()
    items.sort(key=lambda item: item["path"])
    return {"items": items, "checked": len(candidates), "media": probe is not None, "errors": tally.errors}
