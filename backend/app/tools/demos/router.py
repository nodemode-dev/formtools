from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from app.tools.demos import service

router = APIRouter()


@router.get("/api/demos")
def demos() -> dict:
    return service.listing()


@router.post("/api/demos/{demo_id}")
async def open_demo(demo_id: str) -> dict:
    return await run_in_threadpool(service.ensure, demo_id)


@router.get("/api/demos/{demo_id}/cover.png")
async def demo_cover(demo_id: str) -> FileResponse:
    path = await run_in_threadpool(service.cover, demo_id)
    return FileResponse(path, media_type="image/png", headers={"Cache-Control": "no-cache"})
