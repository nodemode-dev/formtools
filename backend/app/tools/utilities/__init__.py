from app.core import registry
from app.core.errors import ApiError
from app.core.registry import McpTool, Tool
from app.tools.utilities import service, templates, trash
from app.tools.utilities.router import router

DUPES_SCHEMA = {
    "type": "object",
    "properties": {
        "roots": {"type": "array", "items": {"type": "string"}, "description": "Absolute folder paths to scan"},
        "recursive": {"type": "boolean", "description": "Descend into sub-folders (default true)"},
        "min_size": {"type": "integer", "description": "Ignore files smaller than this many bytes (default 1)"},
        "mode": {"type": "string", "enum": ["exact", "similar-images"], "description": "exact compares content; similar-images compares how pictures look"},
        "threshold": {"type": "integer", "minimum": 0, "maximum": 64, "description": "similar-images only: the largest bit difference that still counts as similar (default 6)"},
        "include_hidden": {"type": "boolean"},
    },
    "required": ["roots"],
}
DISK_SCHEMA = {
    "type": "object",
    "properties": {"root": {"type": "string", "description": "Absolute folder path to measure"}, "include_hidden": {"type": "boolean"}},
    "required": ["root"],
}
TRASH_SCHEMA = {
    "type": "object",
    "properties": {"paths": {"type": "array", "items": {"type": "string"}, "description": "Absolute paths of files or folders to move to the trash"}},
    "required": ["paths"],
}
EMPTY_SCHEMA = {"type": "object", "properties": {"root": {"type": "string", "description": "Absolute folder path to search"}}, "required": ["root"]}
TEMPLATE_SCHEMA = {
    "type": "object",
    "properties": {
        "template": {"type": "string", "description": "A template name from templates_list"},
        "folder": {"type": "string", "description": "Absolute path of the folder to create the new item in"},
        "name": {"type": "string", "description": "Name for the new item (optional; a taken name gets a number, nothing is overwritten)"},
    },
    "required": ["template", "folder"],
}


def dupes_scan_tool(args: dict) -> dict:
    roots = args.get("roots")
    if not isinstance(roots, list) or not all(isinstance(item, str) for item in roots):
        raise ApiError(400, "roots must be a list of folder paths")
    mode = str(args.get("mode", "exact"))
    if mode not in ("exact", "similar-images"):
        raise ApiError(400, "mode must be exact or similar-images")
    return service.start_dupes(
        roots,
        bool(args.get("recursive", True)),
        int(args.get("min_size", 1)),
        mode,
        int(args.get("threshold", 6)),
        bool(args.get("include_hidden", False)),
    )


def disk_usage_tool(args: dict) -> dict:
    return service.start_diskusage(str(args.get("root", "")), bool(args.get("include_hidden", False)))


def trash_files_tool(args: dict) -> dict:
    paths = args.get("paths")
    if not isinstance(paths, list) or not all(isinstance(item, str) for item in paths):
        raise ApiError(400, "paths must be a list of paths")
    return trash.move_to_trash(paths)


def empty_folders_tool(args: dict) -> dict:
    return service.start_empty_folders(str(args.get("root", "")))


def templates_list_tool(_: dict) -> dict:
    return templates.listing()


def template_create_tool(args: dict) -> dict:
    name = args.get("name")
    return templates.create(str(args.get("template", "")), str(args.get("folder", "")), str(name) if name else None)


registry.register(
    Tool(
        id="utilities",
        title="Utilities",
        routers=(router,),
        mcp=(
            McpTool(
                "dupes_scan",
                "Start a job that finds duplicate files (exact content) or similar pictures. Returns the job; poll it with job_status and read groups and wasted bytes from its result. Nothing is deleted.",
                DUPES_SCHEMA,
                dupes_scan_tool,
            ),
            McpTool(
                "disk_usage",
                "Start a job that measures a folder and returns a size tree (the 60 largest children per folder, the rest folded into an Other node). Poll it with job_status.",
                DISK_SCHEMA,
                disk_usage_tool,
            ),
            McpTool(
                "trash_files",
                "Move files or folders to the system trash (recoverable from there, never deleted permanently). Returns how many were moved and any errors.",
                TRASH_SCHEMA,
                trash_files_tool,
            ),
            McpTool(
                "empty_folders",
                "Start a job that lists folders holding no files anywhere beneath them. Poll it with job_status. Nothing is removed.",
                EMPTY_SCHEMA,
                empty_folders_tool,
            ),
            McpTool("templates_list", "List the New from template items (files and folders) in the templates folder.", {"type": "object", "properties": {}}, templates_list_tool),
            McpTool(
                "template_create",
                "Create a new file or folder from a template inside a folder. Never overwrites: a taken name gets a number.",
                TEMPLATE_SCHEMA,
                template_create_tool,
            ),
        ),
    )
)
