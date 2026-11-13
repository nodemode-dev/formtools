import hashlib
import io
import json
import os
import threading
from pathlib import Path

import numpy as np
from PIL import Image

from app.core import config
from app.core.errors import ApiError
from app.tools.media import exe, probe

SLOTS = threading.BoundedSemaphore(3)
THUMB_RANGE = (64, 512)
POINT_RANGE = (100, 4000)
THUMB_QUALITY = 82
WAVE_RATE = 8000
WAVE_BLOCK = 40
SUBTITLE_EXTENSIONS = (".srt", ".ass", ".ssa", ".vtt")


def cache_key(path: Path, tag: str) -> str:
    info = path.stat()
    key = f"media|{path}|{tag}|{info.st_mtime_ns}|{info.st_size}".encode("utf-8", "surrogatepass")
    return hashlib.sha1(key).hexdigest()


def cache_file(group: str, digest: str, suffix: str) -> Path:
    return config.cache_dir(group) / digest[:2] / f"{digest}{suffix}"


def store(target: Path, data: bytes) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, target)


def frame_png(path: Path, stream: int, at: float, size: int, cover: bool) -> bytes:
    ffmpeg = exe.require("ffmpeg")
    fit = f"scale=w='min({size},iw)':h='min({size},ih)':force_original_aspect_ratio=decrease"
    args = [ffmpeg, "-v", "error", "-nostdin"]
    if not cover and at > 0:
        args += ["-ss", f"{at:.3f}"]
    args += ["-i", str(path), "-map", f"0:{stream}", "-frames:v", "1", "-an", "-sn", "-vf", fit, "-f", "image2pipe", "-c:v", "png", "pipe:1"]
    code, out, _ = exe.run_bytes(args, timeout=60)
    return out if code == 0 else b""


def thumb(raw: str, size: int) -> Path:
    target = exe.existing_file(raw)
    size = max(THUMB_RANGE[0], min(THUMB_RANGE[1], size))
    cached = cache_file("thumbs", cache_key(target, f"thumb{size}"), ".webp")
    if cached.is_file():
        os.utime(cached, None)
        return cached
    data = probe.raw(target)
    video, _, covers = probe.split(data["streams"])
    length = probe.duration(data)
    with SLOTS:
        if video:
            stream = video[0]["index"]
            at = length * 0.1 if length else 1.0
            png = frame_png(target, stream, at, size, False)
            if not png and at > 0:
                png = frame_png(target, stream, 0.0, size, False)
        elif covers:
            png = frame_png(target, covers[0]["index"], 0.0, size, True)
        else:
            raise ApiError(404, "that file has no picture to show")
        if not png:
            raise ApiError(400, "ffmpeg could not make a picture from that file")
        image = Image.open(io.BytesIO(png))
        image.load()
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGB")
        if max(image.size) > size:
            image.thumbnail((size, size), Image.Resampling.LANCZOS)
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=THUMB_QUALITY, method=4)
    store(cached, buffer.getvalue())
    return cached


def block_peaks(path: Path) -> np.ndarray:
    ffmpeg = exe.require("ffmpeg")
    args = [ffmpeg, "-v", "error", "-nostdin", "-i", str(path), "-map", "0:a:0", "-vn", "-sn", "-ac", "1", "-ar", str(WAVE_RATE), "-f", "s16le", "-c:a", "pcm_s16le", "pipe:1"]
    proc = exe.spawn(args)
    pieces: list[np.ndarray] = []
    pending = b""
    width = WAVE_BLOCK * 2
    try:
        while True:
            chunk = proc.stdout.read(1 << 20)
            if not chunk:
                break
            pending += chunk
            usable = len(pending) - len(pending) % width
            if usable:
                samples = np.frombuffer(pending[:usable], dtype="<i2").astype(np.int32)
                pieces.append(np.abs(samples).reshape(-1, WAVE_BLOCK).max(axis=1).astype(np.float32))
                pending = pending[usable:]
        tail = pending[: len(pending) - len(pending) % 2]
        if tail:
            samples = np.frombuffer(tail, dtype="<i2").astype(np.int32)
            pieces.append(np.array([np.abs(samples).max()], dtype=np.float32))
        proc.wait()
    finally:
        exe.kill(proc)
    if proc.returncode not in (0, None) and not pieces:
        raise ApiError(400, "ffmpeg could not decode the audio of that file")
    return np.concatenate(pieces) / 32768.0 if pieces else np.zeros(0, dtype=np.float32)


