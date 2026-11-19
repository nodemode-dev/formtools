import json
import os
import secrets
import threading
import time

from anyio import from_thread

from app.core import config, seal
from app.core.errors import ApiError
from app.services import agents, bridge

MODES = ("ask", "allowed", "blocked")
FILE = "settings.json"
WAIT = 120.0
SLICE = 0.5
WHERE = "formtools, Settings, Integration, Outside agents"
BLOCKED = f"Outside agents are blocked in {WHERE}, so this call was refused. Tell the person where to change it and stop; do not retry."
BLOCKED_INSIDE = f"Agents are blocked in {WHERE}, and that includes this tab, so this call was refused. Tell the person where to change it and stop; do not retry."
PUBLIC = ("id", "tool", "title", "effect", "at", "agent", "agentNamed", "what", "answers", "alwaysScope", "expires")
DENIED = "The person did not allow this in the formtools window, so it was refused. Do not retry unless they ask you to."
NO_WINDOW = f"formtools asks the person before an outside agent changes anything, and no formtools window is open to ask. Ask them to open formtools, or to choose Allowed in {WHERE}."
TIMED_OUT = "Nobody answered in the formtools window in time, so this call was refused. Ask the person to look at the formtools window, then retry."
RESET_NOTICE = "The outside agents choice was changed outside formtools, so it is back to Ask."

_lock = threading.Lock()
_pending: dict[str, dict] = {}


def _path():
    return config.data_dir() / FILE


def _read() -> dict:
    try:
        value = json.loads(_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return value if isinstance(value, dict) else {}


def _write(values: dict) -> None:
    path = _path()
    temp = path.with_name(f"{FILE}.{secrets.token_hex(4)}.tmp")
    temp.write_text(json.dumps(values, indent=2, sort_keys=True), encoding="utf-8")
    os.replace(temp, path)


def gated(tool) -> bool:
    return not tool.read_only


def state() -> dict:
    effective = seal.effective(_read())
    value = effective.get("agentAccess")
    mode = value if value in MODES else "ask"
    if mode == "allowed" and effective["seal"] != "ok":
        mode = "ask"
    return {"access": mode, "seal": effective["seal"], "sealBroken": effective["sealBroken"], "notice": RESET_NOTICE if effective["sealBroken"] else ""}


def access() -> str:
    return state()["access"]


def set_access(value: str) -> dict:
    if value not in MODES:
        raise ApiError(400, "access is ask, allowed or blocked")
    if value == "allowed" and not seal.available():
        raise ApiError(409, "Allowed needs the system keychain to keep the choice, and none is available here. Leave it on Ask and answer each request in the window.")
    with _lock:
        stored = {k: v for k, v in _read().items() if k != seal.FIELD}
        stored["agentAccess"] = value
        _write(seal.sign(stored))
    return state()


def pending() -> list[dict]:
    with _lock:
        items = sorted(_pending.values(), key=lambda r: r["at"])
        return [{k: r[k] for k in PUBLIC} for r in items if r["answer"] is None]


def what(tool, arguments) -> str:
    command = arguments.get("id") if tool.name == "run_command" and isinstance(arguments, dict) else None
    if isinstance(command, str) and command.strip():
        return "run the command " + "".join(ch for ch in command.strip() if ch.isprintable())[:80]
    return f"run {tool.name}"


def _tell(kind: str, **fields) -> None:
    try:
        from_thread.run(bridge.notify, {"t": kind, **fields})
    except Exception:
        return


def answer(request_id: str, choice: str) -> dict:
    if choice not in ("deny", "once", "always"):
        raise ApiError(400, "answer is deny, once or always")
    with _lock:
        item = _pending.get(request_id)
        if item is None or item["answer"] is not None:
            raise ApiError(404, "That request was already answered or has expired")
        item["answer"] = choice
    kept = True
    if choice == "always":
        try:
            set_access("allowed")
        except ApiError:
            kept = False
    item["done"].set()
    return {"ok": True, "access": access(), "kept": kept}


def check(tool, inapp: bool, agent: str = "", arguments: dict | None = None) -> str | None:
    if not gated(tool):
        return None
    mode = access()
    if mode == "blocked":
        return BLOCKED_INSIDE if inapp else BLOCKED
    if inapp or mode == "allowed":
        return None
    if not bridge.connected():
        return NO_WINDOW
    now = time.time()
    item = {"id": secrets.token_urlsafe(12), "tool": tool.name, "title": tool.description, "effect": tool.effect, "at": now, "answer": None, "done": threading.Event(),
            "agent": agent or agents.UNNAMED, "agentNamed": bool(agent) and agent != agents.UNNAMED, "what": what(tool, arguments),
            "answers": ["deny", "once", "always"] if seal.available() else ["deny", "once"], "alwaysScope": "all", "expires": now + WAIT}
    with _lock:
        _pending[item["id"]] = item
    _tell("ask", id=item["id"], request={k: item[k] for k in PUBLIC})
    lost = False
    try:
        until = time.monotonic() + WAIT
        while not item["done"].is_set():
            left = until - time.monotonic()
            if left <= 0:
                break
            item["done"].wait(min(SLICE, left))
            if not item["done"].is_set() and not bridge.connected():
                lost = True
                break
    finally:
        with _lock:
            _pending.pop(item["id"], None)
        _tell("answered", id=item["id"], reason="answered" if item["answer"] else "lost" if lost else "expired", answer=item["answer"])
    if item["answer"] in ("once", "always"):
        return None
    if item["answer"] == "deny":
        return DENIED
    return NO_WINDOW if lost else TIMED_OUT
