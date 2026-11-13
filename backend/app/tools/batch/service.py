import logging
import os
import time
from concurrent.futures import BrokenExecutor, wait, FIRST_COMPLETED
from typing import Any

from PIL import Image

from app.core import jobs
from app.core.errors import ApiError
from app.core.filetypes import RAW, ext_of
from app.core.jobs import Cancelled
from app.routers.fs import absolute, natural_key
from app.tools.batch import actions, naming, worker
from app.tools.batch.pool import runner, worker_count
from app.tools.image import decode, libs
from app.tools.image.info import raw_info

log = logging.getLogger("formtools.batch")

MAX_ITEMS = 20000
OVERWRITE = ("skip", "replace", "rename")
FORMAT_CHOICES = ("same",) + tuple(worker.FORMATS)
NOT_DECODED = frozenset(("svg", "jxl", "fvd", "fmv", "formvis", "fc", "fmw", "fsc", "fequeue", "fldb"))
NATIVE = frozenset("jpg jpeg jpe jfif png apng gif webp bmp dib".split())

DEFAULT_OUTPUT = {
    "format": "same",
    "quality": 90,
    "folder": "",
    "subfolder": "",
    "naming": "{name}",
    "overwrite": "rename",
    "keep_metadata": True,
    "keep_folders": False,
    "keep_dates": False,
}


def supported_extensions() -> frozenset:
    return frozenset((set(libs.engine_extensions()) | NATIVE) - NOT_DECODED)


def normalise_output(raw: Any) -> dict:
    merged = dict(DEFAULT_OUTPUT)
    if raw:
        if not isinstance(raw, dict):
            raise ApiError(400, "output must be an object")
        merged.update({key: value for key, value in raw.items() if key in DEFAULT_OUTPUT and value is not None})
    if merged["format"] not in FORMAT_CHOICES:
        raise ApiError(400, "the output format is not one formtools can write")
    try:
        merged["quality"] = max(1, min(100, int(merged["quality"])))
    except (TypeError, ValueError):
        raise ApiError(400, "quality must be a number from 1 to 100")
    if merged["overwrite"] not in OVERWRITE:
        raise ApiError(400, "overwrite must be skip, replace or rename")
    merged["folder"] = str(merged["folder"] or "").strip()
    if merged["folder"]:
        if "\x00" in merged["folder"] or not os.path.isabs(merged["folder"]):
            raise ApiError(400, "the output folder must be an absolute path")
        merged["folder"] = os.path.normpath(merged["folder"])
        if os.path.exists(merged["folder"]) and not os.path.isdir(merged["folder"]):
            raise ApiError(400, "the output folder is a file")
    merged["subfolder"] = str(merged["subfolder"] or "").strip()
    naming.safe_parts(merged["subfolder"])
    merged["naming"] = str(merged["naming"] or "{name}")
    naming.validate(merged["naming"])
    for key in ("keep_metadata", "keep_folders", "keep_dates"):
        merged[key] = bool(merged[key])
    return merged


def collect(inputs: Any, recursive: bool, extensions: Any, out: dict) -> tuple[list[dict], list[dict]]:
    if not isinstance(inputs, list) or not inputs:
        raise ApiError(400, "inputs must list at least one file or folder")
    if extensions is not None and not isinstance(extensions, list):
        raise ApiError(400, "extensions must be a list")
    wanted = {str(item).lower().lstrip(".") for item in (extensions or []) if str(item).strip()}
    supported = supported_extensions()
    skipped: list[dict] = []
    entries: list[dict] = []
    seen: set[str] = set()
    out_root = os.path.realpath(out["folder"]) if out["folder"] else None

    def inside_output(path: str) -> bool:
        if not out_root:
            return False
        real = os.path.realpath(path)
        return real == out_root or real.startswith(out_root + os.sep)

    def add(path: str, root: str | None, explicit: bool) -> None:
        key = naming.fs_key(path)
        if key in seen:
            return
        ext = ext_of(path)
        ok = ext in wanted if wanted else ext in supported
        if not ok:
            if explicit:
                skipped.append({"path": path, "reason": "not a picture type this run converts"})
            return
        seen.add(key)
        entries.append({"src": path, "root": root})
        if len(entries) > MAX_ITEMS:
            raise ApiError(400, f"a run is limited to {MAX_ITEMS} pictures")

    for raw in inputs:
        target = str(absolute(str(raw)))
        if os.path.isdir(target):
            walk(target, recursive, add, inside_output)
        elif os.path.isfile(target):
            add(target, None, True)
        else:
            skipped.append({"path": target, "reason": "it does not exist"})
    return entries, skipped


