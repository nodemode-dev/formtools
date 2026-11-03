import asyncio
import subprocess

from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from app.core.errors import ApiError
from app.tools.media import exe, probe

CHUNK = 1 << 16
FIRST_BYTES_TIMEOUT = 60
HEADERS = {"Cache-Control": "no-store", "Accept-Ranges": "none"}


def arguments(ffmpeg: str, target, container: str, indexes: list[int], start: float) -> list[str]:
    args = [ffmpeg, "-v", "error", "-nostdin"]
    if start > 0:
        args += ["-ss", f"{start:.3f}"]
    args += ["-i", str(target)]
    for index in indexes:
        args += ["-map", f"0:{index}"]
    args += ["-c", "copy", "-sn", "-dn", "-map_chapters", "-1"]
    if container == "mp4":
        args += ["-movflags", "frag_keyframe+empty_moov+default_base_moof", "-f", "mp4"]
    else:
        args += ["-f", "webm"]
    return args + ["pipe:1"]


async def body(proc, first: bytes):
    try:
        yield first
        while True:
            chunk = await proc.stdout.read(CHUNK)
            if not chunk:
                break
            yield chunk
    finally:
        if proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass


async def open_stream(raw: str, start: float) -> StreamingResponse:
    target = exe.existing_file(raw)
    data = await run_in_threadpool(probe.raw, target)
    plan = probe.stream_plan(data)
    if plan is None:
        raise ApiError(415, "that file cannot be made playable by copying its streams")
    container, indexes = plan
    ffmpeg = exe.require("ffmpeg")
    args = arguments(ffmpeg, target, container, indexes, max(0.0, start))
    extra = {"creationflags": exe.NO_WINDOW} if exe.NO_WINDOW else {}
    proc = await asyncio.create_subprocess_exec(*args, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, **extra)
    try:
        first = await asyncio.wait_for(proc.stdout.read(CHUNK), FIRST_BYTES_TIMEOUT)
    except BaseException:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        raise
    if not first:
        await proc.wait()
        raise ApiError(400, "ffmpeg could not copy the streams of that file")
    audio_only = not any(probe.kind_of(s) == "video" and not probe.is_cover(s) for s in data["streams"])
    kind = "audio" if audio_only else "video"
    media_type = f"{kind}/mp4" if container == "mp4" else f"{kind}/webm"
    return StreamingResponse(body(proc, first), media_type=media_type, headers=HEADERS)
