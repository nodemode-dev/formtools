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
