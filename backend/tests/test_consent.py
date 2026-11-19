import json
import sys
import threading
import time
import types

import pytest

CALL = {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "trash_files", "arguments": {"paths": []}}}
READ = {"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "fs_list", "arguments": {"path": "/"}}}


class FakeKeyring(types.ModuleType):
    def __init__(self):
        super().__init__("keyring")
        self.store = {}

    def get_password(self, service, account):
        return self.store.get((service, account))

    def set_password(self, service, account, value):
        self.store[(service, account)] = value


class NoKeychain(types.ModuleType):
    def __init__(self):
        super().__init__("keyring")

    def get_password(self, service, account):
        raise RuntimeError("no keychain backend")

    set_password = get_password


@pytest.fixture
def keychain(monkeypatch):
    from app.core import seal

    fake = FakeKeyring()
    monkeypatch.setitem(sys.modules, "keyring", fake)
    seal.reset()
    yield fake
    seal.reset()


@pytest.fixture
def nokeychain(monkeypatch):
    from app.core import seal

    monkeypatch.setitem(sys.modules, "keyring", NoKeychain())
    seal.reset()
    yield
    seal.reset()


@pytest.fixture(autouse=True)
def clean(app, monkeypatch):
    from app.core import config
    from app.services import consent

    path = config.data_dir() / consent.FILE
    path.unlink(missing_ok=True)
    monkeypatch.setattr(consent, "WAIT", 5.0)
    yield
    path.unlink(missing_ok=True)


@pytest.fixture
def window(monkeypatch):
    from app.services import bridge

    monkeypatch.setattr(bridge, "connected", lambda: True)


def result(reply):
    return reply["result"]["isError"], reply["result"]["content"][0]["text"]


def dispatch(message, token=None):
    from app.routers import mcp

    return mcp.dispatch(message, token)


def answer_when_asked(choice):
    from app.services import consent

    seen = []

    def run():
        end = time.monotonic() + 4
        while time.monotonic() < end:
            asked = consent.pending()
            if asked:
                seen.append(asked[0])
                consent.answer(asked[0]["id"], choice)
                return
            time.sleep(0.02)

    thread = threading.Thread(target=run)
    thread.start()
    return thread, seen


def test_the_default_is_ask(keychain):
    from app.services import consent

    assert consent.state()["access"] == "ask"


def test_ask_with_no_window_refuses_at_once_and_reads_still_work(keychain):
    from app.services import consent

    began = time.monotonic()
    error, text = result(dispatch(CALL))
    assert error and text == consent.NO_WINDOW
    assert time.monotonic() - began < 1
    assert result(dispatch(READ))[0] is False


@pytest.mark.parametrize("choice,refused", [("deny", True), ("once", False), ("always", False)])
def test_ask_waits_for_the_window(keychain, window, choice, refused):
    from app.services import consent

    thread, seen = answer_when_asked(choice)
    error, text = result(dispatch(CALL))
    thread.join()
    assert error is refused
    assert seen and seen[0]["tool"] == "trash_files" and seen[0]["effect"] == "alters"
    assert (text == consent.DENIED) if refused else ("trashed" in text)
    assert consent.access() == ("allowed" if choice == "always" else "ask")
    assert consent.pending() == []


def test_always_allow_is_kept_sealed_and_then_nothing_asks(keychain, window):
    from app.services import consent

    thread, _ = answer_when_asked("always")
    dispatch(CALL)
    thread.join()
    assert consent.state()["seal"] == "ok"
    assert result(dispatch(CALL))[0] is False


def test_blocked_refuses_every_tool_that_is_not_read_only(keychain):
    from app.services import consent

    consent.set_access("blocked")
    error, text = result(dispatch(CALL))
    assert error and text == consent.BLOCKED
    assert result(dispatch(READ))[0] is False


def test_nobody_answering_refuses_after_the_wait(keychain, window, monkeypatch):
    from app.services import consent

    monkeypatch.setattr(consent, "WAIT", 0.4)
    error, text = result(dispatch(CALL))
    assert error and text == consent.TIMED_OUT
    assert consent.pending() == []


def test_a_window_that_goes_away_while_asking_refuses(keychain, monkeypatch):
    from app.services import bridge, consent

    state = {"open": True}
    monkeypatch.setattr(bridge, "connected", lambda: state["open"])
    threading.Timer(0.3, lambda: state.update(open=False)).start()
    error, text = result(dispatch(CALL))
    assert error and text == consent.NO_WINDOW


def test_the_agents_inside_formtools_are_not_asked(keychain):
    from app.services import agents

    token, path = agents.issue(8240)
    try:
        assert result(dispatch(CALL, token))[0] is False
        assert result(dispatch(CALL, "x" * 43))[0] is True
    finally:
        agents.revoke(token)


def test_blocked_stops_a_tab_of_the_app_too_and_its_reads_still_work(keychain):
    from app.services import agents, consent

    token, path = agents.issue(8240)
    try:
        consent.set_access("blocked")
        error, text = result(dispatch(CALL, token))
        assert error and text == consent.BLOCKED_INSIDE
        assert result(dispatch(READ, token))[0] is False
        consent.set_access("allowed")
        assert result(dispatch(CALL, token))[0] is False
    finally:
        agents.revoke(token)


def test_the_chat_shows_no_card_for_a_tool_that_blocked_refuses(keychain, monkeypatch):
    from app.services import claude_code, consent

    sent, shown = [], []
    monkeypatch.setattr(claude_code, "_write", lambda obj: sent.append(obj) or True)
    monkeypatch.setattr(claude_code, "publish", lambda msg, keep=True: shown.append(msg))
    monkeypatch.setattr(claude_code.AGENT, "mode", "ask")
    consent.set_access("blocked")
    claude_code._decide("r1", {"tool_name": "mcp__formtools__trash_files", "input": {}}, claude_code.AGENT.gen)
    assert sent[0]["response"]["response"] == {"behavior": "deny", "message": consent.BLOCKED_INSIDE}
    assert shown == []


def test_a_request_says_who_asks_for_what_and_until_when(keychain, window):
    from app.routers import mcp
    from app.services import agents, consent

    thread, seen = answer_when_asked("once")
    assert result(mcp.dispatch(CALL, None, agents.open_session("probe-agent")))[0] is False
    thread.join()
    asked = seen[0]
    assert asked["agent"] == "probe-agent" and asked["agentNamed"] is True and asked["what"] == "run trash_files"
    assert asked["answers"] == ["deny", "once", "always"] and asked["alwaysScope"] == "all"
    assert asked["expires"] == pytest.approx(asked["at"] + consent.WAIT)
    thread, seen = answer_when_asked("deny")
    named = {"name": "run_command", "arguments": {"id": "rename-apply"}, "_meta": {"io.modelcontextprotocol/clientInfo": {"name": "the formtools command line"}}}
    assert result(mcp.dispatch({**CALL, "params": named}))[0] is True
    thread.join()
    assert seen[0]["agent"] == "the formtools command line" and seen[0]["what"] == "run the command rename-apply"


def test_a_caller_with_no_name_and_a_computer_with_no_keychain(nokeychain, window):
    thread, seen = answer_when_asked("once")
    assert result(dispatch(CALL))[0] is False
    thread.join()
    assert seen[0]["agent"] == "an outside agent" and seen[0]["agentNamed"] is False
    assert seen[0]["answers"] == ["deny", "once"]


def test_initialize_hands_out_a_session_that_names_the_caller(bare, keychain, window):
    hello = {"jsonrpc": "2.0", "id": 0, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "clientInfo": {"name": "Desk Client"}}}
    session = bare.post("/mcp", json=hello).headers["mcp-session-id"]
    thread, seen = answer_when_asked("deny")
    reply = bare.post("/mcp", json=CALL, headers={"Mcp-Session-Id": session}).json()
    thread.join()
    assert result(reply)[0] is True and seen[0]["agent"] == "Desk Client"
    assert "mcp-session-id" not in bare.post("/mcp", json=READ).headers


