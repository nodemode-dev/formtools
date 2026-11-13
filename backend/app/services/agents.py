import hmac
import secrets
import threading
import time

INAPP_TOKEN = secrets.token_urlsafe(24)
INAPP_CLIENT = "Claude Code in formtools"
INAPP_HEADER = "x-formtools-inapp"
MAX_SEEN = 40

_seen: dict[str, dict] = {}
_lock = threading.Lock()


def is_inapp(token: str | None) -> bool:
    return bool(token) and hmac.compare_digest(token.encode(), INAPP_TOKEN.encode())


def caller(token: str | None, info: object) -> str:
    if is_inapp(token):
        return INAPP_CLIENT
    name = str(info.get("title") or info.get("name") or "").strip()[:80] if isinstance(info, dict) else ""
    if name == INAPP_CLIENT:
        return f"{name} (outside)"
    return name or "an outside agent"


def note(client: str) -> None:
    now = time.time()
    with _lock:
        if client not in _seen and len(_seen) >= MAX_SEEN:
            _seen.pop(min(_seen, key=lambda k: _seen[k]["last"]))
        entry = _seen.setdefault(client, {"name": client, "inapp": client == INAPP_CLIENT, "first": now, "calls": 0})
        entry["last"] = now
        entry["calls"] += 1


def clients() -> list[dict]:
    with _lock:
        return sorted((dict(v) for v in _seen.values()), key=lambda c: -c["last"])
