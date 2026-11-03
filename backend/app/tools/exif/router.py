from fastapi import APIRouter

from app.tools.exif import fetch, locate, read

router = APIRouter(prefix="/api/exif")


@router.get("/status")
def exif_status() -> dict:
    return locate.status()


@router.post("/fetch")
def exif_fetch() -> dict:
    return fetch.start()


@router.get("/read")
def exif_read(path: str, numeric: int = 0, unknown: int = 0) -> dict:
    return read.read(path, bool(numeric), bool(unknown))
