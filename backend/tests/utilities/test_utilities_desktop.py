import json
import os
import re
import sys

import pytest
from PIL import Image

from app.core.errors import ApiError
from app.tools.desktop import elevate, envvars, thumbnail
from .support import profile, put

posix_only = pytest.mark.skipif(sys.platform == "darwin" or os.name == "nt", reason="the user scope is a file only on Linux")


def user_vars(client):
    scope = [s for s in client.get("/api/env").json()["scopes"] if s["id"] == "user"][0]
    return {row["name"]: row["value"] for row in scope["vars"] if not row.get("readonly")}


@posix_only
def test_a_user_variable_is_written_to_the_profile_file_and_read_back(client, profile):
    reply = client.post("/api/env", json={"scope": "user", "name": "FORM_TEST_ONE", "value": "hello"})
    assert reply.status_code == 200
    body = reply.json()
    assert body["ok"] is True and body["name"] == "FORM_TEST_ONE" and body["elevated"] is False
    assert "FORM_TEST_ONE=hello\n" in profile.read_text(encoding="utf-8")
    assert user_vars(client) == {"FORM_TEST_ONE": "hello"}


@posix_only
def test_the_profile_file_follows_the_environment_d_format(client, profile):
    client.post("/api/env", json={"scope": "user", "name": "PLAIN", "value": "a/b:c.d"})
    client.post("/api/env", json={"scope": "user", "name": "SPACED", "value": 'two words and a "quote" and \\slash'})
    text = profile.read_text(encoding="utf-8")
    assert text.startswith("# ")
    assert "PLAIN=a/b:c.d\n" in text
    assert 'SPACED="two words and a \\"quote\\" and \\\\slash"\n' in text
    values = {}
    for line in text.splitlines():
        if line and not line.startswith("#"):
            name, _, raw = line.partition("=")
            if raw.startswith('"'):
                raw = re.sub(r"\\(.)", r"\1", raw[1:-1])
            values[name] = raw
    assert values == {"PLAIN": "a/b:c.d", "SPACED": 'two words and a "quote" and \\slash'}
    assert user_vars(client) == values


@posix_only
def test_setting_a_variable_again_replaces_it_in_place(client, profile):
    for name, value in (("AAA", "1"), ("BBB", "2"), ("CCC", "3")):
        client.post("/api/env", json={"scope": "user", "name": name, "value": value})
    client.post("/api/env", json={"scope": "user", "name": "BBB", "value": "two"})
    lines = [line for line in profile.read_text(encoding="utf-8").splitlines() if not line.startswith("#")]
    assert lines == ["AAA=1", "BBB=two", "CCC=3"]


@posix_only
def test_a_null_value_removes_the_variable_and_keeps_the_others(client, profile):
    for name, value in (("AAA", "1"), ("BBB", "2")):
        client.post("/api/env", json={"scope": "user", "name": name, "value": value})
    assert client.post("/api/env", json={"scope": "user", "name": "AAA", "value": None}).json()["ok"] is True
    assert user_vars(client) == {"BBB": "2"}
    assert "AAA" not in profile.read_text(encoding="utf-8")


@posix_only
def test_other_lines_in_the_profile_file_are_left_alone(client, profile):
    profile.parent.mkdir(parents=True)
    profile.write_text("# mine\nKEEP=yes\n\n; semicolon remark\nOLD=1", encoding="utf-8")
    client.post("/api/env", json={"scope": "user", "name": "OLD", "value": "2"})
    client.post("/api/env", json={"scope": "user", "name": "NEW", "value": "3"})
    assert profile.read_text(encoding="utf-8") == "# mine\nKEEP=yes\n\n; semicolon remark\nOLD=2\nNEW=3\n"


@posix_only
def test_other_environment_d_files_are_listed_read_only_and_never_changed(client, profile):
    other = profile.parent / "10-other.conf"
    other.parent.mkdir(parents=True)
    other.write_text("FROM_OTHER=zzz\n", encoding="utf-8")
    scope = [s for s in client.get("/api/env").json()["scopes"] if s["id"] == "user"][0]
    rows = [row for row in scope["vars"] if row["name"] == "FROM_OTHER"]
    assert rows == [{"name": "FROM_OTHER", "value": "zzz", "readonly": True, "source": str(other)}]
    client.post("/api/env", json={"scope": "user", "name": "FROM_OTHER", "value": "mine"})
    assert other.read_text(encoding="utf-8") == "FROM_OTHER=zzz\n"


@posix_only
def test_the_user_scope_says_where_it_is_stored(client, profile):
    scope = [s for s in client.get("/api/env").json()["scopes"] if s["id"] == "user"][0]
    assert scope["editable"] is True
    assert str(profile) in scope["where"]


