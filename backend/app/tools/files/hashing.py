import hashlib
import os
import re
import zlib
from pathlib import Path

import blake3
import xxhash

from app.core import jobs
from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.files import safety

ALGORITHMS = ("md5", "sha1", "sha256", "sha512", "sha3_256", "blake3", "xxh64", "crc32")
SUMS_LIMIT = 16 * 1024 * 1024
BY_LENGTH = {8: "crc32", 16: "xxh64", 32: "md5", 40: "sha1", 56: "sha224", 64: "sha256", 96: "sha384", 128: "sha512"}
BY_NAME = {
    "MD5SUMS": "md5",
    "SHA1SUMS": "sha1",
    "SHA224SUMS": "sha224",
    "SHA256SUMS": "sha256",
    "SHA384SUMS": "sha384",
    "SHA512SUMS": "sha512",
    "SHA3-256SUMS": "sha3_256",
    "B3SUMS": "blake3",
    "BLAKE3SUMS": "blake3",
    "XXH64SUMS": "xxh64",
    "CRC32SUMS": "crc32",
}
BY_EXTENSION = {
    ".md5": "md5",
    ".sha1": "sha1",
    ".sha224": "sha224",
    ".sha256": "sha256",
    ".sha384": "sha384",
    ".sha512": "sha512",
    ".sfv": "crc32",
    ".b3": "blake3",
    ".blake3": "blake3",
    ".xxh64": "xxh64",
}
BY_TAG = {
    "MD5": "md5",
    "SHA1": "sha1",
    "SHA224": "sha224",
    "SHA256": "sha256",
    "SHA384": "sha384",
    "SHA512": "sha512",
    "SHA3-256": "sha3_256",
    "SHA3_256": "sha3_256",
    "BLAKE3": "blake3",
    "XXH64": "xxh64",
    "CRC32": "crc32",
}
HEX = re.compile(r"^[0-9a-fA-F]+$")
BSD = re.compile(r"^([A-Za-z0-9_-]+)\s*\((.+)\)\s*=\s*([0-9a-fA-F]+)\s*$")
GNU = re.compile(r"^\\?([0-9a-fA-F]{8,128})(?:\s+\*?|\s*\*)(.+?)\s*$")
SFV = re.compile(r"^(.+?)\s+([0-9a-fA-F]{8})\s*$")


class Crc32:
    def __init__(self) -> None:
        self.value = 0

    def update(self, data: bytes) -> None:
        self.value = zlib.crc32(data, self.value)

    def hexdigest(self) -> str:
        return f"{self.value & 0xFFFFFFFF:08x}"


def make(name: str):
    if name == "crc32":
        return Crc32()
    if name == "blake3":
        return blake3.blake3()
    if name == "xxh64":
        return xxhash.xxh64()
    if name in ("md5", "sha1"):
        return hashlib.new(name, usedforsecurity=False)
    return hashlib.new(name)


def clean_algorithms(raw: list[str]) -> list[str]:
    chosen = []
    for name in raw:
        label = str(name).strip().lower().replace("-", "_")
        if label not in ALGORITHMS:
            raise ApiError(400, f"{name} is not a supported algorithm; use {', '.join(ALGORITHMS)}")
        if label not in chosen:
            chosen.append(label)
    if not chosen:
        raise ApiError(400, "at least one algorithm is needed")
    return chosen


def expand(paths: list[str]) -> list[Path]:
    found: list[Path] = []
    for raw in paths:
        source = absolute(raw)
        if not source.exists():
            raise ApiError(404, f"{source.name or raw} does not exist")
        if source.is_dir():
            for folder, dirs, files in os.walk(source):
                dirs.sort()
                for name in sorted(files):
                    candidate = Path(folder) / name
                    if candidate.is_file():
                        found.append(candidate)
        elif source.is_file():
            found.append(source)
        else:
            raise ApiError(400, f"{source.name} is not a file or a folder")
    if not found:
        raise ApiError(400, "there are no files to hash")
    return found


def digest_file(job: jobs.Job, path: Path, algorithms: list[str], base: int, size_total: int) -> dict[str, str]:
    engines = {name: make(name) for name in algorithms}
    done = 0
    with open(path, "rb") as handle:
        while True:
            job.check()
            block = handle.read(safety.CHUNK)
            if not block:
                break
            for engine in engines.values():
                engine.update(block)
            done += len(block)
            job.step(done=min(base + done, size_total), current=path.name)
    return {name: engine.hexdigest() for name, engine in engines.items()}


