import json
import re
import threading
from collections import OrderedDict
from fractions import Fraction
from pathlib import Path

from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.tools.media import exe

KINDS = {"video", "audio", "subtitle", "data", "attachment"}
TEXT_SUBTITLES = frozenset({"subrip", "srt", "ass", "ssa", "webvtt", "mov_text", "text", "subviewer", "subviewer1", "microdvd", "jacosub", "sami", "realtext", "stl", "vplayer", "mpl2", "pjs", "ttml"})
MP4_VIDEO = frozenset({"h264"})
MP4_AUDIO = frozenset({"aac", "mp3"})
WEBM_VIDEO = frozenset({"vp8", "vp9", "av1"})
WEBM_AUDIO = frozenset({"opus", "vorbis"})
HDR_TRANSFERS = frozenset({"smpte2084", "arib-std-b67"})
MP4_FAMILY_EXT = frozenset({"mp4", "m4v", "mov", "m4a", "3gp", "3g2"})
DEPTH = re.compile(r"(\d{2})(?:le|be)?$")

_cache: "OrderedDict[tuple, dict]" = OrderedDict()
_lock = threading.Lock()


def raw(path: Path) -> dict:
    info = path.stat()
    key = (str(path), info.st_mtime_ns, info.st_size)
    with _lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    ffprobe = exe.require("ffprobe")
    args = [ffprobe, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", "-show_chapters", "-i", str(path)]
    code, out, err = exe.run_bytes(args, timeout=60)
    if code != 0:
        raise ApiError(415, "that file is not a media file ffmpeg can read")
    try:
        data = json.loads(out.decode("utf-8", "replace"))
    except ValueError:
        raise ApiError(415, "that file is not a media file ffmpeg can read")
    if not data.get("streams"):
        raise ApiError(415, "that file has no audio or video streams")
    with _lock:
        _cache[key] = data
        while len(_cache) > 64:
            _cache.popitem(last=False)
    return data


def number(value, kind=float):
    try:
        result = kind(value)
    except (TypeError, ValueError):
        return None
    return result


def fps_of(stream: dict) -> float | None:
    for key in ("avg_frame_rate", "r_frame_rate"):
        text = stream.get(key) or ""
        try:
            value = Fraction(text)
        except (ValueError, ZeroDivisionError):
            continue
        if value > 0:
            return round(float(value), 3)
    return None


def depth_of(stream: dict) -> int | None:
    for key in ("bits_per_raw_sample", "bits_per_sample"):
        value = number(stream.get(key), int)
        if value:
            return value
    found = DEPTH.search(stream.get("pix_fmt") or "")
    if found and stream.get("codec_type") == "video":
        return int(found.group(1))
    if stream.get("codec_type") == "video" and stream.get("pix_fmt"):
        return 8
    return None


def kind_of(stream: dict) -> str:
    kind = stream.get("codec_type") or "data"
    return kind if kind in KINDS else "data"


def is_cover(stream: dict) -> bool:
    return bool((stream.get("disposition") or {}).get("attached_pic"))


def describe_stream(stream: dict) -> dict:
    tags = {str(k).lower(): v for k, v in (stream.get("tags") or {}).items()}
    disposition = stream.get("disposition") or {}
    kind = kind_of(stream)
    transfer = stream.get("color_transfer")
    hdr = None
    if kind == "video" and transfer in HDR_TRANSFERS:
        hdr = {"transfer": transfer, "primaries": stream.get("color_primaries"), "matrix": stream.get("color_space")}
    return {
        "index": stream.get("index"),
        "type": kind,
        "codec": stream.get("codec_name"),
        "codec_long": stream.get("codec_long_name"),
        "profile": stream.get("profile"),
        "width": stream.get("width") if kind == "video" else None,
        "height": stream.get("height") if kind == "video" else None,
        "fps": fps_of(stream) if kind == "video" and not is_cover(stream) else None,
        "pix_fmt": stream.get("pix_fmt"),
        "bit_depth": depth_of(stream),
        "hdr": hdr,
        "channels": stream.get("channels"),
        "layout": stream.get("channel_layout"),
        "sample_rate": number(stream.get("sample_rate"), int),
        "bit_rate": number(stream.get("bit_rate"), int),
        "language": tags.get("language"),
        "title": tags.get("title"),
        "default": bool(disposition.get("default")),
        "forced": bool(disposition.get("forced")),
        "cover": is_cover(stream),
    }


def container_of(data: dict, path: Path) -> str:
    names = (data.get("format") or {}).get("format_name", "").split(",")
    ext = ext_of(path.name)
    if "matroska" in names or "webm" in names:
        return "webm" if ext == "webm" else "mkv"
    if "mov" in names or "mp4" in names:
        return "mp4"
    for name in ("mp3", "wav", "flac", "ogg", "aac"):
        if name in names:
            return name
    return names[0] if names and names[0] else ext


def split(streams: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    video = [s for s in streams if kind_of(s) == "video" and not is_cover(s)]
    audio = [s for s in streams if kind_of(s) == "audio"]
    cover = [s for s in streams if kind_of(s) == "video" and is_cover(s)]
    return video, audio, cover


def native(data: dict, path: Path) -> bool:
    container = container_of(data, path)
    video, audio, _ = split(data["streams"])
    v = {s.get("codec_name") for s in video}
    a = {s.get("codec_name") for s in audio}
    if not video:
        if not audio:
            return False
        if container == "mp4":
            return ext_of(path.name) in MP4_FAMILY_EXT and a <= MP4_AUDIO
        if container == "mp3":
            return a <= {"mp3"}
        if container == "wav":
            return all(str(c).startswith("pcm_") for c in a)
        if container == "flac":
            return a <= {"flac"}
        if container == "ogg":
            return a <= {"opus", "vorbis", "flac"}
        if container == "aac":
            return a <= {"aac"}
        if container == "webm":
            return a <= WEBM_AUDIO
        return False
    if container == "mp4":
        return ext_of(path.name) in MP4_FAMILY_EXT and v <= MP4_VIDEO and a <= MP4_AUDIO
    if container == "webm":
        return v <= WEBM_VIDEO and a <= WEBM_AUDIO
    return False


def stream_plan(data: dict) -> tuple[str, list[int]] | None:
    video, audio, cover = split(data["streams"])
    if video:
        first = video[0]
        codec = first.get("codec_name")
        if codec in MP4_VIDEO:
            good = [s for s in audio if s.get("codec_name") in MP4_AUDIO]
            if audio and not good:
                return None
            return "mp4", [first["index"]] + [s["index"] for s in good]
        if codec in WEBM_VIDEO:
            good = [s for s in audio if s.get("codec_name") in WEBM_AUDIO]
            if audio and not good:
                return None
            return "webm", [first["index"]] + [s["index"] for s in good]
        return None
    if not audio:
        return None
    good = [s for s in audio if s.get("codec_name") in MP4_AUDIO]
    if good:
        return "mp4", [good[0]["index"]]
    good = [s for s in audio if s.get("codec_name") in WEBM_AUDIO]
    if good:
        return "webm", [good[0]["index"]]
    return None


def describe(path: Path) -> dict:
    data = raw(path)
    fmt = data.get("format") or {}
    return {
        "format": {
            "name": fmt.get("format_name"),
            "long_name": fmt.get("format_long_name"),
            "duration": number(fmt.get("duration")),
            "bit_rate": number(fmt.get("bit_rate"), int),
            "size": number(fmt.get("size"), int),
            "tags": fmt.get("tags") or {},
        },
        "streams": [describe_stream(s) for s in data["streams"]],
        "chapters": [
            {"start": number(c.get("start_time")), "end": number(c.get("end_time")), "title": (c.get("tags") or {}).get("title")}
            for c in data.get("chapters") or []
        ],
        "playable": {"native": native(data, path), "remux": stream_plan(data) is not None},
    }


def duration(data: dict) -> float | None:
    value = number((data.get("format") or {}).get("duration"))
    if value and value > 0:
        return value
    for stream in data["streams"]:
        value = number(stream.get("duration"))
        if value and value > 0:
            return value
    return None
