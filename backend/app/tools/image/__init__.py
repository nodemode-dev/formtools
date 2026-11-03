from app.core import registry
from app.core.registry import Command, McpTool, Tool
from app.core.errors import ApiError
from app.tools.image import edit, info, libs, meta, service
from app.tools.image.router import meta_router, router

PATH_PARAM = {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute local path of the picture"}}, "required": ["path"]}

OPERATIONS = (
    ("rotate-cw", "Rotate clockwise", "Turn the picture a quarter turn clockwise."),
    ("rotate-ccw", "Rotate counterclockwise", "Turn the picture a quarter turn counterclockwise."),
    ("rotate-180", "Rotate 180 degrees", "Turn the picture upside down."),
    ("flip-h", "Flip horizontally", "Mirror the picture left to right."),
    ("flip-v", "Flip vertically", "Mirror the picture top to bottom."),
)


def formats() -> dict:
    return {"image": {"native": libs.native_extensions(), "engine": libs.engine_extensions()}}


def image_info_tool(args: dict) -> dict:
    return info.describe(str(args.get("path", "")))


META_WRITE_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the picture"},
        "rating": {"type": "integer", "minimum": 0, "maximum": 5, "description": "Star rating; 0 clears it"},
        "label": {"type": ["string", "null"], "description": "red, orange, yellow, green, blue, purple or grey; null clears it"},
    },
    "required": ["path"],
}

EDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the picture"},
        "ops": {
            "type": "array",
            "description": "Steps applied in order: {op: crop, x, y, w, h}, {op: resize, width, height, resample}, {op: rotate, degrees: 90|180|270 clockwise}, {op: flip, axis: h|v}",
            "items": {"type": "object", "properties": {"op": {"type": "string", "enum": ["crop", "resize", "rotate", "flip"]}}, "required": ["op"]},
        },
        "out": {
            "type": "object",
            "properties": {
                "path": {"type": "string"},
                "format": {"type": "string", "enum": ["jpeg", "png", "webp", "avif", "tiff"]},
                "quality": {"type": "integer", "minimum": 1, "maximum": 100},
            },
        },
        "overwrite": {"type": "boolean", "default": False},
    },
    "required": ["path", "ops"],
}


def meta_write_tool(args: dict) -> dict:
    given = set(args)
    rating = args.get("rating")
    return meta.write(str(args.get("path", "")), rating, args.get("label"), "rating" in given and rating is not None, "label" in given)


def edit_tool(args: dict) -> dict:
    try:
        request = edit.EditRequest.model_validate(args)
    except Exception:
        raise ApiError(400, "the edit request is missing a field or has a bad value")
    return edit.run(request)


registry.register(
    Tool(
        id="image",
        title="Images",
        routers=(router, meta_router),
        formats=formats,
        commands=tuple(
            Command(f"image.{name}", title, text, {"type": "object", "properties": {"path": PATH_PARAM["properties"]["path"], "lossless": {"type": "boolean", "default": True}}, "required": ["path"]})
            for name, title, text in OPERATIONS
        ),
        mcp=(
            McpTool("image_info", "Read a picture's size, format, colour profile, EXIF, GPS, IPTC and XMP without decoding all of it.", PATH_PARAM, image_info_tool),
            McpTool("image_meta_write", "Set a picture's star rating and colour label in its XMP sidecar; the picture file is never changed.", META_WRITE_SCHEMA, meta_write_tool),
            McpTool("image_edit", "Crop, resize, rotate or flip a picture and save it as a new file (JPEG, PNG, WebP, AVIF or TIFF); the original is kept unless overwrite is set.", EDIT_SCHEMA, edit_tool),
        ),
        startup=service.prune,
    )
)
