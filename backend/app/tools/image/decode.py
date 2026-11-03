import io
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageCms

from app.core.errors import ApiError
from app.core.filetypes import RAW, ext_of
from app.tools.image import family, libs, orient, radiance, tonemap

MAX_PIXELS = 400_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS * 2

ALLOWED_FORMATS = frozenset(
    "JPEG MPO PNG GIF WEBP BMP TIFF ICO ICNS AVIF DDS TGA QOI PCX PPM JPEG2000 SGI".split()
)

ALPHA_MODES = frozenset(("RGBA", "LA", "PA", "RGBa", "La"))
SIXTEEN_BIT = frozenset(("I;16", "I;16L", "I;16B", "I;16N"))


def too_big(width: int, height: int) -> None:
    if width * height > MAX_PIXELS:
        raise ApiError(400, "that picture is larger than 400 megapixels")


def srgb_profile():
    return ImageCms.createProfile("sRGB")


def profile_description(data: bytes | None) -> str | None:
    if not data:
        return None
    try:
        profile = ImageCms.ImageCmsProfile(io.BytesIO(data))
        text = ImageCms.getProfileDescription(profile)
    except Exception:
        return None
    text = (text or "").replace("\x00", "").strip()
    return text or None


def apply_profile(image: Image.Image, data: bytes | None) -> Image.Image:
    if not data or image.mode not in ("RGB", "RGBA", "L", "LA", "CMYK"):
        return image
    try:
        source = ImageCms.ImageCmsProfile(io.BytesIO(data))
        description = (ImageCms.getProfileDescription(source) or "").lower()
        if "srgb" in description and image.mode in ("RGB", "RGBA"):
            return image
        alpha = None
        base = image
        if image.mode in ("RGBA", "LA"):
            alpha = image.getchannel("A")
            base = image.convert("RGB" if image.mode == "RGBA" else "L")
        intent = ImageCms.Intent.PERCEPTUAL if base.mode == "CMYK" else ImageCms.Intent.RELATIVE_COLORIMETRIC
        converted = ImageCms.profileToProfile(
            base, source, srgb_profile(), renderingIntent=intent, outputMode="RGB", flags=ImageCms.Flags.BLACKPOINTCOMPENSATION
        )
        if alpha is not None:
            converted.putalpha(alpha)
        return converted
    except Exception:
        return image


def sixteen_to_eight(array: np.ndarray) -> Image.Image:
    return Image.fromarray(((array.astype(np.float32) + 128.0) / 257.0).clip(0, 255).astype(np.uint8), "L")


def to_display_mode(image: Image.Image, profile: bytes | None) -> Image.Image:
    mode = image.mode
    if mode in SIXTEEN_BIT:
        return sixteen_to_eight(np.asarray(image)).convert("RGB")
    if mode == "I":
        array = np.asarray(image)
        peak = int(array.max()) if array.size else 0
        if peak <= 65535 and int(array.min()) >= 0:
            return sixteen_to_eight(array).convert("RGB")
        scaled = (array.astype(np.float64) - array.min()) / max(float(array.max() - array.min()), 1.0)
        return Image.fromarray((scaled * 255).astype(np.uint8), "L").convert("RGB")
    if mode == "F":
        array = np.asarray(image, dtype=np.float32)
        low, high = float(array.min()), float(array.max())
        if low >= 0.0 and high <= 1.0:
            low, high = 0.0, 1.0
        scaled = (array - low) / max(high - low, 1e-12)
        return Image.fromarray((scaled.clip(0, 1) * 255).astype(np.uint8), "L").convert("RGB")
    if mode == "1":
        return image.convert("RGB")
    if mode == "P":
        has_alpha = "transparency" in image.info
        image = image.convert("RGBA" if has_alpha else "RGB")
        return image
    if mode in ("PA", "La"):
        return image.convert("RGBA")
    if mode == "RGBa":
        return image.convert("RGBA")
    if mode in ("RGB", "RGBA", "L", "LA", "CMYK"):
        image = apply_profile(image, profile)
        if image.mode in ("L", "LA"):
            return image.convert("RGBA" if image.mode == "LA" else "RGB")
        if image.mode == "CMYK":
            return image.convert("RGB")
        return image
    return image.convert("RGBA" if "A" in mode else "RGB")


def shrink(image: Image.Image, limit: int) -> Image.Image:
    if limit and max(image.size) > limit:
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS, reducing_gap=2.0)
    return image


def from_pillow(path: str, limit: int) -> tuple[Image.Image, int]:
    try:
        image = Image.open(path)
    except Image.DecompressionBombError:
        raise ApiError(400, "that picture is larger than 400 megapixels")
    except (Image.UnidentifiedImageError, OSError, ValueError, SyntaxError):
        raise ApiError(415, "formtools cannot decode that file as a picture")
    try:
        if image.format not in ALLOWED_FORMATS:
            raise ApiError(415, "formtools does not decode that kind of picture")
        too_big(*image.size)
        if image.format == "ICO":
            sizes = sorted(image.info.get("sizes", []), key=lambda item: item[0] * item[1])
            if sizes:
                image.size = sizes[-1]
        if limit and image.format == "JPEG":
            image.draft(None, (limit, limit))
        profile = image.info.get("icc_profile")
        orientation = image.getexif().get(0x0112, 1)
        image.load()
        shown = to_display_mode(image, profile)
        return (shown.copy() if shown is image else shown), orientation
    except ApiError:
        raise
    except Image.DecompressionBombError:
        raise ApiError(400, "that picture is larger than 400 megapixels")
    except Exception as exc:
        raise ApiError(415, f"formtools cannot decode that picture ({type(exc).__name__})")
    finally:
        image.close()


