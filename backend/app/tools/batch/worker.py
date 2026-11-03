import io
import os
import uuid

from PIL import Image, ImageCms

from app.core.errors import ApiError
from app.core.filetypes import RAW
from app.tools.batch import actions

FORMATS = {
    "jpeg": ("JPEG", "jpg"),
    "png": ("PNG", "png"),
    "webp": ("WEBP", "webp"),
    "avif": ("AVIF", "avif"),
    "tiff": ("TIFF", "tiff"),
    "bmp": ("BMP", "bmp"),
    "gif": ("GIF", "gif"),
}

SAME = {
    "jpg": "jpeg",
    "jpeg": "jpeg",
    "jpe": "jpeg",
    "jfif": "jpeg",
    "png": "png",
    "apng": "png",
    "gif": "gif",
    "webp": "webp",
    "avif": "avif",
    "avifs": "avif",
    "bmp": "bmp",
    "dib": "bmp",
    "tif": "tiff",
    "tiff": "tiff",
}

EXIF_FORMATS = frozenset(("jpeg", "png", "webp", "avif", "tiff"))
ICC_FORMATS = frozenset(("jpeg", "png", "webp", "avif", "tiff"))
DPI_FORMATS = frozenset(("jpeg", "png", "tiff", "webp"))
ORIENTATION = 0x0112


def resolve_format(choice: str, src: str) -> str:
    if choice in FORMATS:
        return choice
    ext = os.path.splitext(src)[1].lstrip(".").lower()
    if ext in SAME:
        return SAME[ext]
    return "jpeg" if ext in RAW else "png"


def output_extension(choice: str, src: str) -> str:
    kind = resolve_format(choice, src)
    if choice == "same":
        ext = os.path.splitext(src)[1].lstrip(".")
        if ext.lower() in SAME and SAME[ext.lower()] == kind:
            return ext
    return FORMATS[kind][1]


def srgb_bytes() -> bytes:
    return ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()


def source_meta(path: str) -> dict:
    meta: dict = {"exif": None, "icc": None, "dpi": None}
    try:
        with Image.open(path) as image:
            meta["icc"] = image.info.get("icc_profile")
            dpi = image.info.get("dpi")
            if isinstance(dpi, tuple) and len(dpi) == 2 and all(isinstance(v, (int, float)) and v > 0 for v in dpi):
                meta["dpi"] = (float(dpi[0]), float(dpi[1]))
            exif = image.getexif()
            if len(exif):
                exif.get_ifd(0x8769)
                exif.get_ifd(0x8825)
                meta["exif"] = exif
    except Exception:
        pass
    return meta


def metadata_for(src: str, kind: str, keep: bool, ctx: dict) -> dict:
    extra: dict = {}
    wanted_exif = keep and not ctx.get("strip")
    wanted_icc = (keep and not ctx.get("strip")) or (ctx.get("strip") and ctx.get("keep_icc"))
    meta = source_meta(src) if (wanted_exif or wanted_icc or keep) else {"exif": None, "icc": None, "dpi": None}
    if wanted_exif and kind in EXIF_FORMATS and meta["exif"] is not None:
        exif = meta["exif"]
        if ORIENTATION in exif:
            exif[ORIENTATION] = 1
        extra["exif"] = exif.tobytes()
    icc = None
    if ctx.get("srgb"):
        icc = srgb_bytes()
    elif wanted_icc and meta["icc"]:
        from app.tools.image import decode

        description = (decode.profile_description(meta["icc"]) or "").lower()
        icc = meta["icc"] if "srgb" in description else srgb_bytes()
    if icc and kind in ICC_FORMATS:
        extra["icc_profile"] = icc
    dpi = None
    if ctx.get("dpi"):
        dpi = (float(ctx["dpi"]), float(ctx["dpi"]))
    elif keep and not ctx.get("strip") and meta["dpi"]:
        dpi = meta["dpi"]
    if dpi and kind in DPI_FORMATS:
        extra["dpi"] = dpi
    return extra


def flatten(image: Image.Image) -> Image.Image:
    image = actions.ensure_rgb(image)
    if image.mode == "RGBA":
        base = Image.new("RGB", image.size, (255, 255, 255))
        base.paste(image, mask=image.getchannel("A"))
        return base
    return image


def to_gif(image: Image.Image) -> Image.Image:
    image = actions.ensure_rgb(image)
    if image.mode != "RGBA":
        return image.convert("P", palette=Image.Palette.ADAPTIVE, colors=256)
    alpha = image.getchannel("A")
    paletted = image.convert("RGB").convert("P", palette=Image.Palette.ADAPTIVE, colors=255)
    mask = alpha.point(lambda value: 255 if value < 128 else 0)
    paletted.paste(255, mask=mask)
    paletted.info["transparency"] = 255
    return paletted


def save(image: Image.Image, target: str, kind: str, quality: int, extra: dict) -> None:
    name = FORMATS[kind][0]
    options: dict = dict(extra)
    if kind == "jpeg":
        image = flatten(image)
        options.update(quality=quality, optimize=False)
    elif kind == "png":
        image = actions.ensure_rgb(image)
        options.update(compress_level=6)
    elif kind == "webp":
        image = actions.ensure_rgb(image)
        options.update(quality=quality, method=4, lossless=quality >= 100)
    elif kind == "avif":
        image = actions.ensure_rgb(image)
        options.update(quality=quality, speed=6)
    elif kind == "tiff":
        image = actions.ensure_rgb(image)
        options.update(compression="tiff_adobe_deflate")
    elif kind == "bmp":
        image = flatten(image)
        options = {}
    else:
        image = to_gif(image)
        options = {"optimize": False}
        if "transparency" in image.info:
            options["transparency"] = 255
    for dropped in (None, "exif", "icc_profile"):
        if dropped:
            if dropped not in options:
                continue
            options.pop(dropped)
        try:
            image.save(target, name, **options)
            return
        except (TypeError, ValueError, OSError, KeyError, RuntimeError):
            if not ("exif" in options or "icc_profile" in options):
                raise
    image.save(target, name, **options)


def process(task: dict) -> dict:
    index = task["index"]
    temporary = None
    try:
        from app.tools.image import decode

        image = decode.render(task["src"], 0)
        ctx: dict = {"scale": 1.0}
        image = actions.ensure_rgb(actions.apply_chain(image, task["actions"], ctx))
        kind = resolve_format(task["format"], task["src"])
        extra = metadata_for(task["src"], kind, task["keep_metadata"], ctx)
        os.makedirs(task["folder"], exist_ok=True)
        temporary = os.path.join(task["folder"], f".formtools-{uuid.uuid4().hex[:12]}.tmp")
        save(image, temporary, kind, task["quality"], extra)
        return {"index": index, "tmp": temporary, "width": image.width, "height": image.height}
    except ApiError as exc:
        error = exc.message
    except MemoryError:
        error = "not enough memory for that picture"
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"
    if temporary:
        try:
            os.unlink(temporary)
        except OSError:
            pass
    return {"index": index, "error": error}


def preview_bytes(image: Image.Image, limit: int) -> bytes:
    image = actions.ensure_rgb(image)
    if max(image.size) > limit:
        image.thumbnail((limit, limit), Image.Resampling.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, "WEBP", quality=85, method=3)
    return buffer.getvalue()
