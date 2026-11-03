import os
from pathlib import Path
from typing import Annotated, Literal, Union

from PIL import Image
from pydantic import BaseModel, Field

from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.routers.fs import absolute
from app.tools.image import decode
from app.tools.image.service import existing_file

ORIENTATION_TAG = 0x0112
MAX_SIDE = 65535
FORMATS = {"jpeg": "JPEG", "png": "PNG", "webp": "WEBP", "avif": "AVIF", "tiff": "TIFF"}
EXTENSIONS = {"jpg": "jpeg", "jpeg": "jpeg", "jpe": "jpeg", "png": "png", "webp": "webp", "avif": "avif", "tif": "tiff", "tiff": "tiff"}
DEFAULT_EXTENSION = {"jpeg": "jpg", "png": "png", "webp": "webp", "avif": "avif", "tiff": "tiff"}
DEFAULT_QUALITY = {"jpeg": 92, "webp": 90, "avif": 80}
RESAMPLE = {
    "lanczos": Image.Resampling.LANCZOS,
    "bicubic": Image.Resampling.BICUBIC,
    "bilinear": Image.Resampling.BILINEAR,
    "nearest": Image.Resampling.NEAREST,
}
TURNS = {90: Image.Transpose.ROTATE_270, 180: Image.Transpose.ROTATE_180, 270: Image.Transpose.ROTATE_90}


class Crop(BaseModel):
    op: Literal["crop"]
    x: int
    y: int
    w: int
    h: int


class Resize(BaseModel):
    op: Literal["resize"]
    width: int | None = None
    height: int | None = None
    resample: Literal["lanczos", "bicubic", "bilinear", "nearest"] = "lanczos"


class Rotate(BaseModel):
    op: Literal["rotate"]
    degrees: Literal[90, 180, 270]


class Flip(BaseModel):
    op: Literal["flip"]
    axis: Literal["h", "v"]


Operation = Annotated[Union[Crop, Resize, Rotate, Flip], Field(discriminator="op")]


class Output(BaseModel):
    path: str | None = None
    format: Literal["jpeg", "png", "webp", "avif", "tiff"] | None = None
    quality: int | None = Field(default=None, ge=1, le=100)


class EditRequest(BaseModel):
    path: str
    ops: list[Operation] = Field(max_length=64)
    out: Output = Output()
    overwrite: bool = False


def apply_crop(image: Image.Image, step: Crop) -> Image.Image:
    width, height = image.size
    if step.w < 1 or step.h < 1:
        raise ApiError(400, "the crop box needs a width and height of at least 1 pixel")
    if step.x < 0 or step.y < 0 or step.x + step.w > width or step.y + step.h > height:
        raise ApiError(400, f"the crop box falls outside the {width} by {height} picture")
    return image.crop((step.x, step.y, step.x + step.w, step.y + step.h))


def apply_resize(image: Image.Image, step: Resize) -> Image.Image:
    width, height = image.size
    if step.width is None and step.height is None:
        raise ApiError(400, "resize needs a width, a height or both")
    for value in (step.width, step.height):
        if value is not None and not 1 <= value <= MAX_SIDE:
            raise ApiError(400, f"resize sizes must be between 1 and {MAX_SIDE} pixels")
    new_width = step.width if step.width is not None else max(1, round(width * step.height / height))
    new_height = step.height if step.height is not None else max(1, round(height * step.width / width))
    if new_width > MAX_SIDE or new_height > MAX_SIDE:
        raise ApiError(400, f"resize sizes must be between 1 and {MAX_SIDE} pixels")
    decode.too_big(new_width, new_height)
    if (new_width, new_height) == (width, height):
        return image
    return image.resize((new_width, new_height), RESAMPLE[step.resample])


def apply_all(image: Image.Image, steps: list) -> Image.Image:
    for step in steps:
        if isinstance(step, Crop):
            image = apply_crop(image, step)
        elif isinstance(step, Resize):
            image = apply_resize(image, step)
        elif isinstance(step, Rotate):
            image = image.transpose(TURNS[step.degrees])
        else:
            image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT if step.axis == "h" else Image.Transpose.FLIP_TOP_BOTTOM)
    return image


