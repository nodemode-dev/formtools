import hmac
import json
import os
import secrets
import threading
import time
from pathlib import Path

from app.core import config

SERVER = "formtools"
INAPP_CLIENT = "Claude Code in formtools"
INAPP_HEADER = "x-formtools-inapp"
TOKEN_FOLDER = "AgentTokens"
MAX_SEEN = 40
MAX_SESSIONS = 200
UNNAMED = "an outside agent"

SESSIONS: dict[str, str] = {}
TOKENS: dict[str, Path] = {}
_seen: dict[str, dict] = {}
_lock = threading.Lock()


def token_folder() -> Path:
    folder = config.data_dir() / TOKEN_FOLDER
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    if os.name != "nt":
        os.chmod(folder, 0o700)
    return folder


def issue(port: int) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    path = token_folder() / f"mcp-{secrets.token_hex(8)}.json"
    body = json.dumps({"mcpServers": {SERVER: {"type": "http", "url": f"http://127.0.0.1:{port}/mcp", "headers": {INAPP_HEADER: token}}}})
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(body)
    with _lock:
        TOKENS[token] = path
    return token, str(path)


def revoke(token: str) -> None:
    with _lock:
        path = TOKENS.pop(token, None)
    if path is not None:
        try:
            path.unlink()
        except OSError:
            pass


def clear() -> None:
    with _lock:
        TOKENS.clear()
    for path in token_folder().glob("mcp-*.json"):
        try:
            path.unlink()
        except OSError:
            pass


def is_inapp(token: str | None) -> bool:
    if not isinstance(token, str) or not token:
        return False
    with _lock:
        known = list(TOKENS)
    return any([hmac.compare_digest(token.encode(), item.encode()) for item in known])


def caller(token: str | None, info: object) -> str:
    if is_inapp(token):
        return INAPP_CLIENT
    name = str(info.get("title") or info.get("name") or "").strip()[:80] if isinstance(info, dict) else ""
    if name == INAPP_CLIENT:
        return f"{name} (outside)"
    return name or UNNAMED


def open_session(name: str) -> str:
    session = secrets.token_urlsafe(18)
    with _lock:
        while len(SESSIONS) >= MAX_SESSIONS:
            SESSIONS.pop(next(iter(SESSIONS)))
        SESSIONS[session] = name
    return session


def session_name(session: str | None) -> str:
    with _lock:
        return SESSIONS.get(session, "") if isinstance(session, str) else ""


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
