import asyncio
import hmac
import json
import os
import secrets

from app.core.errors import ApiError

HEADER = "x-formtools-window-key"
STDOUT_ENV = "FORMTOOLS_WINDOW_KEY_STDOUT"
LINE = "formtools-window-key: "
REFUSED = "Only the formtools window can do this"
READS = ("GET", "HEAD", "OPTIONS")
OPEN = ("/mcp", "/api/window/key")
SOCKET_WAIT = 5.0
KEY = secrets.token_urlsafe(32)
STATE = {"claimed": False, "secondClaim": False}


def stdout_mode() -> bool:
    return os.environ.get(STDOUT_ENV) == "1"


def valid(value) -> bool:
    return isinstance(value, str) and bool(value) and hmac.compare_digest(value.encode("utf-8"), KEY.encode("utf-8"))


def require(request) -> None:
    if not valid(request.headers.get(HEADER)):
        raise ApiError(403, REFUSED)


def claim() -> str | None:
    if STATE["claimed"]:
        STATE["secondClaim"] = True
        return None
    STATE["claimed"] = True
    return KEY


async def socket_is_window(ws, field: str, value: str) -> bool:
    try:
        message = await asyncio.wait_for(ws.receive_json(), SOCKET_WAIT)
    except Exception:
        return False
    return isinstance(message, dict) and message.get(field) == value and valid(message.get("key"))


class WindowKeyGuard:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http" or scope.get("method") in READS or str(scope.get("path", "")) in OPEN:
            await self.app(scope, receive, send)
            return
        given = next((v.decode("latin-1") for k, v in scope.get("headers", []) if k.decode("latin-1").lower() == HEADER), None)
        if valid(given):
            await self.app(scope, receive, send)
            return
        body = json.dumps({"ok": False, "error": REFUSED}).encode("utf-8")
        await send({"type": "http.response.start", "status": 403, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