def walk(top: str, recursive: bool, add, inside_output) -> None:
    folders = [top]
    while folders:
        folder = folders.pop(0)
        if folder != top and inside_output(folder):
            continue
        try:
            with os.scandir(folder) as scan:
                children = list(scan)
        except OSError:
            continue
        files, dirs = [], []
        for child in children:
            if child.name.startswith("."):
                continue
            try:
                (dirs if child.is_dir(follow_symlinks=False) else files).append(child)
            except OSError:
                continue
        for child in sorted(files, key=lambda item: natural_key(item.name)):
            add(child.path, top, False)
        if recursive:
            folders[0:0] = [child.path for child in sorted(dirs, key=lambda item: natural_key(item.name))]


def destination(entry: dict, out: dict) -> str:
    src_dir = os.path.dirname(entry["src"])
    base = out["folder"] or src_dir
    parts = naming.safe_parts(out["subfolder"])
    if out["keep_folders"] and out["folder"] and entry["root"]:
        relative = os.path.relpath(src_dir, entry["root"])
        if relative != ".":
            parts += [part for part in relative.split(os.sep) if part and part != ".."]
    target = os.path.normpath(os.path.join(base, *parts))
    if os.path.commonpath([os.path.abspath(target), os.path.abspath(base)]) != os.path.abspath(base):
        raise ApiError(400, "the output path would leave the destination folder")
    return target


def source_size(src: str) -> tuple[int, int]:
    if ext_of(src) in RAW:
        found = raw_info(src)
        return found["width"], found["height"]
    with Image.open(src) as image:
        width, height = image.size
        if image.getexif().get(0x0112, 1) in (5, 6, 7, 8):
            width, height = height, width
    return width, height


def predicted_size(src: str, acts: list[dict]) -> tuple[int, int]:
    try:
        width, height = source_size(src)
    except Exception:
        return 0, 0
    return actions.chain_dims((width, height), acts)


def unique(directory: str, stem: str, ext: str, claimed: set) -> str:
    for number in range(2, 100000):
        candidate = os.path.join(directory, f"{stem} ({number}).{ext}")
        if naming.fs_key(candidate) not in claimed and not os.path.lexists(candidate):
            return candidate
    raise ApiError(400, "no free file name was found")


def resolve(directory: str, stem: str, ext: str, src: str, policy: str, claimed: set, source_keys: set) -> tuple[str, str, str | None]:
    dst = os.path.join(directory, f"{stem}.{ext}")
    key = naming.fs_key(dst)
    conflict, skip = "none", None
    if key in claimed:
        conflict = "duplicate"
    elif os.path.lexists(dst):
        conflict = "exists"
    if conflict != "none":
        if policy == "rename":
            dst = unique(directory, stem, ext, claimed)
        elif conflict == "duplicate":
            skip = "another picture in this run already uses that name"
        elif policy == "skip":
            skip = "a file with that name already exists"
        elif os.path.isdir(dst):
            skip = "a folder has that name"
        elif key in source_keys and key != naming.fs_key(src):
            skip = "it would overwrite another picture of this run"
    if skip is None:
        claimed.add(naming.fs_key(dst))
    return dst, conflict, skip


def build_plan(entries: list[dict], out: dict, acts: list[dict]) -> list[dict]:
    template = out["naming"]
    need_size = naming.uses(template, "width", "height")
    claimed: set = set()
    source_keys = {naming.fs_key(entry["src"]) for entry in entries}
    plan = []
    for number, entry in enumerate(entries, 1):
        src = entry["src"]
        directory = destination(entry, out)
        ext = worker.output_extension(out["format"], src)
        width, height = predicted_size(src, acts) if need_size else (0, 0)
        stem = naming.expand(template, src, number, width, height, os.path.basename(os.path.dirname(src)))
        dst, conflict, skip = resolve(directory, stem, ext, src, out["overwrite"], claimed, source_keys)
        plan.append({"src": src, "dst": dst, "conflict": conflict, "skip": skip, "dir": directory, "n": number, "root": entry["root"]})
    return plan


def plan(body: dict) -> dict:
    out = normalise_output(body.get("output"))
    acts = actions.normalise(body.get("actions") or [])
    entries, skipped = collect(body.get("inputs"), bool(body.get("recursive")), body.get("extensions"), out)
    items = build_plan(entries, out, acts)
    return {
        "items": [{"src": item["src"], "dst": item["dst"], "conflict": item["conflict"], "skip": item["skip"]} for item in items],
        "skipped": skipped,
    }