def reduce(blocks: np.ndarray, points: int) -> list[float]:
    count = len(blocks)
    if count == 0:
        return [0.0] * points
    if count >= points:
        edges = (np.arange(points, dtype=np.int64) * count) // points
        peaks = np.maximum.reduceat(blocks, edges)
    else:
        peaks = blocks[(np.arange(points, dtype=np.int64) * count) // points]
    return [round(float(min(1.0, value)), 4) for value in peaks]


def waveform(raw: str, points: int) -> dict:
    target = exe.existing_file(raw)
    points = max(POINT_RANGE[0], min(POINT_RANGE[1], points))
    data = probe.raw(target)
    if not any(probe.kind_of(s) == "audio" for s in data["streams"]):
        raise ApiError(400, "that file has no audio")
    length = probe.duration(data)
    cached = cache_file("waveforms", cache_key(target, f"wave{points}"), ".json")
    if cached.is_file():
        os.utime(cached, None)
        return json.loads(cached.read_text("utf-8"))
    with SLOTS:
        blocks = block_peaks(target)
    result = {"duration": length if length is not None else round(len(blocks) * WAVE_BLOCK / WAVE_RATE, 3), "peaks": reduce(blocks, points)}
    store(cached, json.dumps(result).encode("utf-8"))
    return result


def embedded_subtitles(data: dict) -> list[dict]:
    items = []
    for stream in data["streams"]:
        if probe.kind_of(stream) == "subtitle" and stream.get("codec_name") in probe.TEXT_SUBTITLES:
            described = probe.describe_stream(stream)
            items.append({"index": described["index"], "language": described["language"], "title": described["title"], "codec": described["codec"]})
    return items


def external_subtitles(target: Path) -> list[str]:
    found = []
    stem = target.stem
    try:
        names = sorted(os.listdir(target.parent), key=str.casefold)
    except OSError:
        return found
    for name in names:
        lower = name.lower()
        if lower.endswith(SUBTITLE_EXTENSIONS) and name.startswith(stem + "."):
            full = target.parent / name
            if full.is_file():
                found.append(str(full))
    return found


def subtitles(raw: str) -> dict:
    target = exe.existing_file(raw)
    return {"embedded": embedded_subtitles(probe.raw(target)), "external": external_subtitles(target)}


def to_vtt(source: Path, mapping: list[str]) -> str:
    ffmpeg = exe.require("ffmpeg")
    args = [ffmpeg, "-v", "error", "-nostdin", "-i", str(source), *mapping, "-f", "webvtt", "pipe:1"]
    code, out, err = exe.run_bytes(args, timeout=120)
    if code != 0 or not out:
        raise ApiError(400, "ffmpeg could not convert those subtitles to WebVTT")
    return out.decode("utf-8", "replace")


def subtitle(raw: str, index: int | None, file: str | None) -> str:
    target = exe.existing_file(raw)
    if file:
        named = Path(file)
        candidate = named if named.is_absolute() else target.parent / named
        if candidate.parent != target.parent or candidate.suffix.lower() not in SUBTITLE_EXTENSIONS:
            raise ApiError(400, "the subtitle file must be a .srt, .ass, .ssa or .vtt file beside the video")
        if not candidate.is_file():
            raise ApiError(404, "that subtitle file does not exist")
        if candidate.suffix.lower() == ".vtt":
            return candidate.read_text("utf-8", "replace")
        return to_vtt(candidate, ["-map", "0:s:0"])
    if index is None:
        raise ApiError(400, "give index (an embedded subtitle stream) or file (a subtitle file beside the video)")
    data = probe.raw(target)
    if not any(s["index"] == index for s in embedded_subtitles(data)):
        raise ApiError(400, "that stream is not a text subtitle stream")
    return to_vtt(target, ["-map", f"0:{index}"])


def stamp(seconds: float) -> str:
    whole = int(seconds)
    millis = int(round((seconds - whole) * 1000))
    if millis == 1000:
        whole, millis = whole + 1, 0
    return f"{whole // 3600:02d}-{whole % 3600 // 60:02d}-{whole % 60:02d}.{millis:03d}"


def reserve(folder: Path, stem: str, suffix: str) -> Path:
    number = 1
    while True:
        label = "" if number == 1 else f" ({number})"
        candidate = folder / f"{stem}{label}{suffix}"
        try:
            with open(candidate, "xb"):
                pass
            return candidate
        except FileExistsError:
            number += 1
        except OSError:
            raise ApiError(400, "formtools cannot write beside that file")


def snapshot(raw: str, at: float) -> dict:
    target = exe.existing_file(raw)
    data = probe.raw(target)
    video, _, _ = probe.split(data["streams"])
    if not video:
        raise ApiError(400, "that file has no video to take a picture of")
    length = probe.duration(data)
    if at < 0 or (length and at > length):
        raise ApiError(400, "time is outside the video")
    ffmpeg = exe.require("ffmpeg")
    output = reserve(target.parent, f"{target.stem} {stamp(at)}", ".png")
    args = [ffmpeg, "-v", "error", "-nostdin", "-y", "-ss", f"{at:.3f}", "-i", str(target), "-map", f"0:{video[0]['index']}", "-frames:v", "1", "-an", "-sn", "-update", "1", str(output)]
    code, _, err = exe.run_bytes(args, timeout=120)
    if code != 0 or not output.is_file() or output.stat().st_size == 0:
        output.unlink(missing_ok=True)
        raise ApiError(400, "ffmpeg could not take a picture at that time")
    return {"ok": True, "path": str(output)}
