import importlib.util
import json

import pytest

from conftest import REPO


@pytest.fixture(scope="module")
def agents():
    spec = importlib.util.spec_from_file_location("formtools_setup_agents", REPO / "setup" / "agents.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_the_committed_manifest_is_what_sync_would_write(agents):
    assert agents.manifest_current(), "agents/manifest.json is out of date; run ./formtools agents sync"


def test_check_names_the_manifest_when_it_drifts(agents, monkeypatch):
    monkeypatch.setattr(agents, "manifest_current", lambda: False)
    problems = []
    agents.check_manifest(problems)
    assert problems and "agents/manifest.json" in problems[0]


def test_the_manifest_matches_the_server(app):
    from app.routers import mcp

    manifest = json.loads((REPO / "agents" / "manifest.json").read_text(encoding="utf-8"))
    listed = mcp.dispatch({"jsonrpc": "2.0", "id": 1, "method": "tools/list"})["result"]["tools"]
    assert sorted(manifest["mcp"]["tools"]) == sorted(t["name"] for t in listed)
    assert sorted(manifest["mcp"]["read_only"]) == sorted(t["name"] for t in listed if t["annotations"].get("readOnlyHint"))
    assert set(manifest["mcp"]["approval_gated"]) == set(manifest["mcp"]["tools"]) - set(manifest["mcp"]["read_only"])
    assert (len(manifest["mcp"]["tools"]), len(manifest["mcp"]["read_only"]), len(manifest["mcp"]["approval_gated"])) == (35, 22, 13)
    assert manifest["mcp"]["transports"] == ["stdio", "http"]
    assert manifest["extensions"] is None
