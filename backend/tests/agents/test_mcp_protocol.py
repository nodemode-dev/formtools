import pytest

from .support import ORDINARY, call, is_sentence, listed_tools, rpc, tool_result, well_formed

JSON_TYPES = {"object", "string", "integer", "number", "boolean", "array", "null"}


def test_a_body_that_is_not_json_gets_the_parse_error_code_with_a_null_id(client):
    reply = client.post("/mcp", content=b"{not json", headers={"content-type": "application/json"}).json()
    well_formed(reply, None)
    assert reply["error"]["code"] == -32700


@pytest.mark.parametrize("body", [{"id": 1, "method": "ping"}, {"jsonrpc": "1.0", "id": 1, "method": "ping"}, {"jsonrpc": "2.0", "id": 1, "method": 5}, "ping", 12])
def test_a_message_that_is_not_a_json_rpc_2_request_gets_the_invalid_request_code(client, body):
    reply = client.post("/mcp", json=body).json()
    assert reply["jsonrpc"] == "2.0"
    assert reply["error"]["code"] == -32600
    assert "result" not in reply


def test_an_unknown_method_gets_method_not_found_and_the_same_id_back(client):
    reply = rpc(client, "tools/destroy", request_id="abc-9").json()
    well_formed(reply, "abc-9")
    assert reply["error"]["code"] == -32601


@pytest.mark.parametrize("request_id", [0, 41, "seven", "0"])
def test_the_reply_carries_the_id_with_its_type_unchanged(client, request_id):
    reply = rpc(client, "ping", request_id=request_id).json()
    well_formed(reply, request_id)
    assert type(reply["id"]) is type(request_id)
    assert reply["result"] == {}


def test_a_notification_gets_no_reply_body(client):
    response = client.post("/mcp", json={"jsonrpc": "2.0", "method": "notifications/initialized"})
    assert response.status_code == 202
    assert response.content == b""


def test_a_batch_answers_each_request_once_and_skips_notifications(client):
    batch = [
        {"jsonrpc": "2.0", "id": "a", "method": "ping"},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "nope"},
        {"jsonrpc": "2.0", "id": 3, "method": "tools/list"},
    ]
    replies = client.post("/mcp", json=batch).json()
    assert [r["id"] for r in replies] == ["a", 2, 3]
    for reply, request_id in zip(replies, ["a", 2, 3]):
        well_formed(reply, request_id)
    assert replies[1]["error"]["code"] == -32601
    assert replies[2]["result"]["tools"]


def test_a_batch_of_only_notifications_gets_no_reply_body(client):
    response = client.post("/mcp", json=[{"jsonrpc": "2.0", "method": "notifications/initialized"}])
    assert response.status_code == 202
    assert response.content == b""


def test_a_request_not_sent_as_json_is_refused_with_a_sentence(client):
    response = client.post("/mcp", content=b'{"jsonrpc":"2.0","id":1,"method":"ping"}', headers={"content-type": "text/plain"})
    assert response.status_code == 415
    reply = response.json()
    assert "result" not in reply
    assert "application/json" in reply["error"]["message"]