def test_the_process_scope_lists_the_engine_environment_and_is_read_only(client, monkeypatch):
    monkeypatch.setenv("FORM_PROCESS_MARK", "present")
    scope = [s for s in client.get("/api/env").json()["scopes"] if s["id"] == "process"][0]
    assert scope["editable"] is False
    assert {"name": "FORM_PROCESS_MARK", "value": "present"} in scope["vars"]
    reply = client.post("/api/env", json={"scope": "process", "name": "X", "value": "1"})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the process scope is read only"


def test_a_scope_can_be_asked_for_alone_through_the_tool(client, monkeypatch):
    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "env_read", "arguments": {"scope": "process"}}})
    body = json.loads(reply.json()["result"]["content"][0]["text"])
    assert [s["id"] for s in body["scopes"]] == ["process"]


def test_asking_for_a_scope_the_system_does_not_have_is_refused(client):
    with pytest.raises(ApiError) as caught:
        envvars.scopes("nonsense")
    assert caught.value.status == 400
    assert caught.value.message == "that scope does not exist on this system"


@pytest.mark.parametrize("name", ["1BAD", "has space", "a-b", "x=y", "", "d\u00e9j\u00e0"])
@posix_only
def test_an_invalid_variable_name_is_refused_and_the_profile_untouched(client, profile, name):
    reply = client.post("/api/env", json={"scope": "user", "name": name, "value": "v"})
    assert reply.status_code == 400
    assert reply.json()["error"] == f"{name or 'an empty name'} is not a valid variable name"
    assert not profile.exists()


@pytest.mark.parametrize("value", ["one\ntwo", "a\rb", "nul\u0000byte"])
@posix_only
def test_a_value_with_a_line_break_is_refused(client, profile, value):
    reply = client.post("/api/env", json={"scope": "user", "name": "GOOD", "value": value})
    assert reply.status_code == 400
    assert reply.json()["error"] == "a value must stay on one line"
    assert not profile.exists()


def test_an_unknown_scope_is_refused(client):
    reply = client.post("/api/env", json={"scope": "galaxy", "name": "A", "value": "1"})
    assert reply.status_code == 400
    assert reply.json()["error"] == "scope must be user or system"


@posix_only
def test_the_system_scope_cannot_be_edited_on_this_system(client, profile):
    reply = client.post("/api/env", json={"scope": "system", "name": "A", "value": "1"})
    assert reply.status_code == 400
    assert reply.json()["error"] == "that scope cannot be edited on this system"
    assert not profile.exists()


def test_an_edit_never_changes_the_running_engine_environment(client, profile):
    before = dict(os.environ)
    client.post("/api/env", json={"scope": "user", "name": "FORM_NEVER_SET", "value": "1"})
    assert "FORM_NEVER_SET" not in os.environ
    assert dict(os.environ) == before


def test_elevation_is_refused_when_no_prompt_program_exists_and_the_target_is_untouched(tmp_path, monkeypatch):
    if sys.platform == "darwin" or sys.platform.startswith("win"):
        pytest.skip("this check is for the pkexec path of Linux")
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    target = tmp_path / "protected"
    target.write_bytes(b"old")
    with pytest.raises(ApiError) as caught:
        elevate.write_file(target, b"new")
    assert caught.value.status == 403
    assert caught.value.message == "administrator permission was not given, so nothing was changed (pkexec is not installed; edit the file as an administrator instead)"
    assert target.read_bytes() == b"old"


def test_saving_a_hosts_file_that_needs_administrator_rights_is_refused_not_performed(client, tmp_path, monkeypatch):
    if sys.platform == "darwin" or sys.platform.startswith("win"):
        pytest.skip("this check is for the pkexec path of Linux")
    target = tmp_path / "no-such-folder" / "hosts"
    monkeypatch.setenv("FORMTOOLS_HOSTS_PATH", str(target))
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    reply = client.post("/api/hosts", json={"entries": [{"address": "10.0.0.1", "names": ["a.lan"]}]})
    assert reply.status_code == 403
    assert reply.json()["error"].startswith("administrator permission was not given, so nothing was changed")
    assert not target.exists()
    assert not (tmp_path / "no-such-folder").exists()


def test_elevation_leaves_no_staged_copy_behind(tmp_path, monkeypatch):
    if sys.platform == "darwin" or sys.platform.startswith("win"):
        pytest.skip("this check is for the pkexec path of Linux")
    import tempfile

    scratch = tmp_path / "scratch"
    scratch.mkdir()
    monkeypatch.setattr(tempfile, "tempdir", str(scratch))
    monkeypatch.setenv("PATH", str(tmp_path / "empty"))
    with pytest.raises(ApiError):
        elevate.write_file(tmp_path / "t", b"data")
    assert list(scratch.iterdir()) == []


def test_a_refusal_carries_the_reason_when_one_is_given():
    assert elevate.refuse().message == "administrator permission was not given, so nothing was changed"
    assert elevate.refuse("timed out").message == "administrator permission was not given, so nothing was changed (timed out)"
    assert elevate.refuse().status == 403


