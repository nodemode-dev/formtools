import threading

import pytest


from .support import as_json, call

LOCAL = {"host": "127.0.0.1:80"}
CATALOGUE = [
    {"id": "view.zoom-in", "label": "Zoom in", "group": "View", "description": "Make the picture larger", "keys": ["+"], "secret": "x"},
    {"id": "view.zoom-out", "label": "Zoom out", "group": "View"},
    {"id": "terminal-new", "label": "New terminal"},
    {"label": "no id"},
    "junk",
]


@pytest.fixture
def mirrored(client):
    from app.services import bridge

    kept = bridge.catalogue()
    reply = client.post("/api/commands/catalogue", json={"commands": [c for c in CATALOGUE if isinstance(c, dict)]}).json()
    yield reply
    bridge.mirror(kept)


@pytest.fixture
def window(client):
    from app.core import window_key

    with client.websocket_connect("/api/live", headers=LOCAL) as ws:
        ws.send_json({"t": "hello", "key": window_key.KEY})
        deadline = threading.Event()
        for _ in range(100):
            if client.get("/api/mcp/status").json()["window"]:
                break
            deadline.wait(0.02)
        yield ws


def run_in_background(client, tab, command, params=None):
    box = {}

    def work():
        box["out"] = call(client, "run_command", {"id": command, **({"params": params} if params is not None else {})}, tab)

    thread = threading.Thread(target=work)
    thread.start()
    return thread, box


def test_the_mirrored_catalogue_keeps_only_entries_with_an_id(mirrored):
    assert mirrored == {"ok": True, "size": 3}


def test_list_commands_shows_window_commands_but_not_the_ones_only_a_person_runs(client, mirrored):
    listing = as_json(call(client, "list_commands")[1])
    ids = [c["id"] for c in listing["commands"]]
    assert "view.zoom-in" in ids and "view.zoom-out" in ids
    assert "terminal-new" not in ids
    assert "hint" not in listing
    zoom = next(c for c in listing["commands"] if c["id"] == "view.zoom-in")
    assert zoom == {"id": "view.zoom-in", "title": "Zoom in", "description": "Make the picture larger"}


def test_describe_command_gives_the_window_command_its_group_and_keys_and_drops_unknown_fields(client, mirrored):
    described = as_json(call(client, "describe_command", {"id": "view.zoom-in"})[1])
    assert described["group"] == "View" and described["keys"] == ["+"]
    assert "secret" not in described


def test_describe_command_will_not_describe_a_command_only_a_person_runs(client, mirrored):
    failed, text = call(client, "describe_command", {"id": "terminal-new"})
    assert failed is True and "list_commands" in text


@pytest.mark.parametrize("command", ["terminal-toggle", "terminal-new", "claude-code", "claude-chat"])
def test_run_command_refuses_a_command_only_a_person_runs_and_names_it(client, tab, window, command):
    failed, text = call(client, "run_command", {"id": command}, tab)
    assert failed is True
    assert command in text and "person" in text


def test_run_command_refuses_an_id_the_window_does_not_have(client, tab, mirrored):
    failed, text = call(client, "run_command", {"id": "view.fly"}, tab)
    assert failed is True and "list_commands" in text


def test_run_command_with_no_window_says_to_open_formtools(client, tab, mirrored):
    assert client.get("/api/mcp/status").json()["window"] is False
    failed, text = call(client, "run_command", {"id": "view.zoom-in"}, tab)
    assert failed is True
    assert "No formtools window is open" in text


def test_the_status_says_a_window_is_connected_only_while_it_is(client):
    from app.core import window_key

    assert client.get("/api/mcp/status").json()["window"] is False
    with client.websocket_connect("/api/live", headers=LOCAL) as ws:
        ws.send_json({"t": "hello", "key": window_key.KEY})
        seen = False
        for _ in range(100):
            seen = client.get("/api/mcp/status").json()["window"]
            if seen:
                break
            threading.Event().wait(0.02)
        assert seen is True
    for _ in range(100):
        if not client.get("/api/mcp/status").json()["window"]:
            break
        threading.Event().wait(0.02)
    assert client.get("/api/mcp/status").json()["window"] is False


def test_a_socket_without_the_window_key_is_closed_and_never_counts_as_a_window(client):
    from starlette.websockets import WebSocketDisconnect

    with client.websocket_connect("/api/live", headers=LOCAL) as ws:
        ws.send_json({"t": "hello", "key": "not-the-key"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_json()
    assert closed.value.code == 4403
    assert client.get("/api/mcp/status").json()["window"] is False


def test_run_command_reaches_the_window_with_its_params_and_returns_the_windows_answer(client, tab, window, mirrored):
    thread, box = run_in_background(client, tab, "view.zoom-in", {"steps": 2})
    event = window.receive_json()
    assert event["t"] == "run" and event["command"] == "view.zoom-in" and event["params"] == {"steps": 2}
    window.send_json({"t": "result", "id": event["id"], "ok": True, "result": {"zoom": 4}})
    thread.join(5)
    assert box["out"] == (False, '{"zoom": 4}')


def test_run_events_arrive_in_the_order_they_were_asked_each_with_its_own_id(client, tab, window, mirrored):
    seen = []
    for step in range(4):
        thread, box = run_in_background(client, tab, "view.zoom-out", {"n": step})
        event = window.receive_json()
        seen.append(event)
        window.send_json({"t": "result", "id": event["id"], "ok": True, "result": step * 10})
        thread.join(5)
        assert box["out"] == (False, str(step * 10))
    assert [e["params"]["n"] for e in seen] == [0, 1, 2, 3]
    assert len({e["id"] for e in seen}) == 4


def test_an_answer_for_another_id_is_ignored_and_the_right_one_completes_the_call(client, tab, window, mirrored):
    thread, box = run_in_background(client, tab, "view.zoom-in")
    event = window.receive_json()
    window.send_json({"t": "result", "id": "r-not-this-one", "ok": True, "result": "wrong"})
    window.send_json({"t": "result", "id": event["id"], "ok": True, "result": "right"})
    thread.join(5)
    assert box["out"] == (False, "right")


def test_a_command_the_window_fails_comes_back_as_a_tool_error_with_the_windows_words(client, tab, window, mirrored):
    thread, box = run_in_background(client, tab, "view.zoom-in")
    event = window.receive_json()
    window.send_json({"t": "result", "id": event["id"], "ok": False, "error": "Open a picture first."})
    thread.join(5)
    assert box["out"] == (True, "Open a picture first.")


def test_params_that_are_not_an_object_reach_the_window_as_an_empty_object(client, tab, window, mirrored):
    box = {}
    thread = threading.Thread(target=lambda: box.update(out=call(client, "run_command", {"id": "view.zoom-in", "params": [1, 2]}, tab)))
    thread.start()
    event = window.receive_json()
    assert event["params"] == {}
    window.send_json({"t": "result", "id": event["id"], "ok": True, "result": None})
    thread.join(5)
    assert box["out"] == (False, "null")


def test_only_the_window_key_holder_can_replace_the_catalogue(bare, client, mirrored):
    response = bare.post("/api/commands/catalogue", json={"commands": []})
    assert response.status_code == 403
    assert "window" in response.json()["error"]
    assert "view.zoom-in" in [c["id"] for c in as_json(call(client, "list_commands")[1])["commands"]]
