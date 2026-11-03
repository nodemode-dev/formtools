import collections
import subprocess
import threading
from pathlib import Path

from app.core import jobs
from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.tools.media import exe, preview, probe

VIDEO_CONTAINERS = ("mp4", "mkv", "mov", "webm")
AUDIO_CONTAINERS = ("m4a", "mka", "mp3", "flac", "opus", "ogg")
SINGLE_AUDIO = ("mp3", "flac", "opus", "ogg")
FASTSTART = ("mp4", "mov", "m4a")
LABELS = {"remux": "remux", "trim": "trim", "extract-audio": "audio"}
CODEC_CONTAINER = {"aac": "m4a", "alac": "m4a", "mp3": "mp3", "flac": "flac", "opus": "opus", "vorbis": "ogg"}
MILLE = 1000


def default_container(op: str, data: dict, target: Path) -> str:
    video, audio, _ = probe.split(data["streams"])
    if op != "extract-audio" and video:
        source = ext_of(target.name)
        if op == "trim" and source in VIDEO_CONTAINERS:
            return source
        return "mkv" if source in ("mp4", "m4v", "mov") else "mp4"
    if op == "trim" and ext_of(target.name) in AUDIO_CONTAINERS:
        return ext_of(target.name)
    return CODEC_CONTAINER.get(audio[0].get("codec_name") if audio else "", "mka")


def pick(data: dict, op: str, container: str, streams: list[int] | None) -> list[int]:
    every = data["streams"]
    known = {s["index"]: s for s in every}
    if streams:
        for index in streams:
            if index not in known:
                raise ApiError(400, f"stream {index} does not exist in that file")
        return list(dict.fromkeys(streams))
    if op == "extract-audio" or container in AUDIO_CONTAINERS:
        audio = [s["index"] for s in every if probe.kind_of(s) == "audio"]
        if not audio:
            raise ApiError(400, "that file has no audio")
        return audio[:1] if container in SINGLE_AUDIO else audio
    chosen = []
    for stream in every:
        kind = probe.kind_of(stream)
        codec = stream.get("codec_name")
        if kind == "video":
            if container == "webm" and probe.is_cover(stream):
                continue
            chosen.append(stream["index"])
        elif kind == "audio":
            chosen.append(stream["index"])
        elif kind == "subtitle":
            if container == "mkv" or (container in ("mp4", "mov") and codec == "mov_text") or (container == "webm" and codec == "webvtt"):
                chosen.append(stream["index"])
        elif kind == "attachment" and container == "mkv":
            chosen.append(stream["index"])
    if not chosen:
        raise ApiError(400, "that file has no streams to copy")
    return chosen


def validate(raw: str, op: str, container: str | None, start: float | None, end: float | None, streams: list[int] | None) -> dict:
    target = exe.existing_file(raw)
    data = probe.raw(target)
    if op not in LABELS:
        raise ApiError(400, "op must be remux, trim or extract-audio")
    allowed = AUDIO_CONTAINERS if op == "extract-audio" else VIDEO_CONTAINERS + AUDIO_CONTAINERS
    if container is not None and container not in allowed:
        raise ApiError(400, f"container must be one of {', '.join(allowed)} for {op}")
    if start is not None and start < 0:
        raise ApiError(400, "start must not be negative")
    if end is not None and end <= (start or 0):
        raise ApiError(400, "end must be after start")
    if op == "trim" and start is None and end is None:
        raise ApiError(400, "trim needs a start or an end")
    chosen_container = container or default_container(op, data, target)
    indexes = pick(data, op, chosen_container, streams)
    return {"target": target, "data": data, "container": chosen_container, "indexes": indexes}


def build(ffmpeg: str, plan: dict, output: Path, start: float | None, end: float | None) -> list[str]:
    container = plan["container"]
    args = [ffmpeg, "-v", "error", "-nostdin", "-y", "-progress", "pipe:1", "-nostats"]
    if start:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(plan["target"])]
    for index in plan["indexes"]:
        args += ["-map", f"0:{index}"]
    args += ["-c", "copy"]
    if end is not None:
        args += ["-t", f"{end - (start or 0):.3f}"]
    if start or end is not None:
        args += ["-avoid_negative_ts", "make_zero"]
    if container in FASTSTART:
        args += ["-movflags", "+faststart"]
    return args + [str(output)]


def span_of(data: dict, start: float | None, end: float | None) -> float:
    length = probe.duration(data) or 0.0
    stop = min(end, length) if end is not None and length else (end if end is not None else length)
    return max(0.0, (stop or 0.0) - (start or 0.0))


def drain(stream, lines: collections.deque) -> None:
    for line in iter(stream.readline, b""):
        lines.append(line.decode("utf-8", "replace").strip())


def execute(job: jobs.Job, plan: dict, output: Path, start: float | None, end: float | None, span: float) -> dict:
    ffmpeg = exe.require("ffmpeg")
    args = build(ffmpeg, plan, output, start, end)
    proc = exe.spawn(args, stderr=subprocess.PIPE)
    errors: collections.deque = collections.deque(maxlen=12)
    reader = threading.Thread(target=drain, args=(proc.stderr, errors), daemon=True)
    reader.start()
    job.step(done=0, current=output.name, total=MILLE if span > 0 else 0)
    try:
        for line in iter(proc.stdout.readline, b""):
            job.check()
            text = line.decode("utf-8", "replace").strip()
            key, _, value = text.partition("=")
            if key in ("out_time_us", "out_time_ms") and span > 0:
                try:
                    seconds = int(value) / 1_000_000
                except ValueError:
                    continue
                job.step(done=min(MILLE, max(0, int(seconds / span * MILLE))))
        proc.wait()
        reader.join(timeout=5)
    except BaseException:
        exe.kill(proc)
        output.unlink(missing_ok=True)
        raise
    finally:
        exe.kill(proc)
    if proc.returncode != 0 or not output.is_file() or output.stat().st_size == 0:
        output.unlink(missing_ok=True)
        message = " ".join(item for item in errors if item) or "ffmpeg failed"
        raise ApiError(400, f"ffmpeg could not copy the streams: {message[:300]}")
    if span > 0:
        job.step(done=MILLE)
    return {"path": str(output), "size": output.stat().st_size, "keyframe_cut": bool(start or end is not None)}


def start_copy(raw: str, op: str, container: str | None, start: float | None, end: float | None, streams: list[int] | None) -> dict:
    plan = validate(raw, op, container, start, end, streams)
    target: Path = plan["target"]
    span = span_of(plan["data"], start, end)
    output = preview.reserve(target.parent, f"{target.stem} ({LABELS[op]})", f".{plan['container']}")

    def work(job: jobs.Job) -> dict:
        return execute(job, plan, output, start, end, span)

    job = jobs.start("media-copy", f"{op} {target.name}", MILLE if span > 0 else 0, work)
    return job.to_dict()
