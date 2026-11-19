import os
import stat
import sys
import time

import pytest

from conftest import PORT


@pytest.fixture
def stand_ins(tmp_path, monkeypatch):
    folder = tmp_path / "bin"
    folder.mkdir()
    for name in ("codex", "cursor-agent"):
        script = folder / name
        script.write_text(f'#!/bin/sh\necho "STAND-IN {name}"\nexec sleep 60\n', encoding="utf-8")
        script.chmod(script.stat().st_mode | stat.S_IXUSR)
    monkeypatch.setenv("PATH", str(folder) + os.pathsep + os.environ.get("PATH", ""))
    return folder


@pytest.fixture
def no_programs(monkeypatch):
    from app.services import agent_programs

    monkeypatch.setattr(agent_programs, "find", lambda kind: None)


def test_status_reports_missing_programs_with_their_install_line(client, no_programs):
    agents = client.get("/api/claude-code/status").json()["agents"]
    assert set(agents) == {"codex", "cursor"}
    assert agents["codex"]["installed"] is False and agents["codex"]["install"]
    assert agents["cursor"]["installed"] is False and agents["cursor"]["install"]


def test_status_finds_programs_on_the_path(client, stand_ins):
    agents = client.get("/api/claude-code/status").json()["agents"]
    assert agents["codex"]["installed"] and agents["codex"]["path"] == str(stand_ins / "codex") and agents["codex"]["install"] == ""
    assert agents["cursor"]["installed"] and agents["cursor"]["path"] == str(stand_ins / "cursor-agent")


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="reads the child's environment from /proc")
def test_a_program_tab_carries_its_token_in_the_environment_until_it_closes(client, stand_ins):
    from app.services import agent_programs, agents, terminal

    tab = client.post("/api/terminal/agent", json={"kind": "codex", "cols": 80, "rows": 24}).json()
    try:
        assert tab["kind"] == "codex" and tab["title"] == "Codex"
        session = terminal.get(tab["id"])
        token = session.env[agent_programs.TOKEN_VAR]
        config = session.env[agent_programs.CONFIG_VAR]
        assert agents.is_inapp(token) and os.path.exists(config)
        assert token not in " ".join(session.argv)
        pid = session.proc.pid
        deadline = time.time() + 5
        seen = b""
        while time.time() < deadline and b"FORMTOOLS_INAPP_TOKEN" not in seen:
            try:
                seen = open(f"/proc/{pid}/environ", "rb").read()
            except OSError:
                pass
            time.sleep(0.1)
        assert f"FORMTOOLS_INAPP_TOKEN={token}".encode() in seen
        assert token.encode() not in open(f"/proc/{pid}/cmdline", "rb").read()
    finally:
        client.delete(f"/api/terminal/{tab['id']}")
    assert not agents.is_inapp(token)
    assert not os.path.exists(config)


def test_a_missing_program_is_404_and_another_kind_is_refused(client, no_programs):
    missing = client.post("/api/terminal/agent", json={"kind": "cursor"})
    assert missing.status_code == 404 and "not installed" in missing.json()["error"]
    assert client.post("/api/terminal/agent", json={"kind": "vim"}).status_code == 400


def test_the_program_route_needs_the_window_key(bare):
    r = bare.post("/api/terminal/agent", json={"kind": "codex"})
    assert r.status_code == 403


def test_the_port_reaches_the_tab(client, stand_ins):
    from app.services import terminal

    tab = client.post("/api/terminal/agent", json={"kind": "cursor"}).json()
    try:
        assert terminal.get(tab["id"]).env["FORMTOOLS_MCP_URL"] == f"http://127.0.0.1:{PORT}/mcp"
    finally:
        client.delete(f"/api/terminal/{tab['id']}")


def test_a_tab_entry_is_named_formtools_tab_and_a_closed_tab_token_is_an_outside_caller(client, stand_ins, monkeypatch):
    import json

    from app.services import agent_programs, agents, consent, terminal

    monkeypatch.setattr(consent, "access", lambda: "ask")
    call = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "run_command", "arguments": {"id": "go-home"}}}

    def said(token):
        return client.post("/mcp", json=call, headers={agents.INAPP_HEADER: token}).json()["result"]["content"][0]["text"]

    tab = client.post("/api/terminal/agent", json={"kind": "codex", "cols": 80, "rows": 24}).json()
    try:
        session = terminal.get(tab["id"])
        token = session.env[agent_programs.TOKEN_VAR]
        with open(session.env[agent_programs.CONFIG_VAR], encoding="utf-8") as handle:
            assert list(json.load(handle)["mcpServers"]) == ["formtools_tab"]
        assert said(token) != consent.NO_WINDOW
    finally:
        client.delete(f"/api/terminal/{tab['id']}")
    assert said(token) == consent.NO_WINDOW


ANSWERS = {
    "claude": 'case "$*" in "--version") echo "9.8.7 (Claude Code)";; "auth status") echo \'{"loggedIn": true}\';; esac',
    "codex": 'case "$*" in "--version") echo "codex-cli 0.55.1";; "login status") echo "Not logged in"; exit 1;; esac',
    "cursor-agent": 'case "$*" in "--version") echo "2026.11.02-abc123";; "status") echo "Logged in as someone@example.com";; esac',
}


@pytest.fixture
def answering(tmp_path, monkeypatch):
    from app.services import agent_programs, claude_code

    folder = tmp_path / "answering"
    folder.mkdir()
    for name, body in ANSWERS.items():
        script = folder / name
        script.write_text(f"#!/bin/sh\n{body}\n", encoding="utf-8")
        script.chmod(script.stat().st_mode | stat.S_IXUSR)
    monkeypatch.setenv("PATH", str(folder) + os.pathsep + os.environ.get("PATH", ""))
    monkeypatch.setenv("FORMTOOLS_CLAUDE_BIN", str(folder / "claude"))
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.setitem(agent_programs._cache, "value", None)
    monkeypatch.setitem(claude_code._cache, "value", None)
    return folder


@pytest.mark.skipif(os.name == "nt", reason="the stand-in programs are shell scripts")
def test_one_call_reports_the_three_programs_with_version_and_sign_in(client, answering):
    found = client.get("/api/agents/status", params={"fresh": "true"}).json()
    assert set(found) == {"claude", "codex", "cursor"}
    assert (found["claude"]["installed"], found["claude"]["version"], found["claude"]["signedIn"]) == (True, "9.8.7", True)
    assert (found["codex"]["installed"], found["codex"]["version"], found["codex"]["signedIn"]) == (True, "0.55.1", False)
    assert (found["cursor"]["installed"], found["cursor"]["version"], found["cursor"]["signedIn"]) == (True, "2026.11.02-abc123", True)
    assert all(found[kind]["install"] and found[kind]["title"] for kind in found)


def test_one_call_reports_missing_programs_with_their_install_lines(client, no_programs, monkeypatch):
    from app.services import agent_programs, claude_code

    monkeypatch.setattr(claude_code, "cli", lambda: None)
    monkeypatch.setitem(agent_programs._cache, "value", None)
    monkeypatch.setitem(claude_code._cache, "value", None)
    found = client.get("/api/agents/status", params={"fresh": "true"}).json()
    for kind in ("claude", "codex", "cursor"):
        assert found[kind]["installed"] is False and found[kind]["version"] is None and found[kind]["signedIn"] is None
        assert found[kind]["install"]


def test_the_status_call_needs_the_window_key(bare):
    assert bare.get("/api/agents/status").status_code == 403
