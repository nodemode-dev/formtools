from fastapi import APIRouter, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.core.errors import ApiError
from app.services import bridge

router = APIRouter()
LOCAL = ("127.0.0.1", "::1", "localhost", "testclient")


class Mirror(BaseModel):
    commands: list[dict] = Field(default_factory=list)


@router.websocket("/api/live")
async def live(ws: WebSocket) -> None:
    if (ws.client.host if ws.client else "") not in LOCAL:
        await ws.close(code=4403)
        return
    await ws.accept()
    key = bridge.attach(ws)
    try:
        while True:
            message = await ws.receive_json()
            if isinstance(message, dict) and message.get("t") == "result":
                bridge.resolve(message)
    except (WebSocketDisconnect, ValueError):
        pass
    finally:
        bridge.detach(key)


@router.post("/api/commands/catalogue")
def mirror(body: Mirror, request: Request) -> dict:
    if (request.client.host if request.client else "") not in LOCAL:
        raise ApiError(403, "Only this computer can change the command catalogue.")
    return {"ok": True, "size": bridge.mirror(body.commands)}
