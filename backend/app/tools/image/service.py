import hashlib
import io
import logging
import os
import threading
import time
from pathlib import Path

from PIL import Image

from app.core import config
from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.image import decode

log = logging.getLogger("formtools.image")

SLOTS = threading.BoundedSemaphore(4)
THUMB_RANGE = (64, 512)
VIEW_LIMIT = 30_000
WEBP_SIDE = 16383
CACHE_BYTES = 512 * 1024 * 1024
THUMB_QUALITY = 82
VIEW_QUALITY = 92


def existing_file(raw: str) -> Path:
    target = absolute(raw)
    if not target.exists():
        raise ApiError(404, "that file does not exist")
    if not target.is_file():
        raise ApiError(400, "that path is not a file")
    return target


def thumb_folder() -> Path:
    return config.cache_dir("thumbs")


def thumb_file(target: Path, size: int, info: os.stat_result) -> Path:
    key = f"{target}|{size}|{info.st_mtime_ns}|{info.st_size}".encode("utf-8", "surrogatepass")
    digest = hashlib.sha1(key).hexdigest()
    return thumb_folder() / digest[:2] / f"{digest}.webp"


def has_alpha(image: Image.Image) -> bool:
    return image.mode == "RGBA" and image.getchannel("A").getextrema()[0] < 255


def encode(image: Image.Image, kind: str, quality: int) -> bytes:
    buffer = io.BytesIO()
    if kind == "webp":
        image.save(buffer, "WEBP", quality=quality, method=4)
    else:
        image.save(buffer, "PNG", compress_level=3)
    return buffer.getvalue()


def thumb(raw: str, size: int) -> Path:
    target = existing_file(raw)
    size = max(THUMB_RANGE[0], min(THUMB_RANGE[1], size))
    info = target.stat()
    cached = thumb_file(target, size, info)
    if cached.is_file():
        os.utime(cached, None)
        return cached
    with SLOTS:
        image = decode.render(str(target), size)
        data = encode(image, "webp", THUMB_QUALITY)
    cached.parent.mkdir(parents=True, exist_ok=True)
    temporary = cached.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, cached)
    return cached


def view(raw: str, limit: int) -> tuple[bytes, str]:
    target = existing_file(raw)
    if limit < 0 or limit > VIEW_LIMIT:
        raise ApiError(400, f"max must be between 0 and {VIEW_LIMIT}")
    with SLOTS:
        image = decode.render(str(target), limit)
        if image.mode == "RGBA" and has_alpha(image):
            return encode(image, "png", 0), "image/png"
        if image.mode == "RGBA":
            image = image.convert("RGB")
        if max(image.size) <= WEBP_SIDE:
            return encode(image, "webp", VIEW_QUALITY), "image/webp"
        return encode(image, "png", 0), "image/png"


def prune() -> None:
    started = time.time()
    entries = []
    total = 0
    try:
        for folder, _, names in os.walk(thumb_folder()):
            for name in names:
                path = Path(folder) / name
                try:
                    info = path.stat()
                except OSError:
                    continue
                if name.endswith(".tmp") and started - info.st_mtime > 3600:
                    path.unlink(missing_ok=True)
                    continue
                entries.append((info.st_atime, info.st_mtime, info.st_size, path))
                total += info.st_size
    except OSError:
        return
    if total <= CACHE_BYTES:
        return
    entries.sort(key=lambda item: max(item[0], item[1]))
    for _, _, size, path in entries:
        if total <= CACHE_BYTES * 0.8:
            break
        try:
            path.unlink()
            total -= size
        except OSError:
            continue
    log.info("thumbnail cache pruned to %s bytes", total)