def raw_orientation(flip: int) -> int:
    return {3: 3, 5: 8, 6: 6}.get(flip, 1)


def from_raw(path: str, limit: int) -> tuple[Image.Image, int]:
    module = libs.rawpy()
    if module is None:
        raise ApiError(415, "RAW pictures are not supported by this build")
    try:
        with module.imread(path) as raw:
            if limit:
                preview = embedded_preview(module, raw)
                if preview is not None and max(preview[0].size) >= limit:
                    return preview
            width, height = raw.sizes.width, raw.sizes.height
            too_big(width, height)
            half = bool(limit) and max(width, height) // 2 >= limit
            rgb = raw.postprocess(use_camera_wb=True, half_size=half, output_bps=8)
            return Image.fromarray(rgb, "RGB"), 1
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot decode that RAW file ({type(exc).__name__})")


def embedded_preview(module, raw) -> tuple[Image.Image, int] | None:
    try:
        thumb = raw.extract_thumb()
    except Exception:
        return None
    try:
        if thumb.format == module.ThumbFormat.JPEG:
            image = Image.open(io.BytesIO(thumb.data))
            orientation = image.getexif().get(0x0112) or raw_orientation(raw.sizes.flip)
            image.load()
            return to_display_mode(image, image.info.get("icc_profile")).copy(), orientation
        if thumb.format == module.ThumbFormat.BITMAP:
            return Image.fromarray(thumb.data, "RGB"), raw_orientation(raw.sizes.flip)
    except Exception:
        return None
    return None


def from_psd(path: str) -> tuple[Image.Image, int]:
    module = libs.psd_tools()
    if module is None:
        raise ApiError(415, "PSD pictures are not supported by this build")
    try:
        document = module.PSDImage.open(path)
        too_big(document.width, document.height)
        composite = document.composite()
        if composite is None:
            raise ApiError(415, "that PSD file has nothing to show")
        profile = None
        try:
            profile = document.image_resources.get_data(1039)
        except Exception:
            profile = None
        return to_display_mode(composite, profile if isinstance(profile, (bytes, bytearray)) else None), 1
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot decode that PSD file ({type(exc).__name__})")


def exr_pixels(module, path: str) -> np.ndarray:
    document = module.File(path)
    channels = document.channels()
    for key in ("RGBA", "RGB"):
        if key in channels:
            return np.asarray(channels[key].pixels, dtype=np.float32)
    if all(name in channels for name in ("R", "G", "B")):
        planes = [channels[name].pixels for name in ("R", "G", "B")]
        if "A" in channels:
            planes.append(channels["A"].pixels)
        return np.stack(planes, axis=2).astype(np.float32)
    if "Y" in channels:
        return np.asarray(channels["Y"].pixels, dtype=np.float32)
    for channel in channels.values():
        if np.issubdtype(channel.pixels.dtype, np.floating):
            return np.asarray(channel.pixels, dtype=np.float32)
    raise ApiError(415, "that EXR file has no colour channels formtools can show")


def from_exr(path: str) -> tuple[Image.Image, int]:
    module = libs.openexr()
    if module is None:
        raise ApiError(415, "EXR pictures are not supported by this build")
    try:
        header = module.File(path, header_only=True).header()
        window = header["dataWindow"]
        too_big(int(window[1][0] - window[0][0] + 1), int(window[1][1] - window[0][1] + 1))
        mapped = tonemap.tonemap(exr_pixels(module, path))
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot decode that EXR file ({type(exc).__name__})")
    return Image.fromarray(mapped, "RGBA" if mapped.shape[2] == 4 else "RGB"), 1


def from_hdr(path: str) -> tuple[Image.Image, int]:
    try:
        mapped = tonemap.tonemap(radiance.read(path))
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"formtools cannot decode that HDR file ({type(exc).__name__})")
    return Image.fromarray(mapped, "RGB"), 1


def from_heic(path: str, limit: int) -> tuple[Image.Image, int]:
    tool = libs.sips()
    if tool is None:
        raise ApiError(415, "HEIC pictures are decoded by the operating system, and only macOS offers that to formtools")
    with tempfile.TemporaryDirectory(prefix="formtools-heic-") as folder:
        target = os.path.join(folder, "converted.png")
        try:
            done = subprocess.run([tool, "-s", "format", "png", path, "--out", target], capture_output=True, timeout=120)
        except (OSError, subprocess.SubprocessError):
            raise ApiError(415, "macOS could not convert that HEIC file")
        if done.returncode != 0 or not os.path.isfile(target):
            raise ApiError(415, "macOS could not convert that HEIC file")
        return from_pillow(target, limit)


def render(path: str, limit: int = 0) -> Image.Image:
    ext = ext_of(path)
    if ext in RAW:
        image, orientation = from_raw(path, limit)
    elif ext in ("psd", "psb"):
        image, orientation = from_psd(path)
    elif ext == "exr":
        image, orientation = from_exr(path)
    elif ext == "hdr":
        image, orientation = from_hdr(path)
    elif ext in libs.HEIC:
        image, orientation = from_heic(path, limit)
    elif ext == "jxl":
        raise ApiError(415, "JPEG XL has no cleared decoder in this build")
    elif ext == "svg":
        raise ApiError(415, "SVG pictures are shown by the window itself")
    elif ext in family.FORMVIS:
        image, orientation = family.preview(path)
        image = to_display_mode(image, None)
    else:
        image, orientation = from_pillow(path, limit)
    image = orient.apply(image, orientation)
    return shrink(image, limit)