@pytest.mark.parametrize("version", ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"])
def test_initialize_agrees_to_a_protocol_version_the_endpoint_says_it_speaks(client, version):
    assert version in client.get("/mcp").json()["protocolVersions"]
    reply = rpc(client, "initialize", {"protocolVersion": version, "capabilities": {}, "clientInfo": {"name": "lane-test", "version": "1"}}).json()
    well_formed(reply, 1)
    assert reply["result"]["protocolVersion"] == version


def test_initialize_answers_an_unknown_version_with_one_it_speaks(client):
    reply = rpc(client, "initialize", {"protocolVersion": "1999-01-01", "capabilities": {}, "clientInfo": {"name": "lane-test", "version": "1"}}).json()
    assert reply["result"]["protocolVersion"] in client.get("/mcp").json()["protocolVersions"]
    assert reply["result"]["protocolVersion"] != "1999-01-01"


def test_initialize_names_the_server_and_offers_tools(client):
    response = rpc(client, "initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "lane-test", "version": "1"}})
    result = response.json()["result"]
    described = client.get("/mcp").json()
    assert result["serverInfo"] == {"name": described["name"], "version": described["version"]}
    assert isinstance(result["capabilities"]["tools"], dict)
    assert len(response.headers["mcp-session-id"]) >= 16


def test_two_initialize_calls_get_different_sessions(client):
    params = {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "lane-test", "version": "1"}}
    first = rpc(client, "initialize", params).headers["mcp-session-id"]
    second = rpc(client, "initialize", params).headers["mcp-session-id"]
    assert first != second


def test_ping_gets_no_session_header(client):
    assert "mcp-session-id" not in rpc(client, "ping").headers


def test_a_client_that_initialized_is_counted_in_the_status(client):
    name = "lane-counted-client"
    params = {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": name, "version": "1"}}
    rpc(client, "initialize", params)
    before = next(c for c in client.get("/api/mcp/status").json()["clients"] if c["name"] == name)["calls"]
    rpc(client, "initialize", params)
    after = next(c for c in client.get("/api/mcp/status").json()["clients"] if c["name"] == name)
    assert after["calls"] == before + 1
    assert after["inapp"] is False


def test_every_listed_tool_has_a_unique_name_a_description_and_an_object_schema(client):
    tools = listed_tools(client)
    names = [t["name"] for t in tools]
    assert len(names) == len(set(names)) and len(names) >= 4
    for tool in tools:
        assert tool["name"].replace("_", "").isalnum() and len(tool["name"]) <= 64
        assert isinstance(tool["description"], str) and len(tool["description"].split()) >= 3
        schema = tool["inputSchema"]
        assert schema["type"] == "object"
        properties = schema.get("properties", {})
        assert isinstance(properties, dict)
        assert set(schema.get("required", [])) <= set(properties)
        for spec in properties.values():
            kinds = spec["type"] if isinstance(spec["type"], list) else [spec["type"]]
            assert set(kinds) <= JSON_TYPES


def test_tool_annotations_are_booleans_and_a_read_only_tool_is_never_destructive(client):
    for tool in listed_tools(client):
        notes = tool["annotations"]
        for key in ("readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"):
            if key in notes:
                assert isinstance(notes[key], bool), (tool["name"], key)
        if notes.get("readOnlyHint"):
            assert notes.get("destructiveHint", False) is False, tool["name"]


def test_the_endpoint_description_the_status_count_and_the_listing_name_the_same_tools(client):
    names = [t["name"] for t in listed_tools(client)]
    assert client.get("/mcp").json()["tools"] == names
    assert client.get("/api/mcp/status").json()["tools"] == len(names)


def test_the_status_endpoint_points_at_the_mcp_path_on_this_computer(client):
    status = client.get("/api/mcp/status").json()
    assert status["endpoint"].startswith("http://127.0.0.1:") and status["endpoint"].endswith("/mcp")
    assert status["protocolVersions"] == client.get("/mcp").json()["protocolVersions"]


def test_calling_a_tool_that_is_not_listed_is_an_invalid_params_error_naming_it(client):
    reply = rpc(client, "tools/call", {"name": "format_disk", "arguments": {}}, 5).json()
    well_formed(reply, 5)
    assert reply["error"]["code"] == -32602
    assert reply["error"]["code"] in ORDINARY
    assert "format_disk" in reply["error"]["message"]


def test_every_listed_tool_answers_a_call_with_no_arguments_in_the_tool_result_shape(client, tab, no_catalogue):
    for tool in listed_tools(client):
        failed, text = call(client, tool["name"], {}, tab)
        needs = tool["inputSchema"].get("required", [])
        if needs:
            assert failed is True, tool["name"]
            assert is_sentence(text), (tool["name"], text)
        else:
            assert failed is False, (tool["name"], text)


def test_every_tool_with_required_arguments_refuses_wrong_types_with_a_sentence(client, tab, no_catalogue):
    checked = 0
    for tool in listed_tools(client):
        needs = tool["inputSchema"].get("required", [])
        if not needs:
            continue
        failed, text = call(client, tool["name"], {key: 12345 for key in needs}, tab)
        assert failed is True, tool["name"]
        assert is_sentence(text), (tool["name"], text)
        checked += 1
    assert checked >= 20


def test_arguments_that_are_not_an_object_are_treated_as_missing(client, tab):
    reply = rpc(client, "tools/call", {"name": "fs_list", "arguments": ["/"]}, 3, tab).json()
    failed, text = tool_result(well_formed(reply, 3))
    assert failed is True and is_sentence(text)


def test_a_tool_refusal_is_a_result_and_not_a_protocol_error(client):
    reply = rpc(client, "tools/call", {"name": "fs_list", "arguments": {"path": "relative/folder"}}, 11).json()
    assert "error" not in reply
    assert tool_result(reply) == (True, "the path must be absolute")
