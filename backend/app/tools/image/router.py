from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.tools.image import info, service, transform

router = APIRouter(prefix="/api/image")

CACHE_HEADER = {"Cache-Control": "private, max-age=300"}


class TransformRequest(BaseModel):
    path: str
    op: Literal["rotate-cw", "rotate-ccw", "rotate-180", "flip-h", "flip-v"]
    lossless: bool = True


@router.get("/thumb")
def thumb(path: str, size: int = 256) -> FileResponse:
    return FileResponse(service.thumb(path, size), media_type="image/webp", headers=CACHE_HEADER)


@router.get("/view")
def view(path: str, max: int = 0) -> Response:
    data, media_type = service.view(path, max)
    return Response(data, media_type=media_type, headers=CACHE_HEADER)


@router.get("/info")
def image_info(path: str) -> dict:
    return info.describe(path)


@router.post("/transform")
def image_transform(body: TransformRequest) -> dict:
    return transform.run(body.path, body.op, body.lossless)
