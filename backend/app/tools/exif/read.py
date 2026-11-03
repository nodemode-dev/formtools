import json
import os
import re
import stat
from pathlib import Path
from typing import Any

from app.core.errors import ApiError
from app.routers.fs import absolute
from app.tools.exif import locate, runner

ORDER = ("file", "exif", "xmp", "iptc", "composite", "quicktime", "id3")
BINARY = re.compile(r"^\(Binary data (\d+) bytes(?:, use -b option to extract)?\)$")
COPY_SUFFIX = re.compile(r" \(\d+\)$")
SKIP = {"SourceFile"}
NOTES = ("Warning", "Error")


def regular_file(raw: str) -> Path:
    target = absolute(raw)
    if "\n" in raw or "\r" in raw:
        raise ApiError(400, "that path cannot be read because its name holds a line break")
    try:
        info = target.stat()
    except FileNotFoundError:
        raise ApiError(404, "that file does not exist")
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    if stat.S_ISDIR(info.st_mode):
        raise ApiError(400, "that path is a folder, not a file")
    if not stat.S_ISREG(info.st_mode):
        raise ApiError(400, "that path is not a regular file")
    try:
        with open(target, "rb"):
            pass
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    return target


def arguments(target: Path, numeric: bool, unknown: bool) -> list[str]:
    args = ["-json", "-a", "-G0:1", "-struct", "-l", "-charset", "filename=utf8", "-api", "largefilesupport=1"]
    if numeric:
        args.append("-n")
    if unknown:
        args.append("-u")
    args.append(os.fspath(target))
    return args


def clean(value: Any) -> Any:
    if isinstance(value, str):
        found = BINARY.match(value)
        if found:
            return f"Binary data, {int(found.group(1)):,} bytes"
        return value
    if isinstance(value, list):
        return [clean(item) for item in value]
    if isinstance(value, dict):
        return {key: clean(item) for key, item in value.items()}
    return value


def split_key(key: str) -> tuple[str, str, str]:
    parts = key.split(":")
    tag = COPY_SUFFIX.sub("", parts[-1])
    if len(parts) >= 3:
        return parts[0], ":".join(parts[1:-1]), tag
    if len(parts) == 2:
        return parts[0], parts[0], tag
    return "", "", tag


def rank(group: dict) -> tuple:
    zero = group["family0"].casefold()
    place = ORDER.index(zero) if zero in ORDER else len(ORDER)
    return (place, "" if place < len(ORDER) else zero, group["name"] != group["family0"], group["name"].casefold())


def notes_of(value: Any) -> list[str]:
    items = value if isinstance(value, list) else [value]
    return [str(item) for item in items if item not in (None, "")]


def shape(raw: bytes, target: Path, version: str) -> dict:
    try:
        loaded = json.loads(raw.decode("utf-8", "replace"))
        record = loaded[0]
    except (ValueError, IndexError, TypeError, KeyError):
        raise ApiError(400, "ExifTool gave no readable answer for that file")
    if not isinstance(record, dict):
        raise ApiError(400, "ExifTool gave no readable answer for that file")
    groups: dict[tuple[str, str], dict] = {}
    warnings: list[str] = []
    kind = mime = None
    for key, entry in record.items():
        if key in SKIP:
            continue
        zero, one, tag = split_key(key)
        if isinstance(entry, dict) and ("val" in entry or "desc" in entry):
            value, label = entry.get("val"), entry.get("desc")
        else:
            value, label = entry, None
        if zero == "ExifTool":
            if tag in NOTES:
                warnings.extend(notes_of(value))
            continue
        value = clean(value)
        if zero == "File" and one == "File":
            if tag == "FileType":
                kind = value if isinstance(value, str) else None
            elif tag == "MIMEType":
                mime = value if isinstance(value, str) else None
        group = groups.setdefault((zero, one), {"name": one, "family0": zero, "tags": []})
        group["tags"].append({"name": tag, "label": label if isinstance(label, str) and label else tag, "value": value})
    ordered = sorted(groups.values(), key=rank)
    return {
        "tool": "exiftool",
        "version": version,
        "file": {"name": target.name, "size": target.stat().st_size, "type": kind, "mime": mime},
        "groups": ordered,
        "count": sum(len(group["tags"]) for group in ordered),
        "warnings": warnings,
    }


def read(raw: str, numeric: bool = False, unknown: bool = False) -> dict:
    target = regular_file(raw)
    found, _ = locate.resolve()
    if found is None:
        raise ApiError(415, locate.unavailable_sentence())
    output = runner.execute(found.command, arguments(target, numeric, unknown))
    return shape(output, target, found.version)


def keep_groups(result: dict, names: list[str]) -> dict:
    wanted = {name.strip().casefold() for name in names if name.strip()}
    if not wanted:
        return result
    kept = [group for group in result["groups"] if group["name"].casefold() in wanted or group["family0"].casefold() in wanted]
    return {**result, "groups": kept, "count": sum(len(group["tags"]) for group in kept)}