@pytest.mark.parametrize("choice,wait,reason", [("once", 5.0, "answered"), (None, 0.4, "expired")])
def test_every_window_is_told_when_a_request_is_asked_and_when_it_is_over(client, keychain, monkeypatch, choice, wait, reason):
    from app.core import window_key
    from app.services import consent

    monkeypatch.setattr(consent, "WAIT", wait)
    local = {"host": "127.0.0.1:80"}
    with client.websocket_connect("/api/live", headers=local) as first, client.websocket_connect("/api/live", headers=local) as second:
        for ws in (first, second):
            ws.send_json({"t": "hello", "key": window_key.KEY})
        deadline = time.monotonic() + 3
        while not consent.bridge.connected() and time.monotonic() < deadline:
            time.sleep(0.02)
        caller = threading.Thread(target=lambda: client.post("/mcp", json=CALL))
        caller.start()
        asked = [ws.receive_json() for ws in (first, second)]
        assert all(m["t"] == "ask" and m["id"] == asked[0]["id"] and m["request"]["tool"] == "trash_files" for m in asked)
        if choice:
            assert client.post(f"/api/agents/requests/{asked[0]['id']}", json={"answer": choice}).json()["ok"]
        over = [ws.receive_json() for ws in (first, second)]
        caller.join()
        assert all(m == {"t": "answered", "id": asked[0]["id"], "reason": reason, "answer": choice} for m in over)


