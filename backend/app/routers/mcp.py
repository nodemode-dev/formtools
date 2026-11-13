import json
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from app.core import config, registry
from app.core.errors import ApiError
from app.routers import fs

router = APIRouter()

SUPPORTED = ("2025-06-18", "2025-03-26", "2024-11-05")
WINDOW_MESSAGE = "The window runs commands. Open formtools, then ask again."

PATH_SCHEMA = {"type": "object", "properties": {"path": {"type": "string", "description": "Absolute local path"}}, "required": ["path"]}


def text_result(value: Any, error: bool = False) -> dict:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    return {"content": [{"type": "text", "text": text}], "isError": error}


def command_summary(item: registry.Command) -> dict:
    return {"id": item.id, "title": item.title, "description": item.description}


def do_list_commands(_: dict) -> Any:
    return {"commands": [command_summary(item) for item in registry.commands()]}


def do_describe_command(args: dict) -> Any:
    item = registry.command(str(args.get("id", "")))
    if item is None:
        raise ApiError(404, "no command has that id; call list_commands for the ids")
    return {**command_summary(item), "params": item.params}


def do_run_command(args: dict) -> Any:
    if registry.command(str(args.get("id", ""))) is None:
        raise ApiError(404, "no command has that id; call list_commands for the ids")
    raise ApiError(409, WINDOW_MESSAGE)


def do_fs_list(args: dict) -> Any:
    return fs.list_dir(str(args.get("path", "")), bool(args.get("hidden", False)))


def core_tools() -> list[registry.McpTool]:
    return [
        registry.McpTool("list_commands", "List the commands the formtools window can run.", {"type": "object", "properties": {}}, do_list_commands),
        registry.McpTool(
            "describe_command",
            "Describe one command and its parameters.",
            {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]},
            do_describe_command,
        ),
        registry.McpTool(
            "run_command",
            "Run a command in the open formtools window.",
            {"type": "object", "properties": {"id": {"type": "string"}, "params": {"type": "object"}}, "required": ["id"]},
            do_run_command,
        ),
        registry.McpTool(
            "fs_list",
            "List a folder: entries with name, path, kind, ext, size, mtime and type.",
            {"type": "object", "properties": {"path": {"type": "string"}, "hidden": {"type": "boolean"}}, "required": ["path"]},
            do_fs_list,
        ),
    ]


def all_tools() -> list[registry.McpTool]:
    return core_tools() + registry.mcp_tools()


def rpc_error(request_id: Any, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def dispatch(message: Any) -> dict | None:
    if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
        return rpc_error(None, -32600, "invalid request")
    method = message.get("method")
    request_id = message.get("id")
    params = message.get("params") or {}
    if not isinstance(method, str):
        return rpc_error(request_id, -32600, "invalid request")
    if "id" not in message:
        return None
    if method == "initialize":
        asked = params.get("protocolVersion") if isinstance(params, dict) else None
        version = asked if asked in SUPPORTED else SUPPORTED[0]
        result = {
            "protocolVersion": version,
            "capabilities": {"tools": {"listChanged": False}},
            "serverInfo": {"name": config.APP_NAME, "version": config.VERSION},
        }
        return {"jsonrpc": "2.0", "id": request_id, "result": result}
    if method == "ping":
        return {"jsonrpc": "2.0", "id": request_id, "result": {}}
    if method == "tools/list":
        listing = [{"name": item.name, "description": item.description, "inputSchema": item.schema} for item in all_tools()]
        return {"jsonrpc": "2.0", "id": request_id, "result": {"tools": listing}}
    if method == "tools/call":
        name = params.get("name") if isinstance(params, dict) else None
        arguments = params.get("arguments") if isinstance(params, dict) else None
        match = next((item for item in all_tools() if item.name == name), None)
        if match is None:
            return rpc_error(request_id, -32602, f"unknown tool {name}")
        try:
            outcome = text_result(match.handler(arguments if isinstance(arguments, dict) else {}))
        except ApiError as exc:
            outcome = text_result(exc.message, True)
        except Exception as exc:
            outcome = text_result(f"the tool failed: {exc}", True)
        return {"jsonrpc": "2.0", "id": request_id, "result": outcome}
    return rpc_error(request_id, -32601, f"method not found: {method}")


@router.get("/mcp")
def describe_endpoint() -> dict:
    return {"name": config.APP_NAME, "version": config.VERSION, "transport": "http", "protocolVersions": list(SUPPORTED), "tools": [item.name for item in all_tools()]}


@router.post("/mcp")
async def rpc(request: Request) -> Response:
    if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
        return JSONResponse(rpc_error(None, -32600, "send the request as application/json"), status_code=415)
    try:
        body = json.loads((await request.body()) or b"null")
    except ValueError:
        return JSONResponse(rpc_error(None, -32700, "parse error"))
    if isinstance(body, list):
        replies = [reply for reply in await run_in_threadpool(lambda: [dispatch(item) for item in body]) if reply is not None]
        return JSONResponse(replies) if replies else Response(status_code=202)
    reply = await run_in_threadpool(dispatch, body)
    return JSONResponse(reply) if reply is not None else Response(status_code=202)
