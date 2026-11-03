import os
import shutil
import struct
from pathlib import Path

from PIL import Image, JpegImagePlugin, TiffImagePlugin
from PIL.PngImagePlugin import PngInfo

from app.core.errors import ApiError
from app.tools.image import decode, info, orient
from app.tools.image.service import existing_file

ORIENTATION_TAG = 0x0112
EXIF_HEADER = b"Exif\x00\x00"
TIFF_STRUCTURE = frozenset(
    {254, 255, 256, 257, 258, 259, 262, 266, 273, 274, 277, 278, 279, 284, 317, 320, 322, 323, 324, 325, 330, 338, 339, 34665, 34675, 34853, 40965, 530}
)
WRITABLE = ("JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF")
MESSAGE = "formtools can turn JPEG, PNG, WebP, GIF, BMP and TIFF files; other formats are view-only"


def segments(data: bytes):
    position = 2
    while position + 4 <= len(data) and data[position] == 0xFF:
        marker = data[position + 1]
        if marker == 0xFF:
            position += 1
            continue
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            position += 2
            continue
        if marker in (0xDA, 0xD9):
            return
        length = struct.unpack(">H", data[position + 2 : position + 4])[0]
        yield marker, position, length
        position += 2 + length


def orientation_slot(data: bytes, start: int, length: int):
    tiff = start + 4 + len(EXIF_HEADER)
    end = start + 2 + length
    if end - tiff < 8:
        return None
    order = data[tiff : tiff + 2]
    if order not in (b"II", b"MM"):
        return None
    endian = "<" if order == b"II" else ">"
    offset = struct.unpack(endian + "I", data[tiff + 4 : tiff + 8])[0]
    entries = tiff + offset
    if entries + 2 > end:
        return None
    count = struct.unpack(endian + "H", data[entries : entries + 2])[0]
    for index in range(count):
        entry = entries + 2 + index * 12
        if entry + 12 > end:
            return None
        tag, kind, number = struct.unpack(endian + "HHI", data[entry : entry + 8])
        if tag == ORIENTATION_TAG:
            if kind != 3 or number != 1:
                return None
            return entry + 8, endian
    return None


def new_exif_segment(orientation: int) -> bytes:
    tiff = b"MM\x00\x2a\x00\x00\x00\x08" + struct.pack(">H", 1) + struct.pack(">HHIHH", ORIENTATION_TAG, 3, 1, orientation, 0) + b"\x00\x00\x00\x00"
    payload = EXIF_HEADER + tiff
    return b"\xff\xe1" + struct.pack(">H", len(payload) + 2) + payload


def patch_orientation(data: bytes, operation: str) -> bytes | None:
    if data[:3] != b"\xff\xd8\xff":
        return None
    exif_start = None
    exif_length = 0
    first_end = 2
    for index, (marker, start, length) in enumerate(segments(data)):
        if index == 0 and marker == 0xE0:
            first_end = start + 2 + length
        if marker == 0xE1 and data[start + 4 : start + 4 + len(EXIF_HEADER)] == EXIF_HEADER:
            exif_start, exif_length = start, length
            break
    if exif_start is None:
        return data[:first_end] + new_exif_segment(orient.compose(1, operation)) + data[first_end:]
    slot = orientation_slot(data, exif_start, exif_length)
    if slot is None:
        return None
    where, endian = slot
    current = struct.unpack(endian + "H", data[where : where + 2])[0]
    updated = orient.compose(orient.valid(current), operation)
    patched = bytearray(data)
    patched[where : where + 2] = struct.pack(endian + "H", updated)
    return bytes(patched)


def write_beside(target: Path, writer) -> None:
    temporary = target.with_name(f".{target.name}.formtools-{os.getpid()}.tmp")
    try:
        writer(temporary)
        try:
            shutil.copymode(target, temporary)
        except OSError:
            pass
        os.replace(temporary, target)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def quantised_jpeg(target: Path, operation: str) -> None:
    with Image.open(target) as image:
        image.load()
        exif = image.getexif()
        pixels = orient.apply(image, exif.get(ORIENTATION_TAG, 1)).transpose(orient.OPERATION_TRANSPOSE[operation])
        if ORIENTATION_TAG in exif:
            exif[ORIENTATION_TAG] = 1
        sampling = JpegImagePlugin.get_sampling(image)
        options = {"qtables": image.quantization, "subsampling": sampling if sampling >= 0 else 0, "optimize": True}
        if image.info.get("icc_profile"):
            options["icc_profile"] = image.info["icc_profile"]
        if len(exif):
            options["exif"] = exif.tobytes()
        write_beside(target, lambda path: pixels.save(path, "JPEG", **options))


