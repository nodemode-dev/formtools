from typing import Literal

from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.tools.utilities import locks, service, templates, trash

router = APIRouter()


class DupesRequest(BaseModel):
    roots: list[str] = Field(min_length=1, max_length=64)
    recursive: bool = True
    min_size: int = Field(default=1, ge=0)
    mode: Literal["exact", "similar-images"] = "exact"
    threshold: int = Field(default=6, ge=0, le=64)
    include_hidden: bool = False


class TrashRequest(BaseModel):
    paths: list[str] = Field(min_length=1, max_length=5000)


class DiskRequest(BaseModel):
    root: str
    include_hidden: bool = False


class RootRequest(BaseModel):
    root: str


class CreateRequest(BaseModel):
    template: str
    folder: str
    name: str | None = None


@router.post("/api/dupes/scan")
def dupes_scan(body: DupesRequest) -> dict:
    return service.start_dupes(body.roots, body.recursive, body.min_size, body.mode, body.threshold, body.include_hidden)


@router.post("/api/files/trash")
async def files_trash(body: TrashRequest) -> dict:
    return await run_in_threadpool(trash.move_to_trash, body.paths)


@router.post("/api/diskusage/scan")
def diskusage_scan(body: DiskRequest) -> dict:
    return service.start_diskusage(body.root, body.include_hidden)


@router.post("/api/files/empty-folders")
def files_empty_folders(body: RootRequest) -> dict:
    return service.start_empty_folders(body.root)


@router.post("/api/files/broken")
def files_broken(body: RootRequest) -> dict:
    return service.start_broken(body.root)


@router.get("/api/files/locks")
async def files_locks(path: str) -> dict:
    return await run_in_threadpool(locks.holders, path)


@router.get("/api/templates")
async def templates_list() -> dict:
    return await run_in_threadpool(templates.listing)


@router.post("/api/templates/create")
async def templates_create(body: CreateRequest) -> dict:
    return await run_in_threadpool(templates.create, body.template, body.folder, body.name)
