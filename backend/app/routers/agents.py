from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.core import window_key
from app.services import agent_programs, consent

router = APIRouter(prefix="/api/agents", tags=["agents"])


class Access(BaseModel):
    access: str


class Answer(BaseModel):
    answer: str


@router.get("/requests")
def list_requests(request: Request) -> dict:
    window_key.require(request)
    return {**consent.state(), "requests": consent.pending()}


@router.get("/status")
def agent_status(request: Request, fresh: bool = False) -> dict:
    window_key.require(request)
    return agent_programs.programs(fresh)


@router.put("/access")
def set_access(body: Access, request: Request) -> dict:
    window_key.require(request)
    return {"ok": True, **consent.set_access(body.access)}


@router.post("/requests/{request_id}")
def answer_request(request_id: str, body: Answer, request: Request) -> dict:
    window_key.require(request)
    return consent.answer(request_id, body.answer)
