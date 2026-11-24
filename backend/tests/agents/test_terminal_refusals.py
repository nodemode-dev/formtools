import pytest
from starlette.websockets import WebSocketDisconnect

from conftest import window_headers

REFUSED = "Only the formtools window can do this"
ROUTES = [("get", "/api/terminal", None), ("post", "/api/terminal", {}), ("post", "/api/terminal/claude", {}), ("post", "/api/terminal/x/resize", {"cols": 80, "rows": 24}), ("post", "/api/terminal/x/restart", None), ("delete", "/api/terminal/x", None)]


@pytest.fixture
def shell(client):
    opened = client.post("/api/terminal", json={"cols": 90, "rows": 20, "title": "lane"}).json()
    yield opened
    client.delete(f"/api/terminal/{opened['id']}")


@pytest.mark.parametrize("method,path,body", ROUTES)
def test_every_terminal_route_refuses_a_caller_without_the_window_key(bare, client, method, path, body):
    before = client.get("/api/terminal").json()["terminals"]
    response = bare.request(method.upper(), path, json=body)
    assert response.status_code == 403
    assert REFUSED in str(response.json())
    assert client.get("/api/terminal").json()["terminals"] == before


@pytest.mark.parametrize("origin", ["http://example.com", "https://formtools.example", "file://localhost"])
def test_a_page_from_another_origin_cannot_open_a_terminal_even_with_the_key(bare, client, origin):
    before = client.get("/api/terminal").json()["terminals"]
    response = bare.post("/api/terminal", json={}, headers={**window_headers(), "origin": origin})
    assert response.status_code == 403
    assert client.get("/api/terminal").json()["terminals"] == before


def test_a_request_addressed_to_another_host_name_is_refused(bare):
    response = bare.get("/api/terminal", headers={**window_headers(), "host": "evil.example:8240"})
    assert response.status_code >= 400
    assert "terminals" not in response.text


def test_an_opened_terminal_is_listed_until_it_is_closed(client, shell):
    assert shell["id"] in [t["id"] for t in client.get("/api/terminal").json()["terminals"]]
    assert client.delete(f"/api/terminal/{shell['id']}").json() == {"ok": True}
    assert shell["id"] not in [t["id"] for t in client.get("/api/terminal").json()["terminals"]]


@pytest.mark.parametrize("size", [{"cols": 9, "rows": 24}, {"cols": 501, "rows": 24}, {"cols": 80, "rows": 3}, {"cols": 80, "rows": 201}, {"cols": "wide", "rows": 24}])
def test_a_size_outside_the_stated_limits_is_refused(client, shell, size):
    assert client.post(f"/api/terminal/{shell['id']}/resize", json=size).status_code in (400, 422)


def test_a_size_inside_the_limits_is_accepted(client, shell):
    assert client.post(f"/api/terminal/{shell['id']}/resize", json={"cols": 10, "rows": 200}).json() == {"ok": True}


@pytest.mark.parametrize("action", ["resize", "restart"])
def test_acting_on_a_terminal_that_does_not_exist_says_so(client, action):
    response = client.post(f"/api/terminal/no-such-terminal/{action}", json={"cols": 80, "rows": 24})
    assert response.status_code == 404
    assert "no such terminal" in str(response.json())


def test_a_title_longer_than_sixty_characters_is_refused(client):
    before = client.get("/api/terminal").json()["terminals"]
    assert client.post("/api/terminal", json={"title": "t" * 61}).status_code in (400, 422)
    assert client.get("/api/terminal").json()["terminals"] == before


def test_the_stream_closes_a_socket_that_does_not_send_the_window_key(client, shell):
    with client.websocket_connect(f"/api/terminal/{shell['id']}/stream", headers={"host": "127.0.0.1:80"}) as ws:
        ws.send_json({"type": "key", "key": "wrong"})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_text()
    assert closed.value.code == 4403


def test_the_stream_refuses_a_socket_from_another_origin_before_accepting_it(client, shell):
    with pytest.raises(WebSocketDisconnect) as closed:
        with client.websocket_connect(f"/api/terminal/{shell['id']}/stream", headers={"host": "127.0.0.1:80", "origin": "http://example.com"}):
            pass
    assert closed.value.code == 4403


def test_the_stream_for_a_terminal_that_does_not_exist_closes_with_not_found(client):
    from app.core import window_key

    with client.websocket_connect("/api/terminal/no-such-terminal/stream", headers={"host": "127.0.0.1:80"}) as ws:
        ws.send_json({"type": "key", "key": window_key.KEY})
        with pytest.raises(WebSocketDisconnect) as closed:
            ws.receive_text()
    assert closed.value.code == 4404
