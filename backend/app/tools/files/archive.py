import bz2
import gzip
import io
import lzma
import os
import stat
import struct
import tarfile
import time
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Callable, Iterator

import zstandard

from app.core.errors import ApiError
from app.core.filetypes import content_type
from app.tools.files import safety

try:
    import libarchive
    from libarchive import ffi as libarchive_ffi

    if not libarchive_ffi.libarchive_path:
        raise OSError("the libarchive shared library was not found")
    LIBARCHIVE = True
    LIBARCHIVE_NOTE = None
    LIBARCHIVE_PATH = str(libarchive_ffi.libarchive_path)
except Exception as exc:
    libarchive = None
    LIBARCHIVE = False
    LIBARCHIVE_NOTE = f"{type(exc).__name__}: {exc}"
    LIBARCHIVE_PATH = None

MEMBER_LIMIT = 64 * 1024 * 1024
COMPRESSIONS = {"gz": b"\x1f\x8b", "bz2": b"BZh", "xz": b"\xfd7zXZ\x00", "zst": b"\x28\xb5\x2f\xfd"}
TAR_NAMES = (".tar.gz", ".tgz", ".tar.bz2", ".tbz2", ".tbz", ".tar.xz", ".txz", ".tar.zst", ".tzst", ".tar")
SINGLE_EXTENSIONS = {".gz": "gz", ".bz2": "bz2", ".xz": "xz", ".zst": "zst"}
NO_LIBARCHIVE = "formtools can open zip, tar and single compressed files itself; this archive needs libarchive, which is not installed on this system"
NOT_ARCHIVE = "formtools could not read that file as an archive"
DAMAGED = "that archive is damaged or cut short"


@dataclass
class Item:
    name: str
    size: int | None
    packed: int | None
    mtime: float | None
    dir: bool
    encrypted: bool
    link: bool
    special: bool
    mode: int
    opener: Callable[[], BinaryIO] | None


class BlockReader(io.RawIOBase):
    def __init__(self, entry) -> None:
        self.blocks = entry.get_blocks(safety.CHUNK)
        self.buffer = b""

    def readable(self) -> bool:
        return True

    def read(self, size: int = -1) -> bytes:
        while size < 0 or len(self.buffer) < size:
            block = next(self.blocks, None)
            if block is None:
                break
            self.buffer += block
        if size < 0:
            out, self.buffer = self.buffer, b""
        else:
            out, self.buffer = self.buffer[:size], self.buffer[size:]
        return out


def open_compressed(path: Path, comp: str) -> BinaryIO:
    if comp == "gz":
        return gzip.open(path, "rb")
    if comp == "bz2":
        return bz2.open(path, "rb")
    if comp == "xz":
        return lzma.open(path, "rb")
    handle = open(path, "rb")
    return zstandard.ZstdDecompressor().stream_reader(handle, read_across_frames=True)


def tar_named(path: Path) -> bool:
    return path.name.lower().endswith(TAR_NAMES)


def sniff(path: Path) -> tuple[str, str | None] | None:
    try:
        with open(path, "rb") as handle:
            head = handle.read(600)
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    if head[:4] in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
        return "zip", None
    for comp, magic in COMPRESSIONS.items():
        if head.startswith(magic):
            try:
                with open_compressed(path, comp) as stream:
                    inner = stream.read(512)
            except (OSError, EOFError, lzma.LZMAError, zstandard.ZstdError):
                raise ApiError(400, DAMAGED)
            if inner[257:262] == b"ustar" or tar_named(path):
                return "tar", comp
            return "single", comp
    if head[257:262] == b"ustar":
        return "tar", None
    if path.name.lower().endswith(".tar") and tarfile.is_tarfile(path):
        return "tar", None
    if path.suffix.lower() in (".zip", ".jar", ".apk", ".docx", ".xlsx", ".pptx", ".epub") and zipfile.is_zipfile(path):
        return "zip", None
    return None


def zip_mtime(info: zipfile.ZipInfo) -> float | None:
    try:
        return time.mktime(tuple(info.date_time) + (0, 0, -1))
    except (OverflowError, ValueError):
        return None


