import base64
import hashlib
import hmac
import json
import logging
import os
import re
import shutil
import tarfile
import tempfile
import threading
import urllib.request
from pathlib import Path, PurePosixPath

from app.core import config, jobs
from app.core.errors import ApiError

EXIFTOOL = "13.60"
REGISTRY = "https://registry.npmjs.org"
MARKER = "formtools-verified.json"
LIMIT_DOWNLOAD = 120 * 1024 * 1024
LIMIT_UNPACKED = 200 * 1024 * 1024
LIMIT_MEMBERS = 5000

PACKAGES = {
    "perl": {
        "name": "exiftool-vendored.pl",
        "version": "13.60.0",
        "integrity": "sha512-RPXLoynEgak2D9zclE4oCpXII4S3EZlHXJIFHvjktByDgM7+ievXBfqtEWw6dK0xbk/L+cLVTWKoUBhOH+P/1A==",
        "bin": "package/bin",
        "script": "exiftool",
        "library": "lib/Image/ExifTool.pm",
    },
    "exe": {
        "name": "exiftool-vendored.exe",
        "version": "13.60.0",
        "integrity": "sha512-DcpybFsR7Dp3FMrPDaq3iy+dcFrPTYENJeazy19TQoefpp4MQml5YXMAx2TpYRFuYoFLcXi9dupyufdrj6sS+A==",
        "bin": "package/bin",
        "script": "exiftool.exe",
        "library": "exiftool_files/lib/Image/ExifTool.pm",
    },
}

PERL_SENTENCE = "ExifTool needs Perl and perl was not found on this computer; install Perl or put an ExifTool on PATH."

log = logging.getLogger("formtools.exif.fetch")

STATE: dict = {"fetching": False, "error": None, "job": None}
_state_lock = threading.Lock()


def windows() -> bool:
    return os.name == "nt"


def package() -> dict:
    return PACKAGES["exe" if windows() else "perl"]


def folder() -> Path:
    return config.data_dir() / "formtools-binaries" / f"exiftool-{EXIFTOOL}"


def tarball_url() -> str:
    pinned = package()
    base = (os.environ.get("FORMTOOLS_EXIFTOOL_REGISTRY") or REGISTRY).rstrip("/")
    return f"{base}/{pinned['name']}/-/{pinned['name']}-{pinned['version']}.tgz"


def script_of(where: Path) -> Path:
    return where / package()["script"]


def verified(where: Path) -> bool:
    try:
        record = json.loads((where / MARKER).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False
    pinned = package()
    return (
        isinstance(record, dict)
        and record.get("exiftool") == EXIFTOOL
        and record.get("package") == pinned["name"]
        and record.get("integrity") == pinned["integrity"]
        and script_of(where).is_file()
    )


def integrity_of(digest: bytes) -> str:
    return "sha512-" + base64.b64encode(digest).decode("ascii")


def download(url: str, target: Path, job: jobs.Job | None) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "formtools"})
    digest = hashlib.sha512()
    got = 0
    size = 0
    with urllib.request.urlopen(request, timeout=60) as response, target.open("wb") as out:
        length = response.headers.get("Content-Length")
        if length and length.isdigit():
            size = int(length)
        if job is not None:
            job.step(done=0, total=size)
        while True:
            if job is not None:
                job.check()
            block = response.read(1 << 18)
            if not block:
                break
            got += len(block)
            if got > LIMIT_DOWNLOAD:
                raise ValueError("the download is larger than the package record allows, so nothing was installed")
            digest.update(block)
            out.write(block)
            if job is not None:
                job.step(done=min(got, size) if size else got)
    return integrity_of(digest.digest())


def safe_name(name: str) -> PurePosixPath:
    if not name or "\x00" in name or "\\" in name or name.startswith("/") or re.match(r"^[A-Za-z]:", name):
        raise ValueError(f"the package holds an unsafe path ({name!r}), so nothing was installed")
    path = PurePosixPath(name)
    if ".." in path.parts:
        raise ValueError(f"the package holds an unsafe path ({name!r}), so nothing was installed")
    return path


