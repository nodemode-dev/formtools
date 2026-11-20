import json
import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from app.core import config
from app.services import agent_lookup, agents, claude_code, terminal

TOKEN_VAR = "FORMTOOLS_INAPP_TOKEN"
CONFIG_VAR = "FORMTOOLS_MCP_CONFIG"
SIGN_IN = {"codex": ["login", "status"], "cursor": ["status"]}
_cache: dict = {"at": 0.0, "value": None}
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
    "antigravity": {"bin": "agy", "title": "Antigravity", "install": agent_lookup.install("antigravity")},
}
TAB_FOLDER = "AgentTabs"


def find(kind: str) -> str | None:
    return claude_code.located(kind).path


def tab_folder(kind: str) -> Path:
    folder = config.data_dir() / TAB_FOLDER / kind
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    return folder


def _tab_file(folder: Path) -> Path:
    return folder / ".agents" / "mcp_config.json"


def _servers(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8") or "{}") if path.exists() else {}
    if not isinstance(data, dict) or not isinstance(data.get("mcpServers", {}), dict):
        raise OSError(f"{path} is not an MCP servers file formtools can read, so it was left alone")
    return data


def _replace(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + f".part-{os.getpid()}")
    with os.fdopen(os.open(part, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w", encoding="utf-8") as handle:
        handle.write(json.dumps(data, indent=2) + "\n")
    os.replace(part, path)


def write_tab_entry(folder: Path, port: int, token: str) -> None:
    path = _tab_file(folder)
    data = _servers(path)
    data.setdefault("mcpServers", {})[agents.SERVER] = {"serverUrl": f"http://127.0.0.1:{port}/mcp", "headers": {agents.INAPP_HEADER: token}}
    _replace(path, data)


def remove_tab_entry(folder: Path, token: str) -> None:
    path = _tab_file(folder)
    try:
        data = _servers(path)
        entry = data.get("mcpServers", {}).get(agents.SERVER)
        if not isinstance(entry, dict) or (entry.get("headers") or {}).get(agents.INAPP_HEADER) != token:
            return
        del data["mcpServers"][agents.SERVER]
        _replace(path, data)
    except (OSError, ValueError):
        return


def status(fresh: bool = False) -> dict:
    out = {}
    for kind, p in PROGRAMS.items():
        found = claude_code.located(kind, fresh)
        out[kind] = agent_lookup.answer(found, p["install"], claude_code.OTHERWISE) | {"signedIn": None, "install": "" if found.state == "runs" else p["install"], "title": p["title"]}
    return out


def _ask(path: str, args: list[str]) -> subprocess.CompletedProcess | None:
    try:
        return agent_lookup.run([path, *args], claude_code.child_env(path), 10)
    except (OSError, subprocess.SubprocessError):
        return None


def _signed_in(path: str, kind: str) -> bool | None:
    out = _ask(path, SIGN_IN[kind])
    said = (out.stdout + out.stderr).lower() if out is not None else ""
    if "not logged in" in said or "not authenticated" in said:
        return False
    if out is not None and out.returncode == 0 and ("logged in" in said or "authenticated" in said):
        return True
    return None


def _describe(kind: str, fresh: bool = False) -> dict:
    p = PROGRAMS[kind]
    found = claude_code.located(kind, fresh)
    out = agent_lookup.answer(found, p["install"], claude_code.OTHERWISE) | {"signedIn": None, "install": p["install"], "title": p["title"]}
    if found.state == "runs" and kind in SIGN_IN:
        out["signedIn"] = _signed_in(found.path, kind)
    return out


def programs(fresh: bool = False) -> dict:
    if not fresh and _cache["value"] is not None and time.time() - _cache["at"] < 60:
        return _cache["value"]
    with ThreadPoolExecutor(max_workers=len(PROGRAMS) + 1) as pool:
        claude = pool.submit(claude_code.info, fresh)
        others = {kind: pool.submit(_describe, kind, fresh) for kind in PROGRAMS}
        value = {"claude": claude.result() | {"title": "Claude Code"}} | {kind: job.result() for kind, job in others.items()}
    _cache["value"], _cache["at"] = value, time.time()
    return value


def open_terminal(kind: str, port: int, cols: int = 100, rows: int = 30) -> dict:
    if kind not in PROGRAMS:
        raise ValueError(f"There is no agent program called {kind}.")
    found = claude_code.usable(kind)
    if found.state != "runs":
        raise LookupError(claude_code.said(found))
    path = found.path
    argv = agent_lookup.start_argv([path])
    token, mcp_file = agents.issue(port)
    env = claude_code.child_env(path, {TOKEN_VAR: token, CONFIG_VAR: mcp_file, "FORMTOOLS_MCP_URL": f"http://127.0.0.1:{port}/mcp"})
    own = tab_folder(kind) if kind == "antigravity" else None
    try:
        if own:
            write_tab_entry(own, port, token)
        session = terminal.open_session(str(own) if own else claude_code.workdir(), cols, rows, PROGRAMS[kind]["title"], argv, env, kind)
    except BaseException:
        agents.revoke(token)
        if own:
            remove_tab_entry(own, token)
        raise
    session.on_close.append(lambda: agents.revoke(token))
    if own:
        session.on_close.append(lambda: remove_tab_entry(own, token))
    return session.describe()