def finish(item: dict, outcome: dict, out: dict, claimed: set, source_keys: set) -> tuple[str | None, str | None]:
    temporary = outcome["tmp"]
    src = item["src"]
    stem = naming.expand(out["naming"], src, item["n"], outcome["width"], outcome["height"], os.path.basename(os.path.dirname(src)))
    ext = worker.output_extension(out["format"], src)
    dst, _, skip = resolve(item["dir"], stem, ext, src, out["overwrite"], claimed, source_keys)
    if skip:
        discard(temporary)
        return None, skip
    try:
        if out["keep_dates"]:
            info = os.stat(src)
            os.utime(temporary, ns=(info.st_atime_ns, info.st_mtime_ns))
        os.replace(temporary, dst)
    except OSError as exc:
        discard(temporary)
        raise ApiError(500, f"could not write the file ({exc.strerror or 'error'})")
    return dst, None


def discard(path: str | None) -> None:
    if path:
        try:
            os.unlink(path)
        except OSError:
            pass


def run(body: dict) -> dict:
    out = normalise_output(body.get("output"))
    acts = actions.normalise(body.get("actions") or [])
    entries, skipped = collect(body.get("inputs"), bool(body.get("recursive")), body.get("extensions"), out)
    if not entries:
        raise ApiError(400, "there are no pictures to process in those inputs")
    items = build_plan(entries, out, acts)
    runnable = [item for item in items if not item["skip"]]
    source_keys = {naming.fs_key(entry["src"]) for entry in entries}
    pre_skipped = len(skipped) + len(items) - len(runnable)

    def work(job: jobs.Job) -> dict:
        result: dict = {"written": 0, "skipped": pre_skipped, "failed": 0, "outputs": []}
        claimed: set = set()
        pending: dict = {}
        queue = list(runnable)
        window = worker_count() + 2

        def launch(item: dict) -> None:
            task = {
                "index": item["n"],
                "src": item["src"],
                "folder": item["dir"],
                "actions": acts,
                "format": out["format"],
                "quality": out["quality"],
                "keep_metadata": out["keep_metadata"],
            }
            future, held = runner.submit(worker.process, task)
            pending[future] = (item, held)

        def settle(future, item: dict, held) -> None:
            try:
                outcome = future.result()
            except BrokenExecutor:
                runner.fall_back(held)
                launch(item)
                return
            except Exception as exc:
                outcome = {"error": f"{type(exc).__name__}: {exc}"}
            job.step(current=os.path.basename(item["src"]))
            if "error" in outcome:
                result["failed"] += 1
                job.error(item["src"], outcome["error"])
                return
            try:
                written, reason = finish(item, outcome, out, claimed, source_keys)
            except ApiError as exc:
                result["failed"] += 1
                job.error(item["src"], exc.message)
                return
            if written:
                result["written"] += 1
                if len(result["outputs"]) < 200:
                    result["outputs"].append(written)
            else:
                result["skipped"] += 1

        try:
            while queue or pending:
                job.check()
                while queue and len(pending) < window:
                    launch(queue.pop(0))
                finished, _ = wait(list(pending), timeout=0.25, return_when=FIRST_COMPLETED)
                for future in finished:
                    item, held = pending.pop(future)
                    settle(future, item, held)
        except Cancelled:
            for future in list(pending):
                future.cancel()
            for future in list(pending):
                if future.cancelled():
                    continue
                try:
                    leftover = future.result()
                    discard(leftover.get("tmp"))
                except Exception:
                    pass
            result["skipped"] += len(queue) + len(pending)
        return result

    title = f"Batch: {len(runnable)} picture{'s' if len(runnable) != 1 else ''}"
    started = time.time()
    job = jobs.start("batch", title, len(runnable), work)
    log.info("batch job %s started with %d pictures in %s mode after %.3fs", job.id, len(runnable), runner.mode or "pending", time.time() - started)
    return job.to_dict()


def preview(body: dict) -> bytes:
    path = absolute(str(body.get("path", "")))
    if not path.is_file():
        raise ApiError(404, "that file does not exist")
    acts = actions.normalise(body.get("actions") or [])
    try:
        limit = max(64, min(4096, int(body.get("max") or 1024)))
    except (TypeError, ValueError):
        raise ApiError(400, "max must be a number")
    source = str(path)
    working = min(4096, max(2048, limit * 2))
    original = None
    try:
        original = max(source_size(source))
    except Exception:
        original = None
    if original is None:
        image = decode.render(source, 0)
        scale = 1.0
    else:
        image = decode.render(source, working)
        scale = min(1.0, max(image.size) / original)
    ctx = {"scale": scale}
    image = actions.apply_chain(image, acts, ctx)
    return worker.preview_bytes(image, limit)
