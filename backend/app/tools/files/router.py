from typing import Literal

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.routers.fs import absolute
from app.tools.files import archive, create, data, extract, fonts, hashing, text

router = APIRouter(prefix="/api")

SAFE_HEADERS = {"X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox", "Cache-Control": "private, max-age=60"}


class ExtractRequest(BaseModel):
    path: str
    dest: str | None = None
    members: list[str] | None = None


class CreateRequest(BaseModel):
    paths: list[str] = Field(min_length=1)
    out: str
    format: Literal["zip", "tar", "tar.gz", "tar.xz", "tar.zst"]


class HashRequest(BaseModel):
    paths: list[str] = Field(min_length=1)
    algorithms: list[str] = Field(default_factory=lambda: ["sha256"])


class VerifyRequest(BaseModel):
    path: str


class FontRequest(BaseModel):
    path: str


@router.get("/archive/list")
def archive_list(path: str, limit: int = 20000) -> dict:
    return archive.list_archive(absolute(path), limit)


@router.get("/archive/member")
def archive_member(path: str, member: str) -> Response:
    payload, kind = archive.read_member(absolute(path), member)
    return Response(content=payload, media_type=kind, headers=SAFE_HEADERS)


@router.post("/archive/extract")
def archive_extract(body: ExtractRequest) -> dict:
    return extract.start(body.path, body.dest, body.members)


@router.post("/archive/create")
def archive_create(body: CreateRequest) -> dict:
    return create.start(body.paths, body.out, body.format)


@router.post("/hash")
def hash_files(body: HashRequest) -> dict:
    return hashing.start_hash(body.paths, body.algorithms)


@router.post("/hash/verify")
def hash_verify(body: VerifyRequest) -> dict:
    return hashing.start_verify(body.path)


@router.get("/text")
def text_read(path: str, max: int = text.DEFAULT_MAX) -> dict:
    return text.read_text(path, max)


@router.get("/data/csv")
def data_csv(path: str, limit: int = 5000) -> dict:
    return data.read_csv(path, limit)


@router.get("/data/sqlite/tables")
def data_sqlite_tables(path: str) -> dict:
    return data.sqlite_tables(path)


@router.get("/data/sqlite/rows")
def data_sqlite_rows(path: str, table: str, offset: int = 0, limit: int = 200) -> dict:
    return data.sqlite_rows(path, table, offset, limit)


@router.get("/font/info")
def font_info(path: str) -> dict:
    return fonts.font_info(path)


@router.post("/font/install")
def font_install(body: FontRequest) -> dict:
    return fonts.install_font(body.path)
