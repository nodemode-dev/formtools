import os
import shlex
import shutil
import subprocess

from app.services import agents, claude_code, terminal

TOKEN_VAR = "FORMTOOLS_INAPP_TOKEN"
CONFIG_VAR = "FORMTOOLS_MCP_CONFIG"
PROGRAMS = {
    "codex": {"bin": "codex", "title": "Codex", "install": "npm install -g @openai/codex"},
    "cursor": {"bin": "cursor-agent", "title": "Cursor", "install": "curl https://cursor.com/install -fsS | bash"},
}


def find(kind: str) -> str | None:
    binary = PROGRAMS[kind]["bin"]
    found = shutil.which(binary, path=terminal.base_env().get("PATH"))
    if found or os.name == "nt":
        return found
    try:
        out = subprocess.run(terminal.login_shell() + ["-c", f"command -v {shlex.quote(binary)}"], capture_output=True, text=True, timeout=10,
                             env=claude_code.child_env(), stdin=subprocess.DEVNULL)
    except (OSError, subprocess.SubprocessError):
        return None
    lines = out.stdout.strip().splitlines()[-1:] if out.returncode == 0 else []
    return lines[0] if lines and os.path.isabs(lines[0]) and os.access(lines[0], os.X_OK) else None


def status() -> dict:
    out = {}
    for kind, p in PROGRAMS.items():
        path = find(kind)
        out[kind] = {"installed": path is not None, "path": path, "version": None, "signedIn": None, "install": "" if path else p["install"], "title": p["title"]}
    return out


def open_terminal(kind: str, port: int, cols: int = 100, rows: int = 30) -> dict:
    if kind not in PROGRAMS:
        raise ValueError(f"There is no agent program called {kind}.")
    path = find(kind)
    if path is None:
        raise LookupError(f"{PROGRAMS[kind]['title']} is not installed on this computer.")
    argv = [path] if os.name == "nt" else terminal.login_shell() + ["-c", "exec " + shlex.quote(path)]
    token, mcp_file = agents.issue(port)
    env = terminal.base_env() | {TOKEN_VAR: token, CONFIG_VAR: mcp_file, "FORMTOOLS_MCP_URL": f"http://127.0.0.1:{port}/mcp"}
    try:
        session = terminal.open_session(claude_code.workdir(), cols, rows, PROGRAMS[kind]["title"], argv, env, kind)
    except BaseException:
        agents.revoke(token)
        raise
    session.on_close.append(lambda: agents.revoke(token))
    return session.describe()
