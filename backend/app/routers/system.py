from fastapi import APIRouter

from app.core import config, registry, window_key
from app.core.errors import ApiError

router = APIRouter(prefix="/api")


@router.get("/health")
def health() -> dict:
    return {"ok": True, "app": config.APP_NAME, "version": config.VERSION}


@router.get("/capabilities")
def capabilities() -> dict:
    return {
        "version": config.VERSION,
        "tools": [tool.id for tool in registry.tools()],
        "formats": registry.formats(),
        "os": config.os_name(),
        "secondWindowClaim": window_key.STATE["secondClaim"],
    }


@router.post("/window/key")
def claim_window_key() -> dict:
    if window_key.stdout_mode():
        raise ApiError(404, "nothing is served at that address")
    key = window_key.claim()
    if key is None:
        raise ApiError(409, "The window key was already given out for this launch")
    return {"key": key}
