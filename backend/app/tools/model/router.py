from typing import Literal

from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.routers.fs import absolute
from app.tools.model import assets, service

router = APIRouter(prefix="/api/model")

CACHE_HEADER = {"Cache-Control": "private, max-age=300"}
ASSET_HEADERS = {"Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff"}


class ConvertRequest(BaseModel):
    path: str
    format: Literal["glb", "obj", "stl", "ply", "off"]
    out: str | None = None


@router.get("/info")
def model_info(path: str) -> dict:
    return service.info(path)


@router.get("/view")
def model_view(path: str) -> FileResponse:
    return FileResponse(service.view(path), media_type="model/gltf-binary", headers=CACHE_HEADER)


@router.get("/asset")
def model_asset(path: str, uri: str) -> FileResponse:
    target = assets.locate(absolute(path), uri)
    return FileResponse(target, media_type=assets.media_type(target), headers=ASSET_HEADERS)


@router.post("/convert")
def model_convert(body: ConvertRequest) -> dict:
    return service.start_convert(body.path, body.format, body.out)
