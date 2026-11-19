import json
import os
import re
import stat
import subprocess
import sys

import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import BACKEND, PORT, window_headers

READS = {"GET", "HEAD", "OPTIONS"}
OPEN = {("POST", "/mcp"), ("POST", "/api/window/key")}
LOOPBACK = {"host": "127.0.0.1:80"}
REFUSED = {"ok": False, "error": "Only the formtools window can do this"}
WRONG = {"x-formtools-window-key": "x" * 43}
DOCK_READS = ["/api/terminal", "/api/agent/claude/status", "/api/claude-code/status"]


def write_operations(app):
    return [(m.upper(), path) for path, item in app.openapi()["paths"].items() for m in item if m.upper() not in READS]


def test_the_open_list_is_short_and_named():
    from app.core import window_key

    assert set(window_key.OPEN) == {"/mcp", "/api/window/key"}


def test_every_write_route_needs_the_window_key(app, bare):
    ops = write_operations(app)
    assert len(ops) > 40
    answered = []
    for method, path in ops:
        if (method, path) in OPEN:
            continue
        url = re.sub(r"\{[^}]+\}", "x", path)
        for headers in ({}, WRONG):
            r = bare.request(method, url, json={}, headers=headers)
            if r.status_code != 403 or r.json() != REFUSED:
                answered.append(f"{method} {path} {r.status_code}")
    assert not answered, "write routes that answer without the window key (they need it, or belong on window_key.OPEN with a named caller): " + ", ".join(answered)


@pytest.mark.parametrize("path", DOCK_READS)
def test_dock_reads_refuse_without_the_key(bare, path):
    for headers in ({}, WRONG):
        assert bare.get(path, headers=headers).status_code == 403


@pytest.mark.parametrize("path", DOCK_READS)
def test_dock_reads_work_with_the_key(client, path):
    assert client.get(path).status_code == 200


def test_the_mcp_endpoint_stays_open_to_outside_agents(bare):
    r = bare.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}})
    assert r.status_code == 200 and r.json()["result"] == {}


def test_a_write_with_the_key_reaches_the_route(client):
    r = client.post("/api/terminal", json={"cols": 80, "rows": 24})
    assert r.status_code == 200
    client.delete(f"/api/terminal/{r.json()['id']}")


def test_bootstrap_answers_once_then_refuses(client, monkeypatch):
    from app.core import window_key

    monkeypatch.setitem(window_key.STATE, "claimed", False)
    monkeypatch.setitem(window_key.STATE, "secondClaim", False)
    first = client.post("/api/window/key")
    assert first.status_code == 200 and first.json()["key"] == window_key.KEY
    assert client.post("/api/window/key").status_code == 409
    assert client.get("/api/capabilities").json()["secondWindowClaim"] is True


def test_bootstrap_does_not_exist_when_the_shell_reads_the_key(client, monkeypatch):
    from app.core import window_key

    monkeypatch.setenv(window_key.STDOUT_ENV, "1")
    monkeypatch.setitem(window_key.STATE, "claimed", False)
    assert client.post("/api/window/key").status_code == 404


def test_live_client_without_the_key_is_not_a_window(client):
    from app.services import bridge

    before = bridge.connected()
    with pytest.raises(WebSocketDisconnect) as refused:
        with client.websocket_connect("/api/live", headers=LOOPBACK) as ws:
            ws.send_json({"t": "hello", "key": "y" * 43})
            ws.receive_json()
    assert refused.value.code == 4403
    assert bridge.connected() == before
    with client.websocket_connect("/api/live", headers=LOOPBACK) as ws:
        ws.send_json({"t": "hello", "key": window_headers()["x-formtools-window-key"]})
        ws.send_json({"t": "ping"})
        assert bridge.connected()


def test_terminal_socket_without_the_key_cannot_drive_the_shell(client):
    term = client.post("/api/terminal", json={"cols": 80, "rows": 24}).json()
    try:
        with pytest.raises(WebSocketDisconnect) as refused:
            with client.websocket_connect(f"/api/terminal/{term['id']}/stream", headers=LOOPBACK) as ws:
                ws.send_json({"type": "key", "key": "y" * 43})
                ws.send_json({"type": "input", "data": "true\r"})
                ws.receive_text()
        assert refused.value.code == 4403
        with client.websocket_connect(f"/api/terminal/{term['id']}/stream", headers=LOOPBACK) as ws:
            ws.send_json({"type": "key", "key": window_headers()["x-formtools-window-key"]})
            ws.send_json({"type": "input", "data": "echo key-ok\r"})
            seen = ""
            while "key-ok" not in seen:
                seen += ws.receive_text()
    finally:
        client.delete(f"/api/terminal/{term['id']}")


def test_chat_socket_without_the_key_is_closed(client):
    with pytest.raises(WebSocketDisconnect) as refused:
        with client.websocket_connect("/api/agent/claude/stream", headers=LOOPBACK) as ws:
            ws.send_json({"type": "key", "key": "y" * 43})
            ws.receive_text()
    assert refused.value.code == 4403


def test_each_tab_gets_its_own_token_in_a_private_file_until_revoked():
    from app.services import agents

    first, first_file = agents.issue(PORT)
    second, second_file = agents.issue(PORT)
    try:
        assert first != second and first_file != second_file
        assert agents.is_inapp(first) and agents.is_inapp(second)
        if os.name != "nt":
            assert stat.S_IMODE(os.stat(first_file).st_mode) == 0o600
        assert json.loads(open(first_file, encoding="utf-8").read())["mcpServers"]["formtools_tab"]["headers"]["x-formtools-inapp"] == first
        agents.revoke(first)
        assert not os.path.exists(first_file)
        assert not agents.is_inapp(first)
        assert agents.is_inapp(second)
    finally:
        agents.revoke(first)
        agents.revoke(second)


def test_engine_prints_the_key_line_once_before_its_address(tmp_path):
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMTOOLS_")}
    env.update(FORMTOOLS_DATA_DIR=str(tmp_path), FORMTOOLS_PORT="0", FORMTOOLS_WINDOW_KEY_STDOUT="1", PYTHONUNBUFFERED="1")
    proc = subprocess.Popen([sys.executable, "formtools_engine.py"], cwd=BACKEND, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = []
    try:
        while not any("http://127.0.0.1:" in line for line in lines):
            line = proc.stdout.readline()
            assert line, "\n".join(lines)
            lines.append(line)
    finally:
        proc.terminate()
        proc.wait(timeout=10)
    keyed = [i for i, line in enumerate(lines) if line.startswith("formtools-window-key: ")]
    assert len(keyed) == 1
    assert keyed[0] < len(lines) - 1
    assert len(lines[keyed[0]].split(": ", 1)[1].strip()) >= 32


def test_engine_started_from_source_prints_no_key(tmp_path):
    env = {k: v for k, v in os.environ.items() if not k.startswith("FORMTOOLS_")}
    env.update(FORMTOOLS_DATA_DIR=str(tmp_path), FORMTOOLS_PORT="0", PYTHONUNBUFFERED="1")
    proc = subprocess.Popen([sys.executable, "formtools_engine.py"], cwd=BACKEND, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    lines = []
    try:
        while not any("http://127.0.0.1:" in line for line in lines):
            line = proc.stdout.readline()
            assert line, "\n".join(lines)
            lines.append(line)
    finally:
        proc.terminate()
        proc.wait(timeout=10)
    assert not any("window-key" in line for line in lines)