def test_a_missing_helper_program_is_a_refusal_not_a_crash():
    with pytest.raises(ApiError) as caught:
        elevate.run(["/nonexistent/helper-program"])
    assert caught.value.status == 403


def test_quoting_for_the_prompt_scripts_escapes_the_characters_that_would_end_a_string():
    assert elevate.applescript_literal('a"b\\c') == '"a\\"b\\\\c"'
    assert elevate.powershell_literal("it's") == "'it''s'"
    assert elevate.powershell_literal("\u2018x\u2019") == "'\u2018\u2018x\u2019\u2019'"


def test_the_copy_command_installs_a_new_file_and_overwrites_an_existing_one(tmp_path):
    existing = tmp_path / "there"
    existing.write_bytes(b"1")
    assert elevate.copy_command(tmp_path / "s", existing) == ["/bin/cp", "-f", str(tmp_path / "s"), str(existing)]
    assert elevate.copy_command(tmp_path / "s", tmp_path / "new")[:3] == ["/usr/bin/install", "-m", "644"]


def make_picture(path, size=(200, 100)):
    Image.new("RGB", size, (10, 120, 200)).save(path)


def test_a_thumbnail_fits_the_requested_size_and_keeps_the_proportions(tmp_path):
    make_picture(tmp_path / "in.png", (200, 100))
    code = thumbnail.main([str(tmp_path / "in.png"), str(tmp_path / "out.png"), "64"])
    assert code == 0
    with Image.open(tmp_path / "out.png") as out:
        assert out.format == "PNG"
        assert out.size == (64, 32)
        assert out.convert("RGB").getpixel((10, 10)) == (10, 120, 200)


def test_a_thumbnail_is_never_made_larger_than_the_picture(tmp_path):
    make_picture(tmp_path / "in.png", (40, 20))
    assert thumbnail.main([str(tmp_path / "in.png"), str(tmp_path / "out.png"), "512"]) == 0
    with Image.open(tmp_path / "out.png") as out:
        assert max(out.size) <= 512
        assert out.size[0] == 2 * out.size[1]


def test_thumbnail_size_is_clamped_to_the_allowed_range(tmp_path):
    make_picture(tmp_path / "in.png", (400, 400))
    assert thumbnail.main([str(tmp_path / "in.png"), str(tmp_path / "small.png"), "2"]) == 0
    with Image.open(tmp_path / "small.png") as out:
        assert out.size == (thumbnail.MIN_SIZE, thumbnail.MIN_SIZE)


def test_thumbnail_of_a_missing_input_fails_with_a_message(tmp_path, capsys):
    code = thumbnail.main([str(tmp_path / "none.png"), str(tmp_path / "out.png"), "64"])
    assert code == 1
    assert capsys.readouterr().err.strip() == "the input file does not exist"
    assert not (tmp_path / "out.png").exists()


def test_thumbnail_with_the_wrong_number_of_arguments_prints_usage(capsys):
    assert thumbnail.main(["only-one"]) == 2
    assert "usage: formtools-engine --thumbnail <input> <output.png> <size>" in capsys.readouterr().err


def test_thumbnail_with_a_size_that_is_not_a_number_is_refused(tmp_path, capsys):
    make_picture(tmp_path / "in.png")
    assert thumbnail.main([str(tmp_path / "in.png"), str(tmp_path / "o.png"), "big"]) == 2
    assert capsys.readouterr().err.strip() == "the size big is not a number"


def test_thumbnail_of_a_damaged_picture_fails_without_writing_output(tmp_path, capsys):
    put(tmp_path / "bad.png", b"not a picture")
    code = thumbnail.main([str(tmp_path / "bad.png"), str(tmp_path / "o.png"), "64"])
    assert code == 1
    assert capsys.readouterr().err.strip() != ""
    assert not (tmp_path / "o.png").exists()


def environment_d_value(line):
    raw = line.partition("=")[2]
    if raw.startswith('"') and raw.endswith('"'):
        raw = re.sub(r"\\([\\\"$`])", r"\1", raw[1:-1])
    raw = raw.replace("$$", "\x00")
    raw = re.sub(r"\$\{[A-Za-z_][A-Za-z0-9_]*\}|\$[A-Za-z_][A-Za-z0-9_]*", "", raw)
    return raw.replace("\x00", "$")


@posix_only
@pytest.mark.xfail(strict=True, reason="DEFECT: a value holding a dollar sign is written with the dollar unescaped, so systemd expands it as a variable at login; environment.d(5) says a literal dollar sign must be doubled")
def test_a_value_with_a_dollar_sign_reads_back_literally_in_the_environment_d_format(client, profile):
    client.post("/api/env", json={"scope": "user", "name": "PRICE", "value": "cost$HOME"})
    line = [row for row in profile.read_text(encoding="utf-8").splitlines() if row.startswith("PRICE=")][0]
    assert environment_d_value(line) == "cost$HOME"
