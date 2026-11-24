import json
import zipfile

import pytest

from .support import CLOSED_URL, app_version, copy_setup, engine_bridge, run_program


@pytest.fixture
def copy(tmp_path):
    return copy_setup(tmp_path, version_ts="7.7.7-copy")


def cli(copy, args, **kw):
    return run_program(copy / "setup" / "cli.py", args, copy, **kw)


def test_cli_without_a_command_prints_usage_and_succeeds(copy):
    done = cli(copy, [])
    assert done.returncode == 0 and done.stdout.startswith("usage: ./formtools cli COMMAND")


def test_cli_unknown_command_prints_usage_to_stderr_and_exits_2(copy):
    done = cli(copy, ["frobnicate"])
    assert done.returncode == 2 and done.stdout == "" and "usage: ./formtools cli COMMAND" in done.stderr


def test_cli_version_reads_the_window_version_file_and_says_the_engine_is_not_running(copy):
    done = cli(copy, ["version"])
    assert (done.returncode, done.stdout) == (0, "formtools 7.7.7-copy\nengine not running\n")


def test_cli_version_falls_back_to_package_json_when_version_file_is_absent(tmp_path):
    copy = copy_setup(tmp_path, package={"version": "5.4.3"})
    assert cli(copy, ["version"]).stdout.splitlines()[0] == "formtools 5.4.3"


def test_cli_version_names_the_running_engine_version(copy, bare):
    with engine_bridge(bare) as url:
        done = cli(copy, ["version"], extra_env={"FORMTOOLS_URL": url})
    assert done.stdout.splitlines() == ["formtools 7.7.7-copy", f"engine {app_version()}"]


def test_cli_says_how_to_start_the_engine_when_it_is_not_answering(copy, tmp_path):
    done = cli(copy, ["list", str(tmp_path)])
    assert done.returncode == 1
    assert done.stderr.startswith(f"formtools: the engine is not answering at {CLOSED_URL}") and "Start it with ./formtools boot." in done.stderr


def test_cli_list_prints_the_folder_as_json_through_the_running_engine(copy, bare, tmp_path):
    folder = tmp_path / "pics"
    folder.mkdir()
    (folder / "b.png").write_bytes(b"12345")
    (folder / "a2.txt").write_text("hi", encoding="utf-8")
    (folder / "a10.txt").write_text("hello", encoding="utf-8")
    with engine_bridge(bare) as url:
        done = cli(copy, ["list", str(folder)], extra_env={"FORMTOOLS_URL": url})
    assert done.returncode == 0, done.stderr
    listing = json.loads(done.stdout)
    assert [(e["name"], e["size"]) for e in listing["entries"]] == [("a2.txt", 2), ("a10.txt", 5), ("b.png", 5)]


def test_cli_list_of_a_missing_folder_exits_1_with_the_engine_sentence(copy, bare, tmp_path):
    with engine_bridge(bare) as url:
        done = cli(copy, ["list", str(tmp_path / "gone")], extra_env={"FORMTOOLS_URL": url})
    assert done.returncode == 1 and done.stderr.strip() == "formtools: that folder does not exist"


def test_cli_rename_prints_the_plan_and_renames_nothing_without_apply(copy, bare, tmp_path):
    tmp_path = tmp_path / "shots"
    tmp_path.mkdir()
    (tmp_path / "IMG_1.jpg").write_bytes(b"x")
    (tmp_path / "keep.jpg").write_bytes(b"x")
    with engine_bridge(bare) as url:
        done = cli(copy, ["rename", "--find", "IMG", "--replace", "trip", str(tmp_path / "IMG_1.jpg"), str(tmp_path / "keep.jpg")], extra_env={"FORMTOOLS_URL": url})
    assert done.returncode == 0, done.stderr
    lines = done.stdout.splitlines()
    assert f"{tmp_path / 'IMG_1.jpg'} -> trip_1.jpg" in lines
    assert f"{tmp_path / 'keep.jpg'}  (unchanged)" in lines
    assert lines[-2:] == ["1 of 2 names change", "nothing was renamed; add --apply to do it"]
    assert sorted(p.name for p in tmp_path.iterdir()) == ["IMG_1.jpg", "keep.jpg"]


