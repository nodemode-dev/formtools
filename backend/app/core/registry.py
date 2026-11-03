import importlib
import logging
import pkgutil
from dataclasses import dataclass, field
from typing import Any, Callable

from fastapi import APIRouter

log = logging.getLogger("formtools.registry")

FORMAT_KINDS = ("image", "video", "audio", "model", "text")


@dataclass(frozen=True)
class Command:
    id: str
    title: str
    description: str
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class McpTool:
    name: str
    description: str
    schema: dict[str, Any]
    handler: Callable[[dict[str, Any]], Any]


@dataclass
class Tool:
    id: str
    title: str
    routers: tuple[APIRouter, ...] = ()
    formats: Callable[[], dict[str, Any]] = lambda: {}
    commands: tuple[Command, ...] = ()
    mcp: tuple[McpTool, ...] = ()
    startup: Callable[[], None] | None = None
    shutdown: Callable[[], None] | None = None


_tools: dict[str, Tool] = {}
_failed: dict[str, str] = {}
_loaded = False


def register(tool: Tool) -> Tool:
    if tool.id in _tools:
        raise ValueError(f"tool {tool.id} is already registered")
    _tools[tool.id] = tool
    return tool


def discover() -> None:
    global _loaded
    if _loaded:
        return
    _loaded = True
    from app import tools as package

    for info in sorted(pkgutil.iter_modules(package.__path__), key=lambda item: item.name):
        if info.name.startswith("_"):
            continue
        name = f"{package.__name__}.{info.name}"
        try:
            importlib.import_module(name)
        except Exception as exc:
            _failed[info.name] = f"{type(exc).__name__}: {exc}"
            log.exception("tool module %s failed to load", name)


def tools() -> list[Tool]:
    return list(_tools.values())


def failed() -> dict[str, str]:
    return dict(_failed)


def routers() -> list[APIRouter]:
    return [router for tool in _tools.values() for router in tool.routers]


def commands() -> list[Command]:
    return [command for tool in _tools.values() for command in tool.commands]


def command(command_id: str) -> Command | None:
    for item in commands():
        if item.id == command_id:
            return item
    return None


def mcp_tools() -> list[McpTool]:
    return [item for tool in _tools.values() for item in tool.mcp]


def formats() -> dict[str, Any]:
    merged: dict[str, Any] = {"image": {"native": [], "engine": []}, "video": [], "audio": [], "model": [], "text": []}
    for tool in _tools.values():
        for kind, value in tool.formats().items():
            if kind not in merged:
                continue
            if isinstance(merged[kind], dict):
                for key in ("native", "engine"):
                    for ext in value.get(key, []):
                        if ext not in merged[kind][key]:
                            merged[kind][key].append(ext)
            else:
                for ext in value:
                    if ext not in merged[kind]:
                        merged[kind].append(ext)
    return merged


def startup() -> None:
    for tool in _tools.values():
        if tool.startup:
            try:
                tool.startup()
            except Exception:
                log.exception("tool %s startup failed", tool.id)


def shutdown() -> None:
    for tool in _tools.values():
        if tool.shutdown:
            try:
                tool.shutdown()
            except Exception:
                log.exception("tool %s shutdown failed", tool.id)
