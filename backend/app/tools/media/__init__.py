from app.core import registry
from app.core.filetypes import AUDIO, VIDEO
from app.core.registry import McpTool, Tool
from app.tools.media import copy, exe, fetch, preview, probe
from app.tools.media.router import router

CONTAINERS = ["mp4", "mkv", "mov", "webm", "m4a", "mka", "mp3", "flac", "opus", "ogg"]

INFO_SCHEMA = {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute local path of the video or audio file"}}, "required": ["path"]}
COPY_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the video or audio file"},
        "op": {"type": "string", "enum": ["remux", "trim", "extract-audio"]},
        "container": {"type": "string", "enum": CONTAINERS, "description": "Output container; a sensible one is chosen when omitted"},
        "start": {"type": "number", "description": "Start in seconds (trim snaps to the keyframe before it)"},
        "end": {"type": "number", "description": "End in seconds"},
        "streams": {"type": "array", "items": {"type": "integer"}, "description": "Stream indexes to keep; default is all that fit the container"},
    },
    "required": ["path", "op"],
}
SNAPSHOT_SCHEMA = {
    "type": "object",
    "properties": {"path": {"type": "string", "description": "Absolute local path of the video"}, "time": {"type": "number", "description": "Time in seconds"}},
    "required": ["path", "time"],
}


def formats() -> dict:
    return {"video": sorted(VIDEO), "audio": sorted(AUDIO)}


def media_info_tool(args: dict) -> dict:
    return probe.describe(exe.existing_file(str(args.get("path", ""))))


def media_copy_tool(args: dict) -> dict:
    return copy.start_copy(
        str(args.get("path", "")),
        str(args.get("op", "")),
        args.get("container"),
        args.get("start"),
        args.get("end"),
        args.get("streams"),
    )


def media_snapshot_tool(args: dict) -> dict:
    return preview.snapshot(str(args.get("path", "")), float(args.get("time", 0)))


registry.register(
    Tool(
        id="media",
        title="Video and audio",
        routers=(router,),
        formats=formats,
        mcp=(
            McpTool("media_info", "Read the container, streams, chapters and playability of a video or audio file with ffprobe.", INFO_SCHEMA, media_info_tool),
            McpTool("media_copy", "Start a stream-copy job (remux, trim or extract-audio) that writes a new file beside the source without re-encoding. Returns the job; poll it with job_status.", COPY_SCHEMA, media_copy_tool),
            McpTool("media_snapshot", "Save the frame at a time as a full-resolution PNG beside the video.", SNAPSHOT_SCHEMA, media_snapshot_tool),
        ),
        startup=fetch.start,
        shutdown=exe.kill_all,
    )
)
