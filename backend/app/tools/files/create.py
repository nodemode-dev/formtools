import contextlib
import os
import tarfile
import zipfile
from pathlib import Path

import zstandard

from app.core import jobs
from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.files import safety

FORMATS = ("zip", "tar", "tar.gz", "tar.xz", "tar.zst")


class CheckedReader:
    def __init__(self, handle, job: jobs.Job) -> None:
        self.handle = handle
        self.job = job

    def read(self, size: int = -1) -> bytes:
        self.job.check()
        return self.handle.read(size)


def gather(paths: list[str], skip: set[str]) -> tuple[list[tuple[Path, str, bool]], list[tuple[str, str]]]:
    found: list[tuple[Path, str, bool]] = []
    problems: list[tuple[str, str]] = []
    used: set[str] = set()
    for raw in paths:
        source = absolute(raw)
        if not os.path.lexists(source):
            raise ApiError(404, f"{source.name or raw} does not exist")
        top = source.name or "root"
        name = top
        number = 2
        while name.lower() in used:
            name = f"{top} ({number})"
            number += 1
        used.add(name.lower())
        if os.path.islink(source):
            problems.append((str(source), "skipped: symbolic links are not archived"))
            continue
        if source.is_dir():
            found.append((source, name, True))
            for folder, dirs, files in os.walk(source):
                dirs.sort()
                here = Path(folder)
                relative = here.relative_to(source).as_posix()
                base = name if relative == "." else f"{name}/{relative}"
                kept = []
                for child in dirs:
                    full = here / child
                    if os.path.islink(full):
                        problems.append((str(full), "skipped: symbolic links are not archived"))
                    else:
                        kept.append(child)
                        found.append((full, f"{base}/{child}", True))
                dirs[:] = kept
                for child in sorted(files):
                    full = here / child
                    if str(full) in skip:
                        continue
                    if os.path.islink(full) or not full.is_file():
                        problems.append((str(full), "skipped: not a regular file"))
                        continue
                    found.append((full, f"{base}/{child}", False))
        elif source.is_file():
            if str(source) not in skip:
                found.append((source, name, False))
        else:
            problems.append((str(source), "skipped: not a regular file"))
    return found, problems


def add_zip(job: jobs.Job, temp: Path, files: list[tuple[Path, str, bool]]) -> int:
    count = 0
    with zipfile.ZipFile(temp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6, allowZip64=True) as zf:
        for source, arc, is_dir in files:
            job.check()
            job.step(current=arc)
            if is_dir:
                info = zipfile.ZipInfo.from_file(source, arc + "/", strict_timestamps=False)
                zf.writestr(info, b"")
                continue
            try:
                handle = open(source, "rb")
            except OSError as exc:
                job.error(str(source), f"skipped: {exc.strerror or 'unreadable'}")
                continue
            with handle:
                info = zipfile.ZipInfo.from_file(source, arc, strict_timestamps=False)
                info.compress_type = zipfile.ZIP_DEFLATED
                with zf.open(info, "w") as out:
                    while True:
                        job.check()
                        block = handle.read(safety.CHUNK)
                        if not block:
                            break
                        out.write(block)
            count += 1
    return count


def add_tar(job: jobs.Job, temp: Path, files: list[tuple[Path, str, bool]], fmt: str) -> int:
    count = 0
    with contextlib.ExitStack() as stack:
        raw = stack.enter_context(open(temp, "wb"))
        if fmt == "tar.zst":
            sink = stack.enter_context(zstandard.ZstdCompressor(level=3).stream_writer(raw, closefd=False))
            tf = stack.enter_context(tarfile.open(fileobj=sink, mode="w|", format=tarfile.PAX_FORMAT))
        else:
            mode = {"tar": "w|", "tar.gz": "w|gz", "tar.xz": "w|xz"}[fmt]
            tf = stack.enter_context(tarfile.open(fileobj=raw, mode=mode, format=tarfile.PAX_FORMAT))
        for source, arc, is_dir in files:
            job.check()
            job.step(current=arc)
            handle = None
            if not is_dir:
                try:
                    handle = open(source, "rb")
                except OSError as exc:
                    job.error(str(source), f"skipped: {exc.strerror or 'unreadable'}")
                    continue
            try:
                info = tf.gettarinfo(str(source), arcname=arc)
                info.uid = info.gid = 0
                info.uname = info.gname = ""
                if handle is None:
                    tf.addfile(info)
                else:
                    tf.addfile(info, CheckedReader(handle, job))
                    count += 1
            finally:
                if handle is not None:
                    handle.close()
    return count


def start(paths: list[str], out_raw: str, fmt: str) -> dict:
    if fmt not in FORMATS:
        raise ApiError(400, "the archive format must be zip, tar, tar.gz, tar.xz or tar.zst")
    if not paths:
        raise ApiError(400, "at least one file or folder is needed")
    out = absolute(out_raw)
    if not out.parent.is_dir():
        raise ApiError(400, "the folder for the new archive does not exist")
    wanted = safety.unique(out)
    skip = {str(wanted), str(out)}
    files, problems = gather(paths, skip)
    if not files:
        raise ApiError(400, "there is nothing to put in the archive")

    def work(job: jobs.Job) -> dict:
        for where, why in problems:
            job.error(where, why)
        temp = safety.temp_beside(wanted.parent)
        try:
            if fmt == "zip":
                count = add_zip(job, temp, files)
            else:
                count = add_tar(job, temp, files, fmt)
            job.check()
            final = safety.place(temp, wanted)
        finally:
            safety.discard(temp)
        return {"path": str(final), "files": count, "bytes": final.stat().st_size}

    job = jobs.start("archive-create", f"Create {wanted.name}", len(files), work)
    return job.to_dict()