def start_hash(paths: list[str], algorithms: list[str]) -> dict:
    chosen = clean_algorithms(algorithms)
    files = expand(paths)
    sizes = []
    for item in files:
        try:
            sizes.append(item.stat().st_size)
        except OSError:
            sizes.append(0)
    grand = sum(sizes)

    def work(job: jobs.Job) -> dict:
        items = []
        base = 0
        for item, size in zip(files, sizes):
            job.check()
            job.step(done=base, current=item.name)
            try:
                hashes = digest_file(job, item, chosen, base, grand)
            except OSError as exc:
                job.error(str(item), f"could not be read ({exc.strerror or 'error'})")
                base += size
                continue
            base += size
            items.append({"path": str(item), "size": size, "hashes": hashes})
        job.step(done=grand)
        return {"items": items}

    job = jobs.start("hash", f"Hash {len(files)} file{'s' if len(files) != 1 else ''}", grand, work)
    return job.to_dict()


def decode_sums(data: bytes) -> str:
    if data.startswith(b"\xef\xbb\xbf"):
        return data[3:].decode("utf-8", "replace")
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        return data.decode("utf-16", "replace")
    return data.decode("utf-8", "replace")


def unescape(name: str, escaped: bool) -> str:
    if not escaped:
        return name
    return name.replace("\\\\", "\x00").replace("\\n", "\n").replace("\x00", "\\")


def parse_sums(path: Path, text: str) -> list[tuple[str, str, str]]:
    ext = path.suffix.lower()
    forced = BY_EXTENSION.get(ext) or BY_NAME.get(path.name.upper())
    entries: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or stripped.startswith(";"):
            continue
        match = BSD.match(stripped)
        if match:
            tag, name, digest = match.group(1).upper(), match.group(2), match.group(3)
            algorithm = BY_TAG.get(tag)
            if algorithm and (algorithm == "blake3" or len(digest) == expected_length(algorithm)):
                entries.append((name, algorithm, digest.lower()))
            continue
        if ext == ".sfv":
            sfv = SFV.match(stripped)
            if sfv:
                entries.append((sfv.group(1), "crc32", sfv.group(2).lower()))
            continue
        gnu = GNU.match(stripped)
        if gnu:
            digest = gnu.group(1)
            algorithm = BY_LENGTH.get(len(digest))
            if forced and (forced == "blake3" or len(digest) == expected_length(forced)):
                algorithm = forced
            if algorithm:
                entries.append((unescape(gnu.group(2), stripped.startswith("\\")), algorithm, digest.lower()))
            continue
        sfv = SFV.match(stripped)
        if sfv and not HEX.match(stripped.split()[0]):
            entries.append((sfv.group(1), "crc32", sfv.group(2).lower()))
    return entries


def expected_length(algorithm: str) -> int:
    return {"crc32": 8, "md5": 32, "sha1": 40, "sha224": 56, "sha256": 64, "sha384": 96, "sha512": 128, "sha3_256": 64, "xxh64": 16}.get(algorithm, 0)


def resolve(base: Path, name: str) -> Path:
    candidate = Path(name)
    if not candidate.is_absolute():
        candidate = base / name
    if not candidate.exists() and "\\" in name:
        alternate = base / name.replace("\\", "/")
        if alternate.exists():
            return alternate
    return candidate


def start_verify(raw: str) -> dict:
    source = absolute(raw)
    if not source.is_file():
        raise ApiError(404, "that checksum file does not exist")
    if source.stat().st_size > SUMS_LIMIT:
        raise ApiError(400, "that checksum file is larger than 16 MB")
    entries = parse_sums(source, decode_sums(source.read_bytes()))
    if not entries:
        raise ApiError(400, "no checksums were found in that file")
    base = source.parent
    targets = [(resolve(base, name), algorithm, digest) for name, algorithm, digest in entries]
    sizes = []
    for target, _, _ in targets:
        try:
            sizes.append(target.stat().st_size if target.is_file() else 0)
        except OSError:
            sizes.append(0)
    grand = sum(sizes)

    def work(job: jobs.Job) -> dict:
        items = []
        good = bad = missing = 0
        offset = 0
        for (target, algorithm, digest), size in zip(targets, sizes):
            job.check()
            job.step(done=offset, current=target.name)
            if not target.is_file():
                items.append({"path": str(target), "expected": digest, "actual": None, "ok": False, "missing": True})
                missing += 1
                continue
            try:
                actual = digest_file(job, target, [algorithm], offset, grand)[algorithm]
            except OSError as exc:
                job.error(str(target), f"could not be read ({exc.strerror or 'error'})")
                items.append({"path": str(target), "expected": digest, "actual": None, "ok": False, "missing": False})
                bad += 1
                offset += size
                continue
            offset += size
            match = actual == digest
            items.append({"path": str(target), "expected": digest, "actual": actual, "ok": match, "missing": False})
            if match:
                good += 1
            else:
                bad += 1
        job.step(done=grand)
        return {"items": items, "ok": good, "failed": bad, "missing": missing}

    job = jobs.start("hash-verify", f"Verify {source.name}", grand, work)
    return job.to_dict()
