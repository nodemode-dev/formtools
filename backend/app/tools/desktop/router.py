from fastapi import APIRouter
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from app.tools.desktop import envvars, hosts

router = APIRouter()


class HostsEntry(BaseModel):
    line: int | None = Field(default=None, ge=1)
    enabled: bool = True
    address: str = Field(max_length=64)
    names: list[str] = Field(default_factory=list, max_length=64)
    comment: str = Field(default="", max_length=1000)


class HostsBody(BaseModel):
    entries: list[HostsEntry] = Field(max_length=hosts.MAX_ENTRIES)
    version: str | None = Field(default=None, max_length=128)


class EnvBody(BaseModel):
    scope: str = Field(max_length=16)
    name: str = Field(max_length=300)
    value: str | None = Field(default=None, max_length=40000)


@router.get("/api/hosts")
async def hosts_get() -> dict:
    return await run_in_threadpool(hosts.read)


@router.post("/api/hosts")
async def hosts_post(body: HostsBody) -> dict:
    return await run_in_threadpool(hosts.save, [item.model_dump() for item in body.entries], body.version)


@router.get("/api/env")
async def env_get() -> dict:
    return await run_in_threadpool(envvars.scopes)


@router.post("/api/env")
async def env_post(body: EnvBody) -> dict:
    return await run_in_threadpool(envvars.set_var, body.scope, body.name, body.value)
