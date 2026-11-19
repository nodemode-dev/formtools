import pytest

from app.core import registry


@pytest.fixture(scope="module")
def tools(app):
    from app.routers import mcp

    return mcp.all_tools()


def test_the_server_has_35_tools_in_core_and_nine_packages(app, tools):
    from app.routers import mcp

    assert len(tools) == 35
    assert len(mcp.core_tools()) == 4
    assert len(registry.mcp_tools()) == 31
    assert len([t for t in registry.tools() if t.mcp]) == 9
    assert len({t.name for t in tools}) == 35


def test_a_tool_must_declare_what_it_does_to_files():
    with pytest.raises(TypeError):
        registry.McpTool("x", "x", {}, lambda _: None)
    with pytest.raises(ValueError):
        registry.McpTool("x", "x", {}, lambda _: None, effect="maybe")


def test_the_22_tools_that_only_read_carry_the_read_only_annotation(tools):
    reading = sorted(t.name for t in tools if t.annotations().get("readOnlyHint"))
    assert len(reading) == 22
    assert "trash_files" not in reading and "batch_run" not in reading and "media_copy" not in reading


def test_the_tools_that_can_delete_move_or_overwrite_are_not_pre_approved(tools):
    from app.routers import mcp

    asking = {t.name for t in tools if not t.pre_approved}
    assert asking == {"run_command", "batch_run", "rename_apply", "rename_undo", "trash_files", "image_edit", "image_meta_write", "demo_open"}
    approved = mcp.pre_approved_names()
    assert len(approved) == 27
    assert "mcp__formtools_tab__trash_files" not in approved
    assert "mcp__formtools_tab__fs_list" in approved


def test_the_claude_code_tab_is_started_with_exactly_the_derived_list(tools):
    from app.services import claude_code

    argv = claude_code.terminal_argv("/x/claude", "/x/mcp.json", None, None)
    text = " ".join(argv)
    assert f"--allowedTools {claude_code.allowed_tools()} " in text
    assert "mcp__formtools_tab__trash_files" not in text
    assert "mcp__formtools_tab__fs_list" in text
    assert "--allowedTools mcp__formtools_tab " not in text


def test_tools_list_carries_the_annotations(client):
    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).json()["result"]["tools"]
    by_name = {t["name"]: t["annotations"] for t in reply}
    assert by_name["fs_list"] == {"readOnlyHint": True}
    assert by_name["media_copy"] == {"readOnlyHint": False, "destructiveHint": False}
    assert by_name["trash_files"] == {"readOnlyHint": False, "destructiveHint": True}