def test_a_hand_edit_to_allowed_reads_as_ask_and_says_so(keychain):
    from app.core import config
    from app.services import consent

    consent.set_access("ask")
    path = config.data_dir() / consent.FILE
    stored = json.loads(path.read_text(encoding="utf-8"))
    stored["agentAccess"] = "allowed"
    path.write_text(json.dumps(stored), encoding="utf-8")
    state = consent.state()
    assert state["access"] == "ask" and state["seal"] == "broken" and state["sealBroken"] is True
    assert state["notice"] == consent.RESET_NOTICE
    assert result(dispatch(CALL))[1] == consent.NO_WINDOW
    assert consent.set_access("ask")["sealBroken"] is False


def test_a_hand_edit_that_tightens_the_choice_stands(keychain):
    from app.core import config
    from app.services import consent

    consent.set_access("allowed")
    path = config.data_dir() / consent.FILE
    stored = json.loads(path.read_text(encoding="utf-8"))
    stored["agentAccess"] = "blocked"
    path.write_text(json.dumps(stored), encoding="utf-8")
    assert consent.access() == "blocked"


def test_without_a_keychain_the_engine_runs_and_allowed_is_never_honoured(nokeychain, window):
    from app.core import config
    from app.services import consent
    from app.core.errors import ApiError

    state = consent.state()
    assert state["seal"] == "unavailable" and state["access"] == "ask"
    with pytest.raises(ApiError) as refused:
        consent.set_access("allowed")
    assert refused.value.status == 409
    (config.data_dir() / consent.FILE).write_text(json.dumps({"agentAccess": "allowed"}), encoding="utf-8")
    assert consent.access() == "ask"
    thread, _ = answer_when_asked("always")
    error, _text = result(dispatch(CALL))
    thread.join()
    assert error is False and consent.access() == "ask"
    consent.set_access("blocked")
    assert consent.access() == "blocked"


def test_only_the_window_can_read_answer_or_change(client, bare, keychain):
    assert bare.get("/api/agents/requests").status_code == 403
    assert bare.put("/api/agents/access", json={"access": "allowed"}).status_code == 403
    assert bare.post("/api/agents/requests/x", json={"answer": "once"}).status_code == 403
    assert bare.put("/api/agents/access", json={"access": "allowed"}, headers={"x-formtools-window-key": "y" * 43}).status_code == 403
    assert client.get("/api/agents/requests").json()["access"] == "ask"
    assert client.put("/api/agents/access", json={"access": "sometimes"}).status_code == 400
    assert client.put("/api/agents/access", json={"access": "blocked"}).json()["access"] == "blocked"
    assert client.post("/api/agents/requests/x", json={"answer": "once"}).status_code == 404


def test_no_mcp_tool_can_reach_the_choice(app):
    from app.routers import mcp

    assert not [t.name for t in mcp.all_tools() if "access" in t.name or "consent" in t.name]