def unpack(archive: Path, staged: Path) -> None:
    pinned = package()
    prefix = PurePosixPath(pinned["bin"])
    total = 0
    wanted = []
    with tarfile.open(archive, "r:gz") as bundle:
        members = bundle.getmembers()
        if len(members) > LIMIT_MEMBERS:
            raise ValueError("the package holds more files than expected, so nothing was installed")
        for member in members:
            path = safe_name(member.name)
            if not (member.isreg() or member.isdir()):
                raise ValueError(f"the package holds a link or special file ({member.name!r}), so nothing was installed")
            total += max(0, member.size)
            if total > LIMIT_UNPACKED:
                raise ValueError("the package unpacks larger than expected, so nothing was installed")
            if member.isreg() and path == PurePosixPath("package/LICENSE"):
                wanted.append((member, staged / "NPM-PACKAGE-LICENSE.txt"))
            elif member.isreg() and prefix in path.parents:
                wanted.append((member, staged.joinpath(*path.relative_to(prefix).parts)))
        root = staged.resolve()
        for member, target in wanted:
            resolved = target.resolve()
            if root != resolved and root not in resolved.parents:
                raise ValueError(f"the package holds an unsafe path ({member.name!r}), so nothing was installed")
            target.parent.mkdir(parents=True, exist_ok=True)
            source = bundle.extractfile(member)
            if source is None:
                continue
            with source, target.open("wb") as out:
                shutil.copyfileobj(source, out, 1 << 20)
            target.chmod(0o755 if member.mode & 0o111 else 0o644)


def check_library(staged: Path) -> None:
    pinned = package()
    script = staged / pinned["script"]
    library = staged.joinpath(*pinned["library"].split("/"))
    if not script.is_file() or not library.is_file():
        raise ValueError("the package does not hold the ExifTool files it should, so nothing was installed")
    head = library.read_text(encoding="utf-8", errors="replace")[:6000]
    found = re.search(r"\$VERSION\s*=\s*'([^']+)'", head)
    if not found or found.group(1) != EXIFTOOL:
        raise ValueError(f"the package holds ExifTool {found.group(1) if found else 'of unknown version'}, not {EXIFTOOL}, so nothing was installed")


def install(archive: Path, got: str, where: Path) -> None:
    pinned = package()
    if not hmac.compare_digest(got.encode("ascii"), pinned["integrity"].encode("ascii")):
        raise ValueError("the download does not match the pinned integrity value, so nothing was installed")
    where.parent.mkdir(parents=True, exist_ok=True)
    scratch = Path(tempfile.mkdtemp(prefix=".exiftool-", dir=where.parent))
    try:
        staged = scratch / "staged"
        staged.mkdir()
        unpack(archive, staged)
        check_library(staged)
        (staged / MARKER).write_text(
            json.dumps({"exiftool": EXIFTOOL, "package": pinned["name"], "package_version": pinned["version"], "integrity": pinned["integrity"]}, indent=2),
            encoding="utf-8",
        )
        if where.exists() and not verified(where):
            shutil.rmtree(where, ignore_errors=True)
        if not where.exists():
            os.replace(staged, where)
    finally:
        shutil.rmtree(scratch, ignore_errors=True)
    if not verified(where):
        raise ValueError(f"ExifTool could not be placed in {where}")


def work(job: jobs.Job) -> dict:
    where = folder()
    if verified(where):
        return {"path": str(script_of(where)), "version": EXIFTOOL, "downloaded": False}
    pinned = package()
    with tempfile.TemporaryDirectory(prefix="formtools-exiftool-") as scratch:
        archive = Path(scratch) / "package.tgz"
        job.step(done=0, total=0, current=f"Downloading ExifTool {EXIFTOOL}")
        got = download(tarball_url(), archive, job)
        job.check()
        job.step(done=job.done, current="Checking the download")
        job.step(done=job.done, current="Unpacking")
        install(archive, got, where)
    log.info("exiftool %s from %s %s placed in %s", EXIFTOOL, pinned["name"], pinned["version"], where)
    return {"path": str(script_of(where)), "version": EXIFTOOL, "downloaded": True}


def tracked(job: jobs.Job) -> dict:
    try:
        return work(job)
    except jobs.Cancelled:
        raise
    except ApiError as exc:
        STATE["error"] = f"ExifTool {EXIFTOOL} could not be fetched: {exc.message}"
        raise
    except Exception as exc:
        STATE["error"] = f"ExifTool {EXIFTOOL} could not be fetched: {exc}"
        log.warning("%s", STATE["error"])
        raise
    finally:
        STATE["fetching"] = False


def start() -> dict:
    if not windows() and not shutil.which("perl"):
        raise ApiError(503, PERL_SENTENCE)
    with _state_lock:
        if STATE["fetching"] and STATE["job"] is not None:
            try:
                return jobs.get(STATE["job"]).to_dict()
            except ApiError:
                pass
        STATE["fetching"] = True
        STATE["error"] = None
        job = jobs.start("exiftool-fetch", f"Getting ExifTool {EXIFTOOL}", 0, tracked)
        STATE["job"] = job.id
    return job.to_dict()
