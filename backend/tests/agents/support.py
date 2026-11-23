import json
from contextlib import contextmanager

ORDINARY = (-32700, -32600, -32601, -32602, -32603)


def rpc(client, method, params=None, request_id=1, headers=None):
    message = {"jsonrpc": "2.0", "id": request_id, "method": method}
    if params is not None:
        message["params"] = params
    return client.post("/mcp", json=message, headers=headers or {})


def well_formed(reply, request_id):
    assert isinstance(reply, dict)
    assert reply.get("jsonrpc") == "2.0"
    assert reply.get("id") == request_id
    assert ("result" in reply) != ("error" in reply)
    if "error" in reply:
        error = reply["error"]
        assert isinstance(error["code"], int) and not isinstance(error["code"], bool)
        assert isinstance(error["message"], str) and error["message"]
    return reply


def tool_result(reply):
    result = reply["result"]
    assert isinstance(result["isError"], bool)
    assert isinstance(result["content"], list) and result["content"]
    for block in result["content"]:
        assert block["type"] == "text"
        assert isinstance(block["text"], str)
    return result["isError"], result["content"][0]["text"]


def call(client, name, arguments=None, headers=None, request_id=7):
    reply = rpc(client, "tools/call", {"name": name, "arguments": arguments if arguments is not None else {}}, request_id, headers).json()
    return tool_result(well_formed(reply, request_id))


def is_sentence(text):
    words = text.split()
    return len(words) >= 3 and "Traceback" not in text and not text.startswith("the tool failed") and any(ch.isalpha() for ch in text)


@contextmanager
def tab_token():
    from app.services import agents

    token, _ = agents.issue(8240)
    try:
        yield {agents.INAPP_HEADER: token}
    finally:
        agents.revoke(token)


def listed_tools(client):
    return rpc(client, "tools/list").json()["result"]["tools"]


def as_json(text):
    return json.loads(text)
