import datetime
import os
import re
import sys
from functools import lru_cache

from PIL import ExifTags, Image

from app.core.errors import ApiError

TOKEN = re.compile(r"\{([A-Za-z_]+)(?::([^{}]*))?\}")
KNOWN = ("name", "ext", "n", "date", "width", "height", "folder", "exif")
ILLEGAL = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
RESERVED = frozenset(["con", "prn", "aux", "nul"] + [f"com{i}" for i in range(1, 10)] + [f"lpt{i}" for i in range(1, 10)])
CASE_BLIND = sys.platform == "darwin" or sys.platform.startswith("win")
DATE_TAKEN = 0x9003
EXIF_IFD = 0x8769

EXIF_BY_NAME = {name.lower(): tag for tag, name in ExifTags.TAGS.items()}


def fs_key(path: str) -> str:
    return os.path.normpath(path).casefold() if CASE_BLIND else os.path.normpath(path)


def safe_name(text: str) -> str:
    cleaned = ILLEGAL.sub("_", text).strip().rstrip(". ")
    if cleaned.split(".")[0].lower() in RESERVED:
        cleaned = "_" + cleaned
    return cleaned[:200]


def safe_parts(text: str) -> list[str]:
    parts = []
    for part in re.split(r"[\\/]+", text or ""):
        part = part.strip()
        if not part or part == ".":
            continue
        if part == "..":
            raise ApiError(400, "the subfolder cannot climb out of the destination")
        cleaned = safe_name(part)
        if cleaned:
            parts.append(cleaned)
    return parts


def validate(template: str) -> None:
    if len(template) > 200:
        raise ApiError(400, "the naming template is too long")
    for match in TOKEN.finditer(template):
        if match.group(1) not in KNOWN:
            raise ApiError(400, f"the naming template has an unknown token {{{match.group(1)}}}")
        if match.group(1) == "exif" and not match.group(2):
            raise ApiError(400, "the {exif} token needs a tag name, such as {exif:Model}")
        if match.group(1) == "n" and match.group(2) and not match.group(2).isdigit():
            raise ApiError(400, "the {n} token takes a number of digits, such as {n:3}")
    stripped = TOKEN.sub("", template)
    if "{" in stripped or "}" in stripped:
        raise ApiError(400, "the naming template has an unmatched brace")


def uses(template: str, *names: str) -> bool:
    return any(match.group(1) in names for match in TOKEN.finditer(template))


@lru_cache(maxsize=4096)
def read_exif(path: str, stamp: int) -> tuple[tuple[tuple[int, str], ...], datetime.datetime | None]:
    try:
        with Image.open(path) as image:
            exif = image.getexif()
            merged = dict(exif)
            merged.update(exif.get_ifd(EXIF_IFD))
    except Exception:
        return (), None
    taken = None
    raw = merged.get(DATE_TAKEN) or merged.get(0x0132)
    if isinstance(raw, bytes):
        raw = raw.decode("ascii", "ignore")
    if isinstance(raw, str):
        try:
            taken = datetime.datetime.strptime(raw.strip("\x00 ")[:19], "%Y:%m:%d %H:%M:%S")
        except ValueError:
            taken = None
    values = []
    for tag, value in merged.items():
        if isinstance(value, bytes):
            value = value.decode("utf-8", "ignore")
        if isinstance(value, (str, int, float)):
            values.append((tag, str(value).strip("\x00 ")))
    return tuple(values), taken


def file_stamp(path: str) -> int:
    try:
        return os.stat(path).st_mtime_ns
    except OSError:
        return 0


def exif_date(path: str) -> datetime.datetime | None:
    return read_exif(path, file_stamp(path))[1]


def when(path: str, source: str = "exif") -> datetime.datetime:
    if source == "exif":
        taken = exif_date(path)
        if taken is not None:
            return taken
    try:
        return datetime.datetime.fromtimestamp(os.stat(path).st_mtime)
    except OSError:
        return datetime.datetime.fromtimestamp(0)


def exif_value(path: str, name: str) -> str:
    tag = EXIF_BY_NAME.get(name.strip().lower())
    if tag is None:
        return ""
    for key, value in read_exif(path, file_stamp(path))[0]:
        if key == tag:
            return value
    return ""


def format_date(moment: datetime.datetime, pattern: str) -> str:
    try:
        return moment.strftime(pattern or "%Y-%m-%d")
    except ValueError:
        raise ApiError(400, "the date format is not valid")


def expand(template: str, path: str, index: int, width: int, height: int, folder_name: str) -> str:
    stem, ext = os.path.splitext(os.path.basename(path))

    def replace(match: re.Match) -> str:
        token, argument = match.group(1), match.group(2)
        if token == "name":
            return stem
        if token == "ext":
            return ext.lstrip(".").lower()
        if token == "n":
            return str(index).zfill(int(argument)) if argument else str(index)
        if token == "date":
            return format_date(when(path), argument or "%Y-%m-%d")
        if token == "width":
            return str(width)
        if token == "height":
            return str(height)
        if token == "folder":
            return folder_name
        return exif_value(path, argument or "")

    return safe_name(TOKEN.sub(replace, template or "{name}")) or safe_name(stem) or "file"
