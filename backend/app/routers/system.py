from fastapi import APIRouter

from app.core import config, registry

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
    }
