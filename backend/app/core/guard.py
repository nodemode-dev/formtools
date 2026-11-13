LOOPBACK_NAMES = ("127.0.0.1", "localhost")
WINDOW_PORTS = (5240, 5241)

REFUSAL = b'{"ok":false,"error":"formtools answers this computer\'s own window and agents only"}'


def host_allowed(host: str, port: int | None) -> bool:
    name, sep, number = host.strip().lower().rpartition(":")
    if not sep or name not in LOOPBACK_NAMES or not number.isdigit():
        return False
    return port is not None and int(number) == port


def origin_allowed(origin: str, port: int | None) -> bool:
    scheme, sep, rest = origin.strip().lower().partition("://")
    if not sep or scheme != "http":
        return False
    name, sep, number = rest.rpartition(":")
    if not sep or name not in LOOPBACK_NAMES or not number.isdigit():
        return False
    return int(number) in WINDOW_PORTS or (port is not None and int(number) == port)


class HostGuard:
    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] not in ("http", "websocket"):
            await self.app(scope, receive, send)
            return
        host = ""
        origin = None
        for key, value in scope.get("headers", []):
            if key == b"host" and not host:
                host = value.decode("latin-1")
            elif key == b"origin" and origin is None:
                origin = value.decode("latin-1")
        server = scope.get("server")
        port = server[1] if server and len(server) > 1 else None
        if host_allowed(host, port) and (origin is None or origin_allowed(origin, port)):
            await self.app(scope, receive, send)
            return
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 4403})
            return
        await send({"type": "http.response.start", "status": 403, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(REFUSAL)).encode())]})
        await send({"type": "http.response.body", "body": REFUSAL})
