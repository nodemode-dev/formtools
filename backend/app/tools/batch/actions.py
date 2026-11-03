import math
from functools import lru_cache
from typing import Any, Callable

from PIL import Image, ImageColor, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

from app.core.errors import ApiError

RESAMPLE = {
    "lanczos": Image.Resampling.LANCZOS,
    "bicubic": Image.Resampling.BICUBIC,
    "bilinear": Image.Resampling.BILINEAR,
    "box": Image.Resampling.BOX,
    "nearest": Image.Resampling.NEAREST,
}

RESAMPLE_OPTIONS = [["lanczos", "Lanczos"], ["bicubic", "Bicubic"], ["bilinear", "Bilinear"], ["box", "Box"], ["nearest", "Nearest"]]

ANCHORS = [
    ["tl", "Top left"],
    ["t", "Top"],
    ["tr", "Top right"],
    ["l", "Left"],
    ["c", "Centre"],
    ["r", "Right"],
    ["bl", "Bottom left"],
    ["b", "Bottom"],
    ["br", "Bottom right"],
]

RESIZE_MODES = [
    ["fit", "Fit inside width and height"],
    ["fill", "Fill width and height, crop the rest"],
    ["exact", "Exact width and height"],
    ["longest", "Longest side"],
    ["shortest", "Shortest side"],
    ["width", "Width"],
    ["height", "Height"],
    ["megapixels", "Megapixels"],
    ["percent", "Percent"],
]

MAX_SIDE = 65535


def param(key: str, label: str, kind: str, default: Any, **extra: Any) -> dict:
    return {"key": key, "label": label, "type": kind, "default": default, **extra}


