import os
import struct
import subprocess
from fractions import Fraction

from PIL import ExifTags, Image

from app.core.errors import ApiError
from app.core.filetypes import RAW, ext_of
from app.tools.image import decode, family, libs, orient

GPS_IFD = 0x8825
EXIF_IFD = 0x8769
SKIPPED_TAGS = frozenset(
    {EXIF_IFD, GPS_IFD, 0x927C, 0xA005, 0x02BC, 0x8649, 0x8773}
    | {256, 257, 258, 259, 262, 273, 277, 278, 279, 284, 317, 322, 323, 324, 325, 338, 339, 530}
)
MODE_DEPTH = {"1": 1, "L": 8, "LA": 8, "P": 8, "PA": 8, "RGB": 8, "RGBA": 8, "RGBX": 8, "CMYK": 8, "YCbCr": 8, "LAB": 8, "HSV": 8, "I": 32, "F": 32}
MODE_NAME = {"I;16": "I;16", "I;16L": "I;16", "I;16B": "I;16", "I;16N": "I;16"}


def plain(value):
    if isinstance(value, bytes):
        text = value.split(b"\x00")[0]
        if value[:8] in (b"ASCII\x00\x00\x00", b"UNICODE\x00", b"JIS\x00\x00\x00\x00\x00"):
            text = value[8:].replace(b"\x00", b"")
        try:
            decoded = text.decode("utf-8").strip()
        except UnicodeDecodeError:
            return None
        return decoded[:500] if decoded and decoded.isprintable() else None
    if isinstance(value, str):
        return value.replace("\x00", "").strip()[:500]
    if isinstance(value, (bool, int)):
        return value
    if isinstance(value, (float, Fraction)):
        number = float(value)
        return number if number == number and abs(number) != float("inf") else None
    if hasattr(value, "numerator") and hasattr(value, "denominator"):
        return float(value) if value.denominator else None
    if isinstance(value, (tuple, list)):
        items = [plain(item) for item in value[:32]]
        return items if all(item is not None for item in items) else None
    return None


def exif_table(exif) -> dict:
    table = {}
    sources = [exif]
    try:
        sources.append(exif.get_ifd(EXIF_IFD))
    except Exception:
        pass
    for source in sources:
        for tag, value in source.items():
            if tag in SKIPPED_TAGS:
                continue
            name = ExifTags.TAGS.get(tag, f"Tag{tag:04X}")
            cleaned = plain(value)
            if cleaned is not None and cleaned != "":
                table[name] = cleaned
    return table


def degrees(parts, reference) -> float | None:
    try:
        value = float(parts[0]) + float(parts[1]) / 60.0 + float(parts[2]) / 3600.0
    except (TypeError, ValueError, IndexError, ZeroDivisionError):
        return None
    return -value if str(reference).upper() in ("S", "W") else value


def gps_point(exif) -> dict | None:
    try:
        gps = exif.get_ifd(GPS_IFD)
    except Exception:
        return None
    if not gps or 2 not in gps or 4 not in gps:
        return None
    lat = degrees(gps[2], gps.get(1, "N"))
    lon = degrees(gps[4], gps.get(3, "E"))
    if lat is None or lon is None:
        return None
    return {"lat": lat, "lon": lon}


def png_depth(path: str) -> int | None:
    with open(path, "rb") as handle:
        head = handle.read(26)
    if head[:8] == b"\x89PNG\r\n\x1a\n" and head[12:16] == b"IHDR":
        return head[24]
    return None


def pillow_depth(image: Image.Image, path: str) -> int:
    if image.format == "PNG":
        depth = png_depth(path)
        if depth:
            return depth
    if image.format == "TIFF":
        bits = getattr(image, "tag_v2", {}).get(258)
        if isinstance(bits, int):
            return bits
        if isinstance(bits, tuple) and bits:
            return max(bits)
    if image.mode in MODE_NAME:
        return 16
    return MODE_DEPTH.get(image.mode, 8)


def has_alpha(image: Image.Image) -> bool:
    if image.mode in decode.ALPHA_MODES:
        return True
    return "transparency" in image.info and image.mode in ("P", "L", "RGB", "1")