def test_cli_rename_without_rules_exits_2(copy, tmp_path):
    done = cli(copy, ["rename", str(tmp_path)])
    assert done.returncode == 2 and done.stderr.strip() == "formtools: give --find and or --counter"


def test_cli_convert_without_inputs_exits_2(copy):
    done = cli(copy, ["convert", "--format", "png"])
    assert done.returncode == 2 and done.stderr.strip() == "formtools: give at least one input file or folder"


def test_cli_convert_with_an_unreadable_config_file_exits_1(copy, tmp_path):
    done = cli(copy, ["convert", "--config", str(tmp_path / "none.json"), str(tmp_path)])
    assert done.returncode == 1 and done.stderr.startswith("formtools: cannot read the config file:")


def test_cli_resize_needs_the_longest_side(copy, tmp_path):
    done = cli(copy, ["resize", str(tmp_path)])
    assert done.returncode == 2 and "--longest" in done.stderr


def mcp(copy, args, **kw):
    return run_program(copy / "setup" / "mcp_stdio.py", args, copy, **kw)


def test_mcp_bridge_version_matches_the_window_version_file(copy):
    assert mcp(copy, ["--version"]).stdout == "formtools 7.7.7-copy\n"


def test_mcp_bridge_where_prints_launcher_script_and_url(copy):
    where = json.loads(mcp(copy, ["--where", "--url", "http://127.0.0.1:1/mcp"]).stdout)
    assert where["url"] == "http://127.0.0.1:1/mcp"
    assert where["script"] == str(copy / "setup" / "mcp_stdio.py")
    assert where["claude_desktop"]["mcpServers"]["formtools"] == {"command": str(copy / "formtools"), "args": ["mcp"]}


def test_mcp_bridge_answers_a_line_that_is_not_json_with_a_parse_error(copy):
    done = mcp(copy, [], stdin="this is not json\n")
    assert json.loads(done.stdout) == {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}}


def test_mcp_bridge_without_an_engine_answers_requests_with_a_sentence_and_stays_silent_for_notifications(copy):
    lines = json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n" + json.dumps({"jsonrpc": "2.0", "id": 7, "method": "tools/list"}) + "\n"
    done = mcp(copy, [], stdin=lines)
    replies = [json.loads(line) for line in done.stdout.splitlines()]
    assert len(replies) == 1 and replies[0]["id"] == 7 and replies[0]["error"]["code"] == -32000
    assert "not running and could not be started" in replies[0]["error"]["message"]


def test_mcp_bridge_relays_tool_listing_from_the_engine(copy, client, bare):
    from app.routers import mcp as mcp_router

    request = json.dumps({"jsonrpc": "2.0", "id": 3, "method": "tools/list"}) + "\n"
    with engine_bridge(bare) as url:
        done = mcp(copy, ["--url", url + "/mcp"], stdin=request)
    reply = json.loads(done.stdout)
    assert reply["id"] == 3
    assert sorted(t["name"] for t in reply["result"]["tools"]) == sorted(t.name for t in mcp_router.all_tools())


def test_mcp_bridge_finds_the_engine_from_the_port_file_in_the_data_folder(copy, bare, tmp_path):
    data = tmp_path / "data"
    data.mkdir()
    request = json.dumps({"jsonrpc": "2.0", "id": 9, "method": "tools/list"}) + "\n"
    with engine_bridge(bare) as url:
        (data / "engine.port").write_text(json.dumps({"pid": 1, "port": int(url.rsplit(":", 1)[1])}), encoding="utf-8")
        env = {"FORMTOOLS_PORT": "9", "FORMTOOLS_DATA_DIR": str(data)}
        done = run_program(copy / "setup" / "mcp_stdio.py", [], copy, extra_env=env, stdin=request)
    env_free = json.loads(done.stdout)
    assert env_free["id"] == 9 and "result" in env_free
    assert f"using the running engine at {url}/mcp" in done.stderr


