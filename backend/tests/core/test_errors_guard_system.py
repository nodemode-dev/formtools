import pytest

from conftest import ORIGIN, PORT

from .support import REFUSAL_TEXT, app_version


def test_unknown_address_is_answered_as_a_sentence_in_the_error_shape(client):
    reply = client.get("/api/no-such-route-here")
    assert (reply.status_code, reply.json()) == (404, {"ok": False, "error": "nothing is served at that address"})


def test_missing_query_value_names_the_field_in_the_sentence(client):
    reply = client.get("/api/fs/list")
    assert (reply.status_code, reply.json()) == (400, {"ok": False, "error": "the request is missing or has a bad value for path"})


def test_query_value_of_the_wrong_type_names_the_field(client, tmp_path):
    reply = client.get("/api/fs/list", params={"path": str(tmp_path), "hidden": "lots"})
    assert (reply.status_code, reply.json()["error"]) == (400, "the request is missing or has a bad value for hidden")


def test_health_names_the_app_and_its_own_version(client):
    assert client.get("/api/health").json() == {"ok": True, "app": "formtools", "version": app_version()}


def test_capabilities_report_the_same_version_as_health(client):
    caps = client.get("/api/capabilities").json()
    assert caps["version"] == client.get("/api/health").json()["version"]
    assert caps["os"] == {"linux": "linux", "darwin": "macos", "win32": "windows"}[__import__("sys").platform]


def test_capabilities_formats_hold_each_media_family_once(client):
    formats = client.get("/api/capabilities").json()["formats"]
    assert set(formats) == {"image", "video", "audio", "model", "text"}
    for kind in ("video", "audio", "model", "text"):
        assert len(formats[kind]) == len(set(formats[kind]))
    for key in ("native", "engine"):
        assert len(formats["image"][key]) == len(set(formats["image"][key]))


def test_engine_refuses_a_request_addressed_to_a_foreign_host(bare):
    reply = bare.get("/api/health", headers={"host": "evil.example"})
    assert (reply.status_code, reply.json()) == (403, {"ok": False, "error": REFUSAL_TEXT})


def test_engine_refuses_its_own_name_on_another_port(bare):
    reply = bare.get("/api/health", headers={"host": f"127.0.0.1:{PORT + 1}"})
    assert reply.status_code == 403 and reply.json()["error"] == REFUSAL_TEXT


@pytest.mark.parametrize("origin", ["http://evil.example", "https://127.0.0.1:5240", "http://127.0.0.1:5999", "null", "http://192.168.1.2:5240"])
def test_engine_refuses_pages_from_other_origins(bare, origin):
    reply = bare.get("/api/health", headers={"origin": origin})
    assert reply.status_code == 403 and reply.json()["error"] == REFUSAL_TEXT


@pytest.mark.parametrize("origin", ["http://127.0.0.1:5240", "http://localhost:5241", ORIGIN, f"http://localhost:{PORT}"])
def test_engine_answers_its_own_window_origins(bare, origin):
    reply = bare.get("/api/health", headers={"origin": origin})
    assert reply.status_code == 200 and reply.json()["ok"] is True


def test_localhost_name_is_accepted_as_the_host(bare):
    assert bare.get("/api/health", headers={"host": f"localhost:{PORT}"}).json()["ok"] is True


@pytest.mark.parametrize(
    "host,port,allowed",
    [("127.0.0.1:8240", 8240, True), ("LOCALHOST:8240", 8240, True), ("127.0.0.1", 8240, False), ("127.0.0.1:8240", None, False), ("127.0.0.2:8240", 8240, False), ("127.0.0.1:x", 8240, False)],
)
def test_host_rule_needs_a_loopback_name_and_the_listening_port(host, port, allowed):
    from app.core import guard

    assert guard.host_allowed(host, port) is allowed


def test_write_route_without_the_window_key_is_refused_with_a_sentence(bare):
    reply = bare.post("/api/jobs/j1/cancel")
    assert (reply.status_code, reply.json()) == (403, {"ok": False, "error": "Only the formtools window can do this"})


def test_write_route_with_a_wrong_window_key_is_refused(bare):
    from app.core import window_key

    reply = bare.post("/api/jobs/j1/cancel", headers={window_key.HEADER: window_key.KEY + "x"})
    assert reply.status_code == 403 and reply.json()["error"] == "Only the formtools window can do this"