def choose_format(source: Path, out: Output, destination: Path | None) -> str:
    if out.format:
        return out.format
    if destination is not None:
        by_path = EXTENSIONS.get(ext_of(destination.name))
        if by_path:
            return by_path
        raise ApiError(400, "the output path must end in .jpg, .png, .webp, .avif or .tiff, or out.format must be set")
    return EXTENSIONS.get(ext_of(source.name), "png")


def choose_destination(source: Path, out: Output, fmt: str) -> Path:
    if out.path:
        destination = absolute(out.path)
        actual = EXTENSIONS.get(ext_of(destination.name))
        if actual != fmt:
            raise ApiError(400, "the output file extension does not match the output format")
        return destination
    same = EXTENSIONS.get(ext_of(source.name)) == fmt
    extension = ext_of(source.name) if same else DEFAULT_EXTENSION[fmt]
    return source.with_name(f"{source.stem} edited.{extension}")


def check_destination(source: Path, destination: Path, overwrite: bool, explicit: bool) -> None:
    if not destination.parent.is_dir():
        raise ApiError(400, "the output folder does not exist")
    if not destination.exists():
        return
    if destination.is_dir():
        raise ApiError(400, "the output path is a folder")
    try:
        same = destination.samefile(source)
    except OSError:
        same = False
    if same:
        if not (overwrite and explicit):
            raise ApiError(400, "that would replace the original; set overwrite to true and give the same out.path to confirm")
        return
    if not overwrite:
        raise ApiError(400, "a file with that name already exists; set overwrite to true to replace it")


def source_details(source: Path) -> tuple[Image.Exif | None, bytes | None]:
    try:
        with Image.open(source) as opened:
            exif = opened.getexif()
            if ORIENTATION_TAG in exif:
                exif[ORIENTATION_TAG] = 1
            profile = opened.info.get("icc_profile")
            keep = profile if profile and "srgb" in (decode.profile_description(profile) or "").lower() else None
            return exif, keep
    except Exception:
        return None, None


def flatten(image: Image.Image) -> Image.Image:
    if image.mode == "RGBA":
        base = Image.new("RGB", image.size, (255, 255, 255))
        base.paste(image, mask=image.getchannel("A"))
        return base
    return image.convert("RGB") if image.mode != "RGB" else image


def encode(image: Image.Image, fmt: str, quality: int | None, exif, profile: bytes | None, destination: Path) -> None:
    pillow_format = FORMATS[fmt]
    if fmt == "jpeg":
        image = flatten(image)
    elif image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA" if "A" in image.mode else "RGB")
    options = {}
    if profile:
        options["icc_profile"] = profile
    if exif is not None and len(exif):
        options["exif"] = exif.tobytes()
    if fmt in DEFAULT_QUALITY:
        options["quality"] = quality or DEFAULT_QUALITY[fmt]
    if fmt == "jpeg":
        options["optimize"] = True
        if options["quality"] >= 95:
            options["subsampling"] = 0
    elif fmt == "png":
        options["compress_level"] = 6
    elif fmt == "webp":
        options["method"] = 4
    elif fmt == "tiff":
        options["compression"] = "tiff_adobe_deflate"
    temporary = destination.with_name(f".{destination.name}.formtools-{os.getpid()}.tmp")
    try:
        try:
            image.save(temporary, pillow_format, **options)
        except (ValueError, TypeError, KeyError):
            options.pop("exif", None)
            image.save(temporary, pillow_format, **options)
        os.replace(temporary, destination)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def run(request: EditRequest) -> dict:
    source = existing_file(request.path)
    if not request.ops:
        raise ApiError(400, "ops needs at least one step")
    explicit = bool(request.out.path)
    destination_hint = absolute(request.out.path) if explicit else None
    fmt = choose_format(source, request.out, destination_hint)
    destination = choose_destination(source, request.out, fmt)
    check_destination(source, destination, request.overwrite, explicit)
    try:
        image = decode.render(str(source), 0)
        image = apply_all(image, request.ops)
        exif, profile = source_details(source)
        encode(image, fmt, request.out.quality, exif, profile, destination)
    except ApiError:
        raise
    except PermissionError:
        raise ApiError(400, "formtools is not allowed to write there")
    except OSError as exc:
        raise ApiError(400, f"the picture could not be saved ({exc.strerror or 'error'})")
    except Exception as exc:
        raise ApiError(415, f"formtools could not save that picture ({type(exc).__name__})")
    return {"ok": True, "path": str(destination)}