class Archive:
    format = ""
    engine = ""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.size = path.stat().st_size

    def __enter__(self) -> "Archive":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def close(self) -> None:
        pass

    def count(self) -> int | None:
        return None

    def items(self) -> Iterator[Item]:
        raise NotImplementedError


class ZipArchive(Archive):
    format = "zip"
    engine = "zipfile"

    def __init__(self, path: Path) -> None:
        super().__init__(path)
        try:
            self.zf = zipfile.ZipFile(path)
        except (zipfile.BadZipFile, OSError, ValueError):
            raise ApiError(400, DAMAGED)

    def close(self) -> None:
        self.zf.close()

    def count(self) -> int:
        return len(self.zf.infolist())

    def items(self) -> Iterator[Item]:
        for info in self.zf.infolist():
            mode = info.external_attr >> 16 if info.create_system == 3 else 0
            kind = stat.S_IFMT(mode)
            link = kind == stat.S_IFLNK
            special = kind not in (0, stat.S_IFREG, stat.S_IFDIR, stat.S_IFLNK)
            yield Item(
                name=info.filename,
                size=info.file_size,
                packed=info.compress_size,
                mtime=zip_mtime(info),
                dir=info.is_dir(),
                encrypted=bool(info.flag_bits & 0x1) or info.compress_type == 99,
                link=link,
                special=special,
                mode=mode & 0o7777,
                opener=lambda info=info: self.zf.open(info),
            )


class TarArchive(Archive):
    engine = "tarfile"

    def __init__(self, path: Path, comp: str | None) -> None:
        super().__init__(path)
        self.comp = comp
        self.format = f"tar.{comp}" if comp else "tar"

    def items(self) -> Iterator[Item]:
        stream = open_compressed(self.path, self.comp) if self.comp else open(self.path, "rb")
        try:
            with tarfile.open(fileobj=stream, mode="r|") as tf:
                for info in tf:
                    link = info.issym() or info.islnk()
                    regular = info.isreg()
                    yield Item(
                        name=info.name,
                        size=info.size if regular else 0,
                        packed=info.size if regular and not self.comp else None,
                        mtime=float(info.mtime) if info.mtime else None,
                        dir=info.isdir(),
                        encrypted=False,
                        link=link,
                        special=not (regular or info.isdir() or link),
                        mode=info.mode & 0o7777,
                        opener=lambda info=info: tf.extractfile(info),
                    )
                    tf.members = []
        except (tarfile.TarError, OSError, EOFError, lzma.LZMAError, zstandard.ZstdError):
            raise ApiError(400, DAMAGED)
        finally:
            stream.close()


class SingleArchive(Archive):
    engine = "tarfile"

    def __init__(self, path: Path, comp: str) -> None:
        super().__init__(path)
        self.comp = comp
        self.format = comp

    def inner_name(self) -> str:
        suffix = self.path.suffix.lower()
        stem = self.path.stem if SINGLE_EXTENSIONS.get(suffix) == self.comp else ""
        return stem or f"{self.path.name}.out"

    def unpacked_size(self) -> int | None:
        try:
            with open(self.path, "rb") as handle:
                if self.comp == "gz":
                    handle.seek(-4, os.SEEK_END)
                    return struct.unpack("<I", handle.read(4))[0]
                if self.comp == "zst":
                    params = zstandard.get_frame_parameters(handle.read(18))
                    return params.content_size if params.content_size >= 0 else None
        except (OSError, struct.error, zstandard.ZstdError):
            return None
        return None

    def items(self) -> Iterator[Item]:
        info = self.path.stat()
        yield Item(
            name=self.inner_name(),
            size=self.unpacked_size(),
            packed=info.st_size,
            mtime=info.st_mtime,
            dir=False,
            encrypted=False,
            link=False,
            special=False,
            mode=0,
            opener=lambda: open_compressed(self.path, self.comp),
        )