CATALOG: list[dict] = [
    {
        "id": "resize",
        "group": "Size",
        "label": "Resize",
        "params": [
            param("mode", "Mode", "choice", "longest", options=RESIZE_MODES),
            param("width", "Width", "int", 1920, min=0, max=MAX_SIDE, step=1),
            param("height", "Height", "int", 1080, min=0, max=MAX_SIDE, step=1),
            param("value", "Value", "float", 1920, min=0, max=100000, step=1),
            param("upscale", "Allow enlarging", "bool", False),
            param("resample", "Resampling", "choice", "lanczos", options=RESAMPLE_OPTIONS),
        ],
    },
    {
        "id": "crop",
        "group": "Size",
        "label": "Crop",
        "params": [
            param("mode", "Mode", "choice", "center", options=[["exact", "Exact box"], ["aspect", "Aspect ratio"], ["center", "Centred size"]]),
            param("x", "Left", "int", 0, min=0, max=MAX_SIDE, step=1),
            param("y", "Top", "int", 0, min=0, max=MAX_SIDE, step=1),
            param("w", "Width", "int", 1024, min=0, max=MAX_SIDE, step=1),
            param("h", "Height", "int", 1024, min=0, max=MAX_SIDE, step=1),
            param("ratio", "Ratio", "text", "16:9"),
        ],
    },
    {
        "id": "canvas",
        "group": "Size",
        "label": "Canvas size",
        "params": [
            param("width", "Width", "int", 2000, min=0, max=MAX_SIDE, step=1),
            param("height", "Height", "int", 2000, min=0, max=MAX_SIDE, step=1),
            param("anchor", "Anchor", "choice", "c", options=ANCHORS),
            param("color", "Fill colour", "color", "#ffffff"),
        ],
    },
    {
        "id": "rotate",
        "group": "Transform",
        "label": "Rotate",
        "params": [
            param("degrees", "Degrees clockwise", "float", 90, min=-360, max=360, step=0.5),
            param("expand", "Grow the canvas", "bool", True),
            param("color", "Fill colour", "color", "#00000000"),
        ],
    },
    {
        "id": "flip",
        "group": "Transform",
        "label": "Flip",
        "params": [param("axis", "Axis", "choice", "h", options=[["h", "Horizontal"], ["v", "Vertical"]])],
    },
    {"id": "auto-orient", "group": "Transform", "label": "Auto-orient", "params": []},
    {
        "id": "adjust",
        "group": "Colour",
        "label": "Adjust",
        "params": [
            param("brightness", "Brightness", "float", 0, min=-100, max=100, step=1),
            param("contrast", "Contrast", "float", 0, min=-100, max=100, step=1),
            param("saturation", "Saturation", "float", 0, min=-100, max=100, step=1),
            param("gamma", "Gamma", "float", 1.0, min=0.1, max=5, step=0.05),
            param("exposure", "Exposure (stops)", "float", 0, min=-4, max=4, step=0.1),
        ],
    },
    {"id": "auto-levels", "group": "Colour", "label": "Auto levels", "params": []},
    {"id": "grayscale", "group": "Colour", "label": "Grayscale", "params": []},
    {"id": "sepia", "group": "Colour", "label": "Sepia", "params": []},
    {"id": "invert", "group": "Colour", "label": "Invert", "params": []},
    {"id": "to-srgb", "group": "Colour", "label": "Convert to sRGB", "params": []},
    {
        "id": "sharpen",
        "group": "Filter",
        "label": "Sharpen",
        "params": [
            param("amount", "Amount (percent)", "int", 100, min=0, max=500, step=5),
            param("radius", "Radius", "float", 1.0, min=0.1, max=20, step=0.1),
            param("threshold", "Threshold", "int", 3, min=0, max=255, step=1),
        ],
    },
    {
        "id": "blur",
        "group": "Filter",
        "label": "Blur",
        "params": [param("radius", "Radius", "float", 2.0, min=0, max=100, step=0.5)],
    },
    {
        "id": "border",
        "group": "Add",
        "label": "Border",
        "params": [
            param("size", "Size", "int", 20, min=0, max=2000, step=1),
            param("color", "Colour", "color", "#ffffff"),
        ],
    },
    {
        "id": "watermark-text",
        "group": "Add",
        "label": "Text watermark",
        "params": [
            param("text", "Text", "text", "formtools"),
            param("size", "Size", "int", 36, min=6, max=1000, step=1),
            param("color", "Colour", "color", "#ffffff"),
            param("opacity", "Opacity", "int", 60, min=0, max=100, step=1),
            param("position", "Position", "choice", "br", options=ANCHORS),
            param("margin", "Margin", "int", 24, min=0, max=2000, step=1),
        ],
    },
    {
        "id": "watermark-image",
        "group": "Add",
        "label": "Picture watermark",
        "params": [
            param("path", "Picture", "path", ""),
            param("scale", "Width as percent of the picture", "float", 20, min=1, max=100, step=1),
            param("opacity", "Opacity", "int", 60, min=0, max=100, step=1),
            param("position", "Position", "choice", "br", options=ANCHORS),
            param("margin", "Margin", "int", 24, min=0, max=2000, step=1),
        ],
    },
    {
        "id": "strip-metadata",
        "group": "Metadata",
        "label": "Strip metadata",
        "params": [param("keep_icc", "Keep the colour profile", "bool", True)],
    },
    {
        "id": "set-dpi",
        "group": "Metadata",
        "label": "Set resolution",
        "params": [param("dpi", "Dots per inch", "int", 300, min=1, max=2400, step=1)],
    },
]

BY_ID = {item["id"]: item for item in CATALOG}


def coerce(spec: dict, value: Any) -> Any:
    kind = spec["type"]
    if value is None:
        return spec["default"]
    try:
        if kind == "bool":
            if isinstance(value, str):
                return value.strip().lower() in ("1", "true", "yes", "on")
            return bool(value)
        if kind in ("int", "float"):
            number = float(value)
            if not math.isfinite(number):
                raise ValueError
            if "min" in spec:
                number = max(spec["min"], number)
            if "max" in spec:
                number = min(spec["max"], number)
            return int(round(number)) if kind == "int" else number
        if kind == "choice":
            allowed = [option[0] for option in spec["options"]]
            text = str(value)
            if text not in allowed:
                raise ApiError(400, f"{text} is not a choice for {spec['label']}")
            return text
        return str(value)
    except (TypeError, ValueError):
        raise ApiError(400, f"{spec['label']} needs a valid {kind}")


