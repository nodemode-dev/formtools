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
