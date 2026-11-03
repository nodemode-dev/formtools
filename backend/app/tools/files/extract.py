import os
import sys
import zipfile
from pathlib import Path

import lzma
import zstandard

from app.core import jobs
from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.files import archive, safety

SUFFIXES = (".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst")


def stem_of(path: Path) -> str:
    lowered = path.name.lower()
    for suffix in SUFFIXES:
        if lowered.endswith(suffix):
            return path.name[: -len(suffix)] or path.name
    return path.stem or path.name


def choose_dest(source: Path, raw: str | None) -> Path:
    if raw:
        dest = absolute(raw)
        if dest.exists() and not dest.is_dir():
            raise ApiError(400, "the destination is a file, not a folder")
        return dest
    return safety.unique(source.parent / stem_of(source))


def matcher(members: list[str] | None):
    if not members:
        return None
    wanted = [m.replace("\\", "/").strip("/") for m in members if m and m.strip("/\\")]
    if not wanted:
        return None

    def wants(name: str) -> bool:
        clean = name.replace("\\", "/").strip("/")
        return any(clean == w or clean.startswith(w + "/") for w in wanted)

    return wants


def zone_identifier(source: Path) -> bytes | None:
    if not sys.platform.startswith("win"):
        return None
    try:
        with open(f"{source}:Zone.Identifier", "rb") as handle:
            return handle.read()
    except OSError:
        return None


def mark_of_the_web(final: Path, zone: bytes | None) -> None:
    if zone is None:
        return
    try:
        with open(f"{final}:Zone.Identifier", "wb") as handle:
            handle.write(zone)
    except OSError:
        pass


def write_member(job: jobs.Job, item: archive.Item, target: Path, budget: safety.Budget) -> Path:
    temp = safety.temp_beside(target.parent)
    try:
        with item.opener() as source, open(temp, "xb") as out:
            while True:
                job.check()
                block = source.read(safety.CHUNK)
                if not block:
                    break
                budget.add(len(block))
                out.write(block)
        if item.mtime:
            try:
                os.utime(temp, (item.mtime, item.mtime))
            except (OSError, OverflowError, ValueError):
                pass
        if item.mode & 0o111:
            try:
                os.chmod(temp, 0o755)
            except OSError:
                pass
        return safety.place(temp, target)
    finally:
        safety.discard(temp)


def run(job: jobs.Job, source: Path, dest: Path, members: list[str] | None) -> dict:
    wants = matcher(members)
    zone = zone_identifier(source)
    written = 0
    skipped = 0
    found = set()
    dest.mkdir(parents=True, exist_ok=True)
    real_dest = Path(os.path.realpath(dest))
    with archive.open_archive(source) as opened:
        budget = safety.Budget(opened.size)
        known = opened.count()
        if known is not None:
            job.step(done=0, total=known)
        for item in opened.items():
            job.check()
            if wants is not None and not wants(item.name):
                continue
            found.add(item.name)
            job.step(current=item.name)
            try:
                parts = safety.split_name(item.name)
            except safety.Refused as exc:
                job.error(item.name, f"refused: {exc}")
                skipped += 1
                continue
            if item.link:
                job.error(item.name, "skipped: links are never created or followed")
                skipped += 1
                continue
            if item.special:
                job.error(item.name, "skipped: not a regular file or folder")
                skipped += 1
                continue
            if item.encrypted:
                job.error(item.name, "skipped: password protected")
                skipped += 1
                continue
            try:
                if item.dir:
                    safety.safe_folder(real_dest, parts)
                    continue
                budget.declared(item.size)
                target = safety.prepare_target(real_dest, parts)
                final = write_member(job, item, safety.unique(target), budget)
                mark_of_the_web(final, zone)
                written += 1
            except safety.Refused as exc:
                job.error(item.name, f"refused: {exc}")
                skipped += 1
            except OSError as exc:
                job.error(item.name, f"skipped: {exc.strerror or 'the file could not be written'}")
                skipped += 1
            except (RuntimeError, NotImplementedError, zipfile.BadZipFile, EOFError, lzma.LZMAError, zstandard.ZstdError) as exc:
                job.error(item.name, f"skipped: {str(exc)[:120] or 'the data could not be read'}")
                skipped += 1
    if wants is not None and members:
        for asked in members:
            clean = asked.replace("\\", "/").strip("/")
            if not any(name.replace("\\", "/").strip("/") == clean or name.replace("\\", "/").strip("/").startswith(clean + "/") for name in found):
                job.error(asked, "that member is not in the archive")
    return {"dest": str(dest), "written": written, "skipped": skipped}


def start(raw: str, dest_raw: str | None, members: list[str] | None) -> dict:
    source = absolute(raw)
    archive.open_archive(source).close()
    dest = choose_dest(source, dest_raw)

    def work(job: jobs.Job) -> dict:
        return run(job, source, dest, members)

    job = jobs.start("archive-extract", f"Extract {source.name}", 0, work)
    return job.to_dict()