def mcpb(copy, args):
    return run_program(copy / "setup" / "mcpb.py", args, copy)


def matched_copy(tmp_path):
    copy = copy_setup(tmp_path)
    manifest = json.loads((copy / "setup" / "mcpb" / "manifest.json").read_text(encoding="utf-8"))
    (copy / "frontend" / "package.json").write_text(json.dumps({"version": manifest["version"]}), encoding="utf-8")
    return copy, manifest


def test_mcpb_check_accepts_a_manifest_that_matches_package_json(tmp_path):
    copy, _ = matched_copy(tmp_path)
    done = mcpb(copy, ["--check"])
    assert (done.returncode, done.stdout.strip()) == (0, "[mcpb] manifest is valid and matches package.json")


def test_mcpb_check_refuses_a_version_that_differs_from_package_json(tmp_path):
    copy, manifest = matched_copy(tmp_path)
    (copy / "frontend" / "package.json").write_text(json.dumps({"version": "0.0.1"}), encoding="utf-8")
    done = mcpb(copy, ["--check"])
    assert done.returncode == 1
    assert f"[mcpb] manifest version {manifest['version']} differs from package.json 0.0.1" in done.stderr


def test_mcpb_check_lists_every_broken_manifest_rule(tmp_path):
    copy, manifest = matched_copy(tmp_path)
    manifest.update(manifest_version="0.1", name="Form Tools", server={"type": "node", "entry_point": "lib/x.js", "mcp_config": {}})
    manifest.pop("author", None)
    (copy / "setup" / "mcpb" / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    lines = set(mcpb(copy, ["--check"]).stderr.splitlines())
    for rule in ("manifest needs author", "manifest_version must be 0.2", "manifest name must be lower-case letters, digits and hyphens", "manifest author needs a name", "server type must be python", "server entry_point must be a file under server/", "server mcp_config needs a command and args"):
        assert f"[mcpb] {rule}" in lines


def test_mcpb_build_writes_a_zip_holding_the_manifest_and_bridge_with_fixed_dates(tmp_path):
    copy, _ = matched_copy(tmp_path)
    done = mcpb(copy, ["--build", str(tmp_path / "out")])
    target = tmp_path / "out" / "formtools.mcpb"
    assert (done.returncode, done.stdout.strip()) == (0, f"[mcpb] wrote {target}")
    with zipfile.ZipFile(target) as z:
        assert z.namelist() == ["manifest.json", "server/mcp_stdio.py"]
        assert z.read("manifest.json") == (copy / "setup" / "mcpb" / "manifest.json").read_bytes()
        assert z.read("server/mcp_stdio.py") == (copy / "setup" / "mcp_stdio.py").read_bytes()
        assert all(info.date_time == (1980, 1, 1, 0, 0, 0) for info in z.infolist())


def test_mcpb_build_is_byte_for_byte_repeatable(tmp_path):
    copy, _ = matched_copy(tmp_path)
    mcpb(copy, ["--build", str(tmp_path / "one")])
    mcpb(copy, ["--build", str(tmp_path / "two")])
    assert (tmp_path / "one" / "formtools.mcpb").read_bytes() == (tmp_path / "two" / "formtools.mcpb").read_bytes()


def test_mcpb_build_refuses_and_writes_nothing_when_the_manifest_is_wrong(tmp_path):
    copy, _ = matched_copy(tmp_path)
    (copy / "frontend" / "package.json").write_text(json.dumps({"version": "0.0.1"}), encoding="utf-8")
    done = mcpb(copy, ["--build", str(tmp_path / "out")])
    assert done.returncode == 1 and not (tmp_path / "out").exists()


def test_mcpb_needs_check_or_build(tmp_path):
    copy, _ = matched_copy(tmp_path)
    assert mcpb(copy, []).returncode == 2
