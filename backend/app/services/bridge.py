import asyncio
import itertools

from fastapi import WebSocket

_windows: dict[int, WebSocket] = {}
_pending: dict[str, asyncio.Future] = {}
_owner: dict[str, int] = {}
_ids = itertools.count(1)
_catalogue: list[dict] = []


def attach(ws: WebSocket) -> int:
    key = next(_ids)
    _windows[key] = ws
    return key


def detach(key: int) -> None:
    _windows.pop(key, None)
    for rid, owner in list(_owner.items()):
        fut = _pending.get(rid)
        if owner == key and fut and not fut.done():
            fut.set_result({"ok": False, "error": "The formtools window closed before it answered."})


def connected() -> bool:
    return bool(_windows)


def resolve(message: dict) -> None:
    fut = _pending.get(str(message.get("id", "")))
    if fut and not fut.done():
        fut.set_result(message)


def mirror(commands: list[dict]) -> int:
    clean = [{k: c.get(k) for k in ("id", "label", "group", "description", "keys", "params") if k in c}
             for c in commands if isinstance(c, dict) and isinstance(c.get("id"), str)][:5000]
    _catalogue[:] = clean
    return len(clean)


def catalogue() -> list[dict]:
    return list(_catalogue)


def find(cid: str) -> dict | None:
    return next((c for c in _catalogue if c.get("id") == cid), None)


async def call(command: str, params: dict, timeout: float = 60) -> dict:
    for key, ws in sorted(_windows.items(), reverse=True):
        rid = f"r{next(_ids)}"
        fut = asyncio.get_running_loop().create_future()
        _pending[rid] = fut
        _owner[rid] = key
        try:
            try:
                await ws.send_json({"t": "run", "id": rid, "command": command, "params": params})
            except Exception:
                detach(key)
                continue
            try:
                out = await asyncio.wait_for(fut, timeout)
            except asyncio.TimeoutError:
                return {"ok": False, "error": f"The formtools window did not answer {command} within {int(timeout)} seconds."}
            return {"ok": bool(out.get("ok")), **({"result": out.get("result")} if out.get("ok") else {"error": str(out.get("error") or "The command failed.")})}
        finally:
            _pending.pop(rid, None)
            _owner.pop(rid, None)
    return {"ok": False, "error": "No formtools window is open. Start it with ./formtools and open the app, then retry."}
