from app.core import registry
from app.core.registry import McpTool, Tool
from app.routers.fs import absolute
from app.tools.files import archive, extract, fonts, hashing, text
from app.tools.files.router import router

PATH_SCHEMA = {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute local path"}}, "required": ["path"]}
LIST_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the archive (zip, tar, tar.gz, tar.bz2, tar.xz, tar.zst, gz, bz2, xz, zst; 7z, rar, iso and more when libarchive is installed)"},
        "limit": {"type": "integer", "description": "Most entries to return (default 20000)"},
    },
    "required": ["path"],
}
EXTRACT_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the archive"},
        "dest": {"type": "string", "description": "Absolute destination folder; default is a new folder beside the archive named after it"},
        "members": {"type": "array", "items": {"type": "string"}, "description": "Member names (as archive_list reports them) to extract; default is everything"},
    },
    "required": ["path"],
}
HASH_SCHEMA = {
    "type": "object",
    "properties": {
        "paths": {"type": "array", "items": {"type": "string"}, "description": "Absolute paths of files or folders (folders expand recursively)"},
        "algorithms": {"type": "array", "items": {"type": "string", "enum": list(hashing.ALGORITHMS)}, "description": "Default is sha256"},
    },
    "required": ["paths"],
}
VERIFY_SCHEMA = {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute path of a checksum file (sha256sum, shasum, BSD tagged, .md5 or .sfv style)"}}, "required": ["path"]}
TEXT_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of a text file"},
        "max": {"type": "integer", "description": "Most bytes of text to return (default 2097152)"},
    },
    "required": ["path"],
}


def archive_list_tool(args: dict) -> dict:
    return archive.list_archive(absolute(str(args.get("path", ""))), int(args.get("limit") or 20000))


def archive_extract_tool(args: dict) -> dict:
    members = args.get("members")
    return extract.start(str(args.get("path", "")), args.get("dest") or None, [str(m) for m in members] if isinstance(members, list) else None)


def hash_files_tool(args: dict) -> dict:
    paths = args.get("paths")
    algorithms = args.get("algorithms")
    return hashing.start_hash([str(p) for p in paths] if isinstance(paths, list) else [], [str(a) for a in algorithms] if isinstance(algorithms, list) and algorithms else ["sha256"])


def hash_verify_tool(args: dict) -> dict:
    return hashing.start_verify(str(args.get("path", "")))


def text_read_tool(args: dict) -> dict:
    return text.read_text(str(args.get("path", "")), int(args.get("max") or text.DEFAULT_MAX))


def font_info_tool(args: dict) -> dict:
    return fonts.font_info(str(args.get("path", "")))


registry.register(
    Tool(
        id="files",
        title="Files, data, archives and checksums",
        routers=(router,),
        mcp=(
            McpTool("archive_list", "List the entries of an archive (zip, tar family, single compressed files; 7z, rar, iso and more when libarchive is installed). Reports the engine used.", LIST_SCHEMA, archive_list_tool),
            McpTool("archive_extract", "Start a safe extraction job (no path traversal, no links, no overwriting, size and ratio limits). Returns the job; poll it with job_status.", EXTRACT_SCHEMA, archive_extract_tool),
            McpTool("hash_files", "Start a hash job over files or folders with md5, sha1, sha256, sha512, sha3_256, blake3, xxh64 or crc32. Returns the job; poll it with job_status.", HASH_SCHEMA, hash_files_tool),
            McpTool("hash_verify", "Start a job that verifies every entry of a checksum file against the files beside it. Returns the job; poll it with job_status.", VERIFY_SCHEMA, hash_verify_tool),
            McpTool("text_read", "Read a text file with its detected encoding, BOM, line endings, line count and highlight language; never returns more than max bytes of text.", TEXT_SCHEMA, text_read_tool),
            McpTool("font_info", "Read a font file: names, license, glyph count, variation axes, OpenType features, scripts and Unicode block coverage.", PATH_SCHEMA, font_info_tool),
        ),
    )
)
