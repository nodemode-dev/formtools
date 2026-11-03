from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse, PlainTextResponse
from pydantic import BaseModel, Field

from app.tools.media import copy, exe, preview, probe, stream

router = APIRouter(prefix="/api/media")

CACHE_HEADER = {"Cache-Control": "private, max-age=300"}


class SnapshotRequest(BaseModel):
    path: str
    time: float = Field(default=0, ge=0)


class CopyRequest(BaseModel):
    path: str
    op: Literal["remux", "trim", "extract-audio"]
    container: Literal["mp4", "mkv", "mov", "webm", "m4a", "mka", "mp3", "flac", "opus", "ogg"] | None = None
    start: float | None = Field(default=None, ge=0)
    end: float | None = Field(default=None, ge=0)
    streams: list[int] | None = None


@router.get("/status")
def media_status() -> dict:
    return exe.status()


@router.get("/info")
def media_info(path: str) -> dict:
    return probe.describe(exe.existing_file(path))


@router.get("/thumb")
def media_thumb(path: str, size: int = 256) -> FileResponse:
    return FileResponse(preview.thumb(path, size), media_type="image/webp", headers=CACHE_HEADER)


@router.get("/waveform")
def media_waveform(path: str, points: int = 800) -> dict:
    return preview.waveform(path, points)


@router.get("/stream")
async def media_stream(path: str, start: float = 0):
    return await stream.open_stream(path, start)


@router.get("/subtitles")
def media_subtitles(path: str) -> dict:
    return preview.subtitles(path)


@router.get("/subtitle")
def media_subtitle(path: str, index: int | None = None, file: str | None = None) -> PlainTextResponse:
    return PlainTextResponse(preview.subtitle(path, index, file), media_type="text/vtt", headers=CACHE_HEADER)


@router.post("/snapshot")
def media_snapshot(body: SnapshotRequest) -> dict:
    return preview.snapshot(body.path, body.time)


@router.post("/copy")
def media_copy(body: CopyRequest) -> dict:
    return copy.start_copy(body.path, body.op, body.container, body.start, body.end, body.streams)