def normalise(actions: Any) -> list[dict]:
    if not isinstance(actions, list):
        raise ApiError(400, "actions must be a list")
    if len(actions) > 64:
        raise ApiError(400, "a chain can hold at most 64 actions")
    cleaned = []
    for entry in actions:
        if not isinstance(entry, dict) or entry.get("id") not in BY_ID:
            raise ApiError(400, f"unknown action {entry.get('id') if isinstance(entry, dict) else entry}")
        supplied = entry.get("params") or {}
        if not isinstance(supplied, dict):
            raise ApiError(400, "action params must be an object")
        spec = BY_ID[entry["id"]]
        values = {item["key"]: coerce(item, supplied.get(item["key"])) for item in spec["params"]}
        cleaned.append({"id": entry["id"], "params": values})
    return cleaned


def parse_color(text: str, fallback: tuple = (0, 0, 0, 255)) -> tuple[int, int, int, int]:
    value = (text or "").strip()
    try:
        if value.startswith("#") and len(value) in (5, 9):
            digits = value[1:]
            if len(digits) == 4:
                digits = "".join(c * 2 for c in digits)
            return tuple(int(digits[i : i + 2], 16) for i in (0, 2, 4, 6))
        parsed = ImageColor.getrgb(value)
        return (parsed[0], parsed[1], parsed[2], parsed[3] if len(parsed) > 3 else 255)
    except (ValueError, TypeError):
        return fallback


def px(ctx: dict, value: float) -> int:
    scale = ctx.get("scale", 1.0)
    return int(round(value * scale)) if scale != 1.0 else int(round(value))


def px1(ctx: dict, value: float) -> int:
    return max(1, px(ctx, value)) if value > 0 else 0


def has_alpha(image: Image.Image) -> bool:
    return "A" in image.getbands()


def ensure_rgb(image: Image.Image) -> Image.Image:
    if image.mode in ("RGB", "RGBA"):
        return image
    return image.convert("RGBA" if has_alpha(image) or "transparency" in image.info else "RGB")


def split_alpha(image: Image.Image) -> tuple[Image.Image, Image.Image | None]:
    image = ensure_rgb(image)
    if image.mode == "RGBA":
        return image.convert("RGB"), image.getchannel("A")
    return image, None


def join_alpha(image: Image.Image, alpha: Image.Image | None) -> Image.Image:
    if alpha is None:
        return image
    image = image.convert("RGB")
    image.putalpha(alpha)
    return image


def clamp_side(value: float) -> int:
    return max(1, min(MAX_SIDE, int(round(value))))


def resize_plan(width: int, height: int, p: dict, ctx: dict) -> tuple[int, int, tuple[int, int] | None]:
    mode = p["mode"]
    scale = ctx.get("scale", 1.0)
    target_w, target_h = px1(ctx, p["width"]), px1(ctx, p["height"])
    value = p["value"]
    allow = p["upscale"]
    crop = None
    if mode == "exact":
        new_w, new_h = target_w or width, target_h or height
        if not allow:
            new_w, new_h = min(new_w, width), min(new_h, height)
        return clamp_side(new_w), clamp_side(new_h), None
    if mode == "fit":
        ratios = [target / size for target, size in ((target_w, width), (target_h, height)) if target]
        factor = min(ratios) if ratios else 1.0
    elif mode == "fill":
        ratios = [target / size for target, size in ((target_w, width), (target_h, height)) if target]
        factor = max(ratios) if ratios else 1.0
    elif mode == "longest":
        factor = px1(ctx, value) / max(width, height) if value > 0 else 1.0
    elif mode == "shortest":
        factor = px1(ctx, value) / min(width, height) if value > 0 else 1.0
    elif mode == "width":
        factor = px1(ctx, value) / width if value > 0 else 1.0
    elif mode == "height":
        factor = px1(ctx, value) / height if value > 0 else 1.0
    elif mode == "megapixels":
        factor = math.sqrt(max(value, 0.001) * 1_000_000 * scale * scale / (width * height))
    else:
        factor = value / 100.0
    if not allow and factor > 1.0:
        factor = 1.0
    new_w, new_h = clamp_side(width * factor), clamp_side(height * factor)
    if mode == "fill" and target_w and target_h:
        crop = (min(target_w, new_w), min(target_h, new_h))
        new_w, new_h = max(new_w, crop[0]), max(new_h, crop[1])
    return new_w, new_h, crop