def pillow_info(path: str) -> dict:
    try:
        image = Image.open(path)
    except Image.DecompressionBombError:
        raise ApiError(400, "that picture is larger than 400 megapixels")
    except (Image.UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise ApiError(415, "formtools cannot read that file as a picture")
    try:
        if image.format not in decode.ALLOWED_FORMATS:
            raise ApiError(415, "formtools does not decode that kind of picture")
        exif = image.getexif()
        orientation = orient.valid(exif.get(0x0112, 1))
        width, height = image.size
        if image.format == "ICO" and image.info.get("sizes"):
            width, height = sorted(image.info["sizes"], key=lambda item: item[0] * item[1])[-1]
        if orient.swaps_axes(orientation):
            width, height = height, width
        frames = int(getattr(image, "n_frames", 1) or 1)
        return {
            "width": width,
            "height": height,
            "format": image.format,
            "mode": image.mode,
            "frames": frames,
            "animated": bool(getattr(image, "is_animated", False)),
            "has_alpha": has_alpha(image),
            "icc": decode.profile_description(image.info.get("icc_profile")),
            "bit_depth": pillow_depth(image, path),
            "exif": exif_table(exif),
            "gps": gps_point(exif),
            "orientation": orientation,
        }
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot read that picture ({type(exc).__name__})")
    finally:
        image.close()


def raw_info(path: str) -> dict:
    module = libs.rawpy()
    if module is None:
        raise ApiError(415, "RAW pictures are not supported by this build")
    try:
        with module.imread(path) as raw:
            width, height = raw.sizes.width, raw.sizes.height
            orientation = decode.raw_orientation(raw.sizes.flip)
            if orient.swaps_axes(orientation):
                width, height = height, width
            result = {
                "width": width,
                "height": height,
                "format": ext_of(path).upper(),
                "mode": "RGB",
                "frames": 1,
                "animated": False,
                "has_alpha": False,
                "icc": None,
                "bit_depth": max(int(raw.white_level).bit_length(), 8),
                "exif": {},
                "gps": None,
                "orientation": orientation,
            }
            preview = raw_exif(module, raw)
            if preview:
                result["exif"], result["gps"] = preview
            return result
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot read that RAW file ({type(exc).__name__})")


def raw_exif(module, raw):
    import io

    try:
        thumb = raw.extract_thumb()
        if thumb.format != module.ThumbFormat.JPEG:
            return None
        with Image.open(io.BytesIO(thumb.data)) as image:
            exif = image.getexif()
            return exif_table(exif), gps_point(exif)
    except Exception:
        return None


def psd_info(path: str) -> dict:
    module = libs.psd_tools()
    if module is None:
        raise ApiError(415, "PSD pictures are not supported by this build")
    try:
        document = module.PSDImage.open(path)
        names = {0: "1", 1: "L", 2: "P", 3: "RGB", 4: "CMYK", 7: "RGB", 8: "L", 9: "LAB"}
        mode_id = int(getattr(document.color_mode, "value", document.color_mode))
        profile = None
        try:
            profile = document.image_resources.get_data(1039)
        except Exception:
            profile = None
        channels = int(getattr(document, "channels", 0) or 0)
        base = {3: 3, 4: 4, 1: 1, 2: 1, 7: 3, 8: 1, 9: 3}.get(mode_id, 3)
        return {
            "width": int(document.width),
            "height": int(document.height),
            "format": "PSB" if ext_of(path) == "psb" else "PSD",
            "mode": names.get(mode_id, "RGB"),
            "frames": 1,
            "animated": False,
            "has_alpha": channels > base,
            "icc": decode.profile_description(bytes(profile)) if isinstance(profile, (bytes, bytearray)) else None,
            "bit_depth": int(document.depth),
            "exif": {},
            "gps": None,
            "orientation": 1,
        }
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot read that PSD file ({type(exc).__name__})")


def exr_channel_depth(path: str) -> int:
    with open(path, "rb") as handle:
        head = handle.read(1 << 16)
    start = head.find(b"chlist\x00chlist\x00")
    if start < 0:
        return 16
    position = start + 18
    kinds = []
    while position < len(head) and head[position] != 0:
        position = head.index(b"\x00", position) + 1
        kinds.append(struct.unpack("<i", head[position : position + 4])[0])
        position += 16
    return 16 if kinds and all(kind == 1 for kind in kinds) else 32


def exr_info(path: str) -> dict:
    module = libs.openexr()
    if module is None:
        raise ApiError(415, "EXR pictures are not supported by this build")
    try:
        document = module.File(path, header_only=True)
        header = document.header()
        window = header["dataWindow"]
        names = {str(channel.name) for channel in header["channels"]}
        return {
            "width": int(window[1][0] - window[0][0] + 1),
            "height": int(window[1][1] - window[0][1] + 1),
            "format": "EXR",
            "mode": "RGBA" if "A" in names else "RGB",
            "frames": max(len(document.parts), 1),
            "animated": False,
            "has_alpha": "A" in names,
            "icc": None,
            "bit_depth": exr_channel_depth(path),
            "exif": {},
            "gps": None,
            "orientation": 1,
        }
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot read that EXR file ({type(exc).__name__})")


def hdr_info(path: str) -> dict:
    from app.tools.image import radiance

    try:
        with open(path, "rb") as handle:
            width, height, _, _ = radiance.read_header(handle)
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot read that HDR file ({type(exc).__name__})")
    return {
        "width": width,
        "height": height,
        "format": "HDR",
        "mode": "RGB",
        "frames": 1,
        "animated": False,
        "has_alpha": False,
        "icc": None,
        "bit_depth": 32,
        "exif": {},
        "gps": None,
        "orientation": 1,
    }


def sips_info(path: str) -> dict:
    tool = libs.sips()
    if tool is None:
        raise ApiError(415, "HEIC pictures are decoded by the operating system, and only macOS offers that to formtools")
    try:
        done = subprocess.run(
            [tool, "-g", "pixelWidth", "-g", "pixelHeight", "-g", "hasAlpha", "-g", "space", "-g", "bitsPerSample", "-g", "profile", path],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except (OSError, subprocess.SubprocessError):
        raise ApiError(415, "macOS could not read that HEIC file")
    values = {}
    for line in done.stdout.splitlines():
        key, _, value = line.strip().partition(":")
        if value:
            values[key.strip()] = value.strip()
    if done.returncode != 0 or "pixelWidth" not in values:
        raise ApiError(415, "macOS could not read that HEIC file")
    profile = values.get("profile")
    return {
        "width": int(values["pixelWidth"]),
        "height": int(values["pixelHeight"]),
        "format": ext_of(path).upper(),
        "mode": "RGBA" if values.get("hasAlpha") == "yes" else "RGB",
        "frames": 1,
        "animated": False,
        "has_alpha": values.get("hasAlpha") == "yes",
        "icc": None if not profile or profile == "<nil>" else profile,
        "bit_depth": int(values["bitsPerSample"]) if values.get("bitsPerSample", "").isdigit() else 8,
        "exif": {},
        "gps": None,
        "orientation": 1,
    }


def describe(path: str) -> dict:
    from app.routers.fs import absolute

    target = absolute(path)
    if not target.exists():
        raise ApiError(404, "that file does not exist")
    if not target.is_file():
        raise ApiError(400, "that path is not a file")
    ext = ext_of(target.name)
    location = str(target)
    if ext in RAW:
        found = raw_info(location)
    elif ext in ("psd", "psb"):
        found = psd_info(location)
    elif ext == "exr":
        found = exr_info(location)
    elif ext == "hdr":
        found = hdr_info(location)
    elif ext in libs.HEIC:
        found = sips_info(location)
    elif ext == "jxl":
        raise ApiError(415, "JPEG XL has no cleared decoder in this build")
    elif ext == "svg":
        raise ApiError(415, "SVG pictures are shown by the window itself")
    elif ext in family.FORMVIS:
        found = family.describe(location)
    else:
        found = pillow_info(location)
    from app.tools.image import meta

    meta.attach(found, target)
    stat = os.stat(location)
    found["size"] = stat.st_size
    found["mtime"] = stat.st_mtime
    return found
