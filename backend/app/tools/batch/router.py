from typing import Any

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.tools.batch import actions, presets, rename, service

router = APIRouter(prefix="/api")


class ActionStep(BaseModel):
    id: str
    params: dict[str, Any] = Field(default_factory=dict)


class PreviewRequest(BaseModel):
    path: str
    actions: list[ActionStep] = Field(default_factory=list)
    max: int = 1024


class BatchRequest(BaseModel):
    inputs: list[str]
    recursive: bool = False
    extensions: list[str] = Field(default_factory=list)
    actions: list[ActionStep] = Field(default_factory=list)
    output: dict[str, Any] = Field(default_factory=dict)


class PresetRequest(BaseModel):
    actions: list[ActionStep] = Field(default_factory=list)
    output: dict[str, Any] = Field(default_factory=dict)


class RenameRequest(BaseModel):
    paths: list[str]
    rules: list[dict[str, Any]] = Field(default_factory=list)


class UndoRequest(BaseModel):
    undo: str


@router.get("/batch/actions")
def batch_actions() -> dict:
    return {"actions": actions.CATALOG}


@router.post("/batch/preview")
def batch_preview(body: PreviewRequest) -> Response:
    return Response(service.preview(body.model_dump()), media_type="image/webp", headers={"Cache-Control": "no-store"})


@router.post("/batch/plan")
def batch_plan(body: BatchRequest) -> dict:
    return service.plan(body.model_dump())


@router.post("/batch/run")
def batch_run(body: BatchRequest) -> dict:
    return service.run(body.model_dump())


@router.get("/batch/presets")
def preset_list() -> dict:
    return presets.listing()


@router.put("/batch/presets/{name}")
def preset_save(name: str, body: PresetRequest) -> dict:
    return presets.save(name, body.model_dump())


@router.delete("/batch/presets/{name}")
def preset_delete(name: str) -> dict:
    return presets.remove(name)


@router.post("/rename/plan")
def rename_plan(body: RenameRequest) -> dict:
    return rename.plan(body.model_dump())


@router.post("/rename/apply")
def rename_apply(body: RenameRequest) -> dict:
    return rename.apply(body.model_dump())


@router.post("/rename/undo")
def rename_undo(body: UndoRequest) -> dict:
    return rename.undo(body.model_dump())