class LibArchive(Archive):
    engine = "libarchive"

    def __init__(self, path: Path) -> None:
        super().__init__(path)
        self.format = path.suffix.lower().lstrip(".") or "archive"

    def items(self) -> Iterator[Item]:
        try:
            with libarchive.file_reader(str(self.path)) as reader:
                for entry in reader:
                    name = entry.pathname or ""
                    link = bool(entry.issym or entry.islnk)
                    regular = bool(entry.isreg)
                    label = reader.format_name
                    if label:
                        self.format = (label.decode("utf-8", "replace") if isinstance(label, bytes) else str(label)).lower()
                    try:
                        mtime = entry.mtime
                    except (OverflowError, ValueError, OSError):
                        mtime = None
                    yield Item(
                        name=name,
                        size=entry.size if regular and entry.size is not None else 0,
                        packed=None,
                        mtime=float(mtime) if mtime else None,
                        dir=bool(entry.isdir),
                        encrypted=False,
                        link=link,
                        special=not (regular or entry.isdir or link),
                        mode=(entry.mode or 0) & 0o7777,
                        opener=lambda entry=entry: BlockReader(entry),
                    )
        except Exception as exc:
            if isinstance(exc, ApiError):
                raise
            if libarchive is not None and isinstance(exc, libarchive.ArchiveError):
                text = str(exc)
                if "assphrase" in text or "ncrypt" in text:
                    raise ApiError(400, "that archive is password protected")
                reason = text.splitlines()[0].split(" (errno")[0][:120] if text else "unknown format"
                raise ApiError(415, f"{NOT_ARCHIVE} ({reason})")
            raise


def open_archive(path: Path) -> Archive:
    if not path.exists():
        raise ApiError(404, "that file does not exist")
    if not path.is_file():
        raise ApiError(400, "that path is not a file")
    found = sniff(path)
    if found is None:
        if not LIBARCHIVE:
            raise ApiError(415, NO_LIBARCHIVE)
        return LibArchive(path)
    kind, comp = found
    if kind == "zip":
        return ZipArchive(path)
    if kind == "tar":
        return TarArchive(path, comp)
    return SingleArchive(path, comp)


def base_name(name: str) -> str:
    return name.rstrip("/\\").replace("\\", "/").rsplit("/", 1)[-1]


def describe(item: Item) -> dict:
    return {
        "name": base_name(item.name) or item.name,
        "member": item.name,
        "size": item.size,
        "packed": item.packed,
        "mtime": item.mtime,
        "dir": item.dir,
        "encrypted": item.encrypted,
        "link": item.link,
    }


def list_archive(path: Path, limit: int) -> dict:
    limit = max(1, min(int(limit), 200000))
    entries = []
    total = 0
    with open_archive(path) as archive:
        for item in archive.items():
            total += 1
            if len(entries) < limit:
                entries.append(describe(item))
        return {"format": archive.format, "entries": entries, "total": total, "truncated": total > len(entries), "engine": archive.engine}


def read_member(path: Path, member: str) -> tuple[bytes, str]:
    wanted = member.rstrip("/")
    with open_archive(path) as archive:
        for item in archive.items():
            if item.name.rstrip("/") != wanted:
                continue
            if item.dir:
                raise ApiError(400, "that member is a folder")
            if item.link or item.special:
                raise ApiError(400, "that member is a link or a special file")
            if item.encrypted:
                raise ApiError(400, "that member is password protected")
            if item.size is not None and item.size > MEMBER_LIMIT:
                raise ApiError(400, "that member is larger than 64 MB")
            try:
                with item.opener() as stream:
                    data = stream.read(MEMBER_LIMIT + 1)
            except (RuntimeError, NotImplementedError, zipfile.BadZipFile, OSError, EOFError, lzma.LZMAError, zstandard.ZstdError) as exc:
                raise ApiError(400, f"that member could not be read ({str(exc)[:100]})")
            if len(data) > MEMBER_LIMIT:
                raise ApiError(400, "that member is larger than 64 MB")
            return data, content_type(base_name(item.name))
    raise ApiError(404, "that member is not in the archive")