def transform_jpeg(target: Path, operation: str, lossless: bool) -> bool:
    if lossless:
        patched = patch_orientation(target.read_bytes(), operation)
        if patched is not None:
            write_beside(target, lambda path: path.write_bytes(patched))
            return True
    quantised_jpeg(target, operation)
    return False


def png_info(image: Image.Image) -> PngInfo | None:
    text = getattr(image, "text", None)
    if not text:
        return None
    packed = PngInfo()
    for key, value in text.items():
        packed.add_text(key, str(value))
    return packed


def carried_tiff_tags(image: Image.Image):
    source = getattr(image, "tag_v2", None)
    if source is None:
        return None
    carried = TiffImagePlugin.ImageFileDirectory_v2()
    for tag, value in source.items():
        if tag in TIFF_STRUCTURE or tag == ORIENTATION_TAG:
            continue
        try:
            carried[tag] = value
            carried.tagtype[tag] = source.tagtype[tag]
        except Exception:
            carried.pop(tag, None)
    return carried


def static_options(image: Image.Image, fmt: str, exif) -> dict:
    options = {}
    if image.info.get("icc_profile"):
        options["icc_profile"] = image.info["icc_profile"]
    if image.info.get("dpi"):
        options["dpi"] = image.info["dpi"]
    if len(exif) and fmt in ("PNG", "WEBP"):
        options["exif"] = exif.tobytes()
    if fmt == "PNG":
        options["compress_level"] = 6
        packed = png_info(image)
        if packed is not None:
            options["pnginfo"] = packed
        if "transparency" in image.info:
            options["transparency"] = image.info["transparency"]
    elif fmt == "WEBP":
        options.update(lossless=True, quality=100, method=4)
    elif fmt == "TIFF":
        options["compression"] = "tiff_adobe_deflate"
        extra = carried_tiff_tags(image)
        if extra is not None:
            options["tiffinfo"] = extra
    elif fmt == "GIF":
        for key in ("transparency", "background"):
            if key in image.info:
                options[key] = image.info[key]
    return options


def animated(target: Path, image: Image.Image, fmt: str, operation: str) -> bool:
    frames = []
    durations = []
    method = orient.OPERATION_TRANSPOSE[operation]
    for index in range(image.n_frames):
        image.seek(index)
        durations.append(image.info.get("duration", 100))
        frames.append(image.convert("RGBA").transpose(method))
    options = {"save_all": True, "append_images": frames[1:], "duration": durations, "loop": image.info.get("loop", 0)}
    image.close()
    if fmt == "WEBP":
        options.update(lossless=True, quality=100)
    elif fmt == "GIF":
        options["disposal"] = 2
    write_beside(target, lambda path: frames[0].save(path, fmt, **options))
    return False


def still(target: Path, image: Image.Image, fmt: str, operation: str) -> bool:
    if fmt in ("PNG", "TIFF") and image.mode not in decode.SIXTEEN_BIT and info.pillow_depth(image, str(target)) > 8:
        raise ApiError(415, "that 16-bit colour picture would lose depth if turned, so formtools leaves it alone")
    exif = image.getexif()
    image.load()
    pixels = orient.apply(image, exif.get(ORIENTATION_TAG, 1)).transpose(orient.OPERATION_TRANSPOSE[operation])
    if ORIENTATION_TAG in exif:
        exif[ORIENTATION_TAG] = 1
    options = static_options(image, fmt, exif)
    image.close()
    write_beside(target, lambda path: pixels.save(path, fmt, **options))
    return True


def run(raw: str, operation: str, lossless: bool) -> dict:
    if operation not in orient.OPERATIONS:
        raise ApiError(400, "op must be rotate-cw, rotate-ccw, rotate-180, flip-h or flip-v")
    target = existing_file(raw)
    try:
        opened = Image.open(target)
    except (Image.UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise ApiError(415, "formtools cannot read that file as a picture")
    try:
        fmt = opened.format
        if fmt not in WRITABLE:
            raise ApiError(415, MESSAGE)
        if fmt == "JPEG":
            opened.close()
            used = transform_jpeg(target, operation, lossless)
        elif getattr(opened, "n_frames", 1) > 1 and fmt in ("GIF", "WEBP", "PNG"):
            used = animated(target, opened, fmt, operation)
        else:
            used = still(target, opened, fmt, operation)
    except ApiError:
        raise
    except PermissionError:
        raise ApiError(400, "formtools is not allowed to change that file")
    except Exception as exc:
        raise ApiError(415, f"formtools could not turn that picture ({type(exc).__name__})")
    finally:
        opened.close()
    return {"ok": True, "lossless_used": used, "path": str(target)}