def center_box(width: int, height: int, crop: tuple[int, int]) -> tuple[int, int, int, int]:
    left = (width - crop[0]) // 2
    top = (height - crop[1]) // 2
    return left, top, left + crop[0], top + crop[1]


def do_resize(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    new_w, new_h, crop = resize_plan(image.width, image.height, p, ctx)
    if (new_w, new_h) != image.size:
        image = ensure_rgb(image).resize((new_w, new_h), RESAMPLE[p["resample"]], reducing_gap=2.0 if new_w < image.width else None)
    if crop and crop != image.size:
        image = image.crop(center_box(image.width, image.height, crop))
    return image


def dims_resize(size: tuple[int, int], p: dict, ctx: dict) -> tuple[int, int]:
    new_w, new_h, crop = resize_plan(size[0], size[1], p, ctx)
    return crop if crop else (new_w, new_h)


def parse_ratio(text: str) -> float:
    cleaned = (text or "").replace("x", ":").replace("/", ":")
    try:
        if ":" in cleaned:
            left, right = cleaned.split(":", 1)
            return float(left) / float(right)
        return float(cleaned)
    except (ValueError, ZeroDivisionError):
        raise ApiError(400, "the crop ratio must look like 16:9 or 1.5")


def crop_box(width: int, height: int, p: dict, ctx: dict) -> tuple[int, int, int, int]:
    mode = p["mode"]
    if mode == "aspect":
        ratio = parse_ratio(p["ratio"])
        if ratio <= 0:
            raise ApiError(400, "the crop ratio must be positive")
        if width / height > ratio:
            crop = (max(1, int(round(height * ratio))), height)
        else:
            crop = (width, max(1, int(round(width / ratio))))
        return center_box(width, height, crop)
    if mode == "center":
        crop = (min(width, px1(ctx, p["w"]) or width), min(height, px1(ctx, p["h"]) or height))
        return center_box(width, height, crop)
    left = min(px(ctx, p["x"]), width - 1)
    top = min(px(ctx, p["y"]), height - 1)
    box_w = px1(ctx, p["w"]) or width - left
    box_h = px1(ctx, p["h"]) or height - top
    return left, top, min(width, left + box_w), min(height, top + box_h)


def do_crop(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    return image.crop(crop_box(image.width, image.height, p, ctx))


def dims_crop(size: tuple[int, int], p: dict, ctx: dict) -> tuple[int, int]:
    left, top, right, bottom = crop_box(size[0], size[1], p, ctx)
    return right - left, bottom - top


def anchor_origin(outer: tuple[int, int], inner: tuple[int, int], anchor: str, margin: int = 0) -> tuple[int, int]:
    row = "t" if "t" in anchor else "b" if "b" in anchor else "c"
    column = "l" if "l" in anchor else "r" if "r" in anchor else "c"
    free_x, free_y = outer[0] - inner[0], outer[1] - inner[1]
    left = {"l": margin, "c": free_x // 2, "r": free_x - margin}[column]
    top = {"t": margin, "c": free_y // 2, "b": free_y - margin}[row]
    return left, top


def do_canvas(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    width = px1(ctx, p["width"]) or image.width
    height = px1(ctx, p["height"]) or image.height
    color = parse_color(p["color"], (255, 255, 255, 255))
    image = ensure_rgb(image)
    mode = "RGBA" if image.mode == "RGBA" or color[3] < 255 else "RGB"
    canvas = Image.new(mode, (width, height), color if mode == "RGBA" else color[:3])
    origin = anchor_origin((width, height), image.size, p["anchor"])
    if image.mode == "RGBA":
        canvas.paste(image, origin, image)
    else:
        canvas.paste(image, origin)
    return canvas


def dims_canvas(size: tuple[int, int], p: dict, ctx: dict) -> tuple[int, int]:
    return px1(ctx, p["width"]) or size[0], px1(ctx, p["height"]) or size[1]


def do_rotate(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    degrees = p["degrees"] % 360
    if degrees == 0:
        return image
    exact = {90: Image.Transpose.ROTATE_270, 180: Image.Transpose.ROTATE_180, 270: Image.Transpose.ROTATE_90}
    if degrees in exact and (p["expand"] or degrees == 180):
        return image.transpose(exact[int(degrees)])
    color = parse_color(p["color"], (0, 0, 0, 0))
    image = ensure_rgb(image)
    if color[3] < 255 and image.mode == "RGB":
        image = image.convert("RGBA")
    fill = color if image.mode == "RGBA" else color[:3]
    return image.rotate(-degrees, resample=Image.Resampling.BICUBIC, expand=p["expand"], fillcolor=fill)


def dims_rotate(size: tuple[int, int], p: dict, ctx: dict) -> tuple[int, int]:
    degrees = p["degrees"] % 360
    if degrees == 0:
        return size
    if degrees in (90, 270) and p["expand"]:
        return size[1], size[0]
    if not p["expand"]:
        return size
    radians = math.radians(degrees)
    cos, sin = abs(math.cos(radians)), abs(math.sin(radians))
    return int(round(size[0] * cos + size[1] * sin)), int(round(size[0] * sin + size[1] * cos))


def do_flip(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    return image.transpose(Image.Transpose.FLIP_LEFT_RIGHT if p["axis"] == "h" else Image.Transpose.FLIP_TOP_BOTTOM)


def do_auto_orient(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    return image


def adjust_table(p: dict) -> list[int] | None:
    brightness = 1.0 + p["brightness"] / 100.0
    contrast = 1.0 + p["contrast"] / 100.0
    gamma = max(p["gamma"], 0.01)
    exposure = 2.0 ** p["exposure"]
    if brightness == 1.0 and contrast == 1.0 and gamma == 1.0 and exposure == 1.0:
        return None
    table = []
    for value in range(256):
        x = value / 255.0
        x = x * exposure * brightness
        x = (x - 0.5) * contrast + 0.5
        x = max(0.0, min(1.0, x)) ** (1.0 / gamma)
        table.append(int(round(max(0.0, min(1.0, x)) * 255)))
    return table


def do_adjust(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    rgb, alpha = split_alpha(image)
    table = adjust_table(p)
    if table is not None:
        rgb = rgb.point(table * 3)
    if p["saturation"]:
        rgb = ImageEnhance.Color(rgb).enhance(max(0.0, 1.0 + p["saturation"] / 100.0))
    return join_alpha(rgb, alpha)


def do_auto_levels(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    rgb, alpha = split_alpha(image)
    return join_alpha(ImageOps.autocontrast(rgb, cutoff=0.5), alpha)


def do_grayscale(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    rgb, alpha = split_alpha(image)
    return join_alpha(rgb.convert("L").convert("RGB"), alpha)


def do_sepia(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    rgb, alpha = split_alpha(image)
    toned = ImageOps.colorize(ImageOps.autocontrast(rgb.convert("L")), black=(28, 14, 4), white=(255, 244, 222), mid=(176, 128, 84))
    return join_alpha(toned, alpha)


def do_invert(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    rgb, alpha = split_alpha(image)
    return join_alpha(ImageOps.invert(rgb), alpha)


def do_to_srgb(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    ctx["srgb"] = True
    return image


def do_sharpen(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    if p["amount"] <= 0:
        return image
    rgb, alpha = split_alpha(image)
    radius = max(0.1, p["radius"] * ctx.get("scale", 1.0))
    return join_alpha(rgb.filter(ImageFilter.UnsharpMask(radius=radius, percent=p["amount"], threshold=p["threshold"])), alpha)


def do_blur(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    radius = p["radius"] * ctx.get("scale", 1.0)
    if radius <= 0:
        return image
    return ensure_rgb(image).filter(ImageFilter.GaussianBlur(radius))


def do_border(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    size = px(ctx, p["size"])
    if size <= 0:
        return image
    color = parse_color(p["color"], (255, 255, 255, 255))
    image = ensure_rgb(image)
    mode = "RGBA" if image.mode == "RGBA" or color[3] < 255 else "RGB"
    canvas = Image.new(mode, (image.width + 2 * size, image.height + 2 * size), color if mode == "RGBA" else color[:3])
    if image.mode == "RGBA":
        canvas.paste(image, (size, size), image)
    else:
        canvas.paste(image, (size, size))
    return canvas


def dims_border(size: tuple[int, int], p: dict, ctx: dict) -> tuple[int, int]:
    edge = px(ctx, p["size"])
    return size[0] + 2 * max(0, edge), size[1] + 2 * max(0, edge)


@lru_cache(maxsize=8)
def font_for(size: int):
    try:
        return ImageFont.load_default(size=size)
    except Exception:
        return ImageFont.load_default()


def overlay(image: Image.Image, layer: Image.Image, origin: tuple[int, int], opacity: int) -> Image.Image:
    base = ensure_rgb(image).convert("RGBA")
    if opacity < 100:
        alpha = layer.getchannel("A").point([int(round(i * opacity / 100.0)) for i in range(256)])
        layer = layer.copy()
        layer.putalpha(alpha)
    holder = Image.new("RGBA", base.size, (0, 0, 0, 0))
    holder.paste(layer, origin)
    merged = Image.alpha_composite(base, holder)
    return merged if has_alpha(image) else merged.convert("RGB")


def do_watermark_text(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    text = p["text"]
    if not text:
        return image
    size = max(6, px(ctx, p["size"]))
    font = font_for(size)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    left, top, right, bottom = probe.multiline_textbbox((0, 0), text, font=font)
    layer = Image.new("RGBA", (max(1, right - left), max(1, bottom - top)), (0, 0, 0, 0))
    color = parse_color(p["color"], (255, 255, 255, 255))
    ImageDraw.Draw(layer).multiline_text((-left, -top), text, font=font, fill=color)
    origin = anchor_origin(image.size, layer.size, p["position"], px(ctx, p["margin"]))
    return overlay(image, layer, origin, p["opacity"])


@lru_cache(maxsize=4)
def load_mark(path: str, stamp: int) -> Image.Image:
    from app.tools.image import decode

    return decode.render(path, 0).convert("RGBA")


def do_watermark_image(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    import os

    path = p["path"]
    if not path:
        raise ApiError(400, "the picture watermark needs a picture")
    try:
        stamp = os.stat(path).st_mtime_ns
    except OSError:
        raise ApiError(400, "the watermark picture does not exist")
    mark = load_mark(path, stamp)
    width = max(1, int(round(image.width * p["scale"] / 100.0)))
    height = max(1, int(round(mark.height * width / mark.width)))
    layer = mark.resize((width, height), Image.Resampling.LANCZOS)
    origin = anchor_origin(image.size, layer.size, p["position"], px(ctx, p["margin"]))
    return overlay(image, layer, origin, p["opacity"])


def do_strip_metadata(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    ctx["strip"] = True
    ctx["keep_icc"] = bool(p["keep_icc"])
    return image


def do_set_dpi(image: Image.Image, p: dict, ctx: dict) -> Image.Image:
    ctx["dpi"] = int(p["dpi"])
    return image


APPLY: dict[str, Callable[[Image.Image, dict, dict], Image.Image]] = {
    "resize": do_resize,
    "crop": do_crop,
    "canvas": do_canvas,
    "rotate": do_rotate,
    "flip": do_flip,
    "auto-orient": do_auto_orient,
    "adjust": do_adjust,
    "auto-levels": do_auto_levels,
    "grayscale": do_grayscale,
    "sepia": do_sepia,
    "invert": do_invert,
    "to-srgb": do_to_srgb,
    "sharpen": do_sharpen,
    "blur": do_blur,
    "border": do_border,
    "watermark-text": do_watermark_text,
    "watermark-image": do_watermark_image,
    "strip-metadata": do_strip_metadata,
    "set-dpi": do_set_dpi,
}

DIMS: dict[str, Callable[[tuple[int, int], dict, dict], tuple[int, int]]] = {
    "resize": dims_resize,
    "crop": dims_crop,
    "canvas": dims_canvas,
    "rotate": dims_rotate,
    "border": dims_border,
}


def apply_chain(image: Image.Image, actions: list[dict], ctx: dict) -> Image.Image:
    for entry in actions:
        image = APPLY[entry["id"]](image, entry["params"], ctx)
    return image


def chain_dims(size: tuple[int, int], actions: list[dict]) -> tuple[int, int]:
    ctx: dict = {}
    for entry in actions:
        step = DIMS.get(entry["id"])
        if step is not None:
            size = step(size, entry["params"], ctx)
    return size
