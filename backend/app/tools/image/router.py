from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

from app.tools.image import edit, info, meta, service, transform

router = APIRouter(prefix="/api/image")
meta_router = APIRouter(prefix="/api/meta")

CACHE_HEADER = {"Cache-Control": "private, max-age=300"}


class TransformRequest(BaseModel):
    path: str
    op: Literal["rotate-cw", "rotate-ccw", "rotate-180", "flip-h", "flip-v"]
    lossless: bool = True


class MetaReadRequest(BaseModel):
    paths: list[str]


class MetaWriteRequest(BaseModel):
    path: str
    rating: int | None = None
    label: str | None = None


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


@router.post("/edit")
def image_edit(body: edit.EditRequest) -> dict:
    return edit.run(body)


@meta_router.post("/read")
def meta_read(body: MetaReadRequest) -> dict:
    return meta.read_many(body.paths)


@meta_router.post("/write")
def meta_write(body: MetaWriteRequest) -> dict:
    given = body.model_fields_set
    return meta.write(body.path, body.rating, body.label, "rating" in given and body.rating is not None, "label" in given)
