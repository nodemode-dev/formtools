from app.core import registry
from app.core.errors import ApiError
from app.core.registry import McpTool, Tool
from app.tools.exif import read, runner
from app.tools.exif.router import router

READ_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the file to read metadata from"},
        "groups": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Optional group names to keep, such as EXIF, GPS, XMP, IPTC, QuickTime or ID3; all groups when omitted",
        },
    },
    "required": ["path"],
}


def exif_read_tool(args: dict) -> dict:
    groups = args.get("groups")
    if groups is not None and (not isinstance(groups, list) or not all(isinstance(item, str) for item in groups)):
        raise ApiError(400, "groups must be a list of group names")
    result = read.read(str(args.get("path", "")))
    return read.keep_groups(result, groups) if groups else result


registry.register(
    Tool(
        id="exif",
        title="All metadata",
        routers=(router,),
        mcp=(
            McpTool(
                "exif_read",
                "Read all metadata of a file with ExifTool (EXIF, GPS, XMP, IPTC, QuickTime, ID3 and more), grouped, with readable labels. Needs ExifTool to be installed or fetched; the answer says so when it is not.",
                READ_SCHEMA,
                exif_read_tool,
            ),
        ),
        shutdown=runner.stop,
    )
)
