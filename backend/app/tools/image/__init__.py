from app.core import registry
from app.core.registry import Command, McpTool, Tool
from app.tools.image import info, libs, service
from app.tools.image.router import router

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


registry.register(
    Tool(
        id="image",
        title="Images",
        routers=(router,),
        formats=formats,
        commands=tuple(
            Command(f"image.{name}", title, text, {"type": "object", "properties": {"path": PATH_PARAM["properties"]["path"], "lossless": {"type": "boolean", "default": True}}, "required": ["path"]})
            for name, title, text in OPERATIONS
        ),
        mcp=(McpTool("image_info", "Read a picture's size, format, colour profile, EXIF and GPS without decoding all of it.", PATH_PARAM, image_info_tool),),
        startup=service.prune,
    )
)
