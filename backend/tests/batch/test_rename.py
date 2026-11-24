import os
import time

import pytest

from .support import contents, make_files, names, new_names, rename_apply, rename_plan


def test_a_counter_numbers_the_files_in_the_order_given_with_padding(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "b.txt", "c.txt"])
    reply = rename_plan(client, paths, [{"type": "counter", "start": 1, "pad": 3}]).json()
    assert new_names(reply) == ["a_001.txt", "b_002.txt", "c_003.txt"]
    assert names(tmp_path) == ["a.txt", "b.txt", "c.txt"]


def test_a_counter_can_start_anywhere_step_and_sit_in_front(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "b.txt", "c.txt"])
    rule = {"type": "counter", "start": 10, "step": 5, "pad": 0, "position": "start", "separator": "-"}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["10-a.txt", "15-b.txt", "20-c.txt"]


def test_applying_a_counter_renames_the_files_and_loses_no_content(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "b.txt", "c.txt"])
    before = contents(tmp_path)
    reply = rename_apply(client, paths, [{"type": "counter", "start": 1, "pad": 2}]).json()
    assert reply["renamed"] == 3
    assert names(tmp_path) == ["a_01.txt", "b_02.txt", "c_03.txt"]
    assert contents(tmp_path) == before
    assert (tmp_path / "b_02.txt").read_text() == "content of b.txt"


@pytest.mark.parametrize(
    "mode, expected",
    [
        ("upper", "MY HOLIDAY PHOTO.jpg"),
        ("lower", "my holiday photo.jpg"),
        ("title", "My Holiday Photo.jpg"),
        ("sentence", "My holiday photo.jpg"),
    ],
)
def test_a_case_change_alters_the_name_and_keeps_the_extension(client, tmp_path, mode, expected):
    paths = make_files(tmp_path, ["my HOLIDAY photo.jpg"])
    assert new_names(rename_plan(client, paths, [{"type": "case", "mode": mode}]).json()) == [expected]


def test_find_and_replace_changes_every_match_and_ignores_case_by_default(client, tmp_path):
    paths = make_files(tmp_path, ["IMG_img_1.png"])
    reply = rename_plan(client, paths, [{"type": "replace", "find": "img", "replace": "pic"}]).json()
    assert new_names(reply) == ["pic_pic_1.png"]


def test_find_and_replace_can_match_case_and_only_the_first_match(client, tmp_path):
    paths = make_files(tmp_path, ["IMG_img_img.png"])
    rule = {"type": "replace", "find": "img", "replace": "pic", "case": True, "all": False}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["IMG_pic_img.png"]


def test_find_and_replace_on_the_name_leaves_the_extension_alone(client, tmp_path):
    paths = make_files(tmp_path, ["png_scan.png"])
    rule = {"type": "replace", "find": "png", "replace": "x"}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["x_scan.png"]


def test_find_and_replace_scoped_to_the_extension_leaves_the_name_alone(client, tmp_path):
    paths = make_files(tmp_path, ["jpeg_scan.jpeg"])
    rule = {"type": "replace", "find": "jpeg", "replace": "jpg", "scope": "ext"}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["jpeg_scan.jpg"]


def test_a_regular_expression_replace_can_reorder_captured_groups(client, tmp_path):
    paths = make_files(tmp_path, ["2024-03-15 trip.txt"])
    rule = {"type": "replace", "regex": True, "find": r"(\d{4})-(\d{2})-(\d{2})", "replace": "$3.$2.$1"}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["15.03.2024 trip.txt"]


def test_extension_rules_change_only_the_extension(client, tmp_path):
    paths = make_files(tmp_path, ["Shot.JPG"])
    assert new_names(rename_plan(client, paths, [{"type": "extension", "mode": "lower"}]).json()) == ["Shot.jpg"]
    assert new_names(rename_plan(client, paths, [{"type": "extension", "mode": "set", "value": ".jpeg"}]).json()) == ["Shot.jpeg"]


def test_insert_remove_and_trim_rules_edit_the_name_as_described(client, tmp_path):
    paths = make_files(tmp_path, ["abcdef.txt"])
    assert new_names(rename_plan(client, paths, [{"type": "insert", "text": "X", "position": 2}]).json()) == ["abXcdef.txt"]
    assert new_names(rename_plan(client, paths, [{"type": "insert", "text": "X", "position": "end"}]).json()) == ["abcdefX.txt"]
    assert new_names(rename_plan(client, paths, [{"type": "remove", "from": 1, "count": 3}]).json()) == ["aef.txt"]
    spaced = make_files(tmp_path, ["  a   b__c  .txt"])
    assert new_names(rename_plan(client, spaced, [{"type": "trim"}]).json()) == ["a b_c.txt"]


def test_rules_run_in_the_order_given(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    first = [{"type": "insert", "text": "b", "position": "end"}, {"type": "case", "mode": "upper"}]
    second = list(reversed(first))
    assert new_names(rename_plan(client, paths, first).json()) == ["AB.txt"]
    assert new_names(rename_plan(client, paths, second).json()) == ["Ab.txt"]


def test_a_date_rule_adds_the_modified_date_of_each_file(client, tmp_path):
    paths = make_files(tmp_path, ["note.txt"])
    moment = time.mktime((2021, 7, 4, 12, 0, 0, 0, 0, -1))
    os.utime(paths[0], (moment, moment))
    rule = {"type": "date", "source": "mtime", "format": "%Y%m%d", "position": "start"}
    assert new_names(rename_plan(client, paths, [rule]).json()) == ["20210704_note.txt"]


def test_a_folder_with_a_dot_in_its_name_is_renamed_whole(client, tmp_path):
    (tmp_path / "v1.2").mkdir()
    reply = rename_plan(client, [str(tmp_path / "v1.2")], [{"type": "insert", "text": "_final", "position": "end"}, {"type": "extension", "mode": "set", "value": "bak"}]).json()
    assert new_names(reply) == ["v1.2_final"]


def test_two_files_that_would_get_the_same_name_are_marked_and_refused(client, tmp_path):
    paths = make_files(tmp_path, ["a1.txt", "a2.txt"])
    rule = {"type": "replace", "regex": True, "find": r"\d", "replace": ""}
    plan = rename_plan(client, paths, [rule]).json()
    assert [item["conflict"] for item in plan["items"]] == ["duplicate", "duplicate"]
    before = contents(tmp_path)
    reply = rename_apply(client, paths, [rule])
    assert reply.status_code == 409
    assert reply.json()["error"] == "2 names conflict or cannot be used; nothing was renamed"
    assert names(tmp_path) == ["a1.txt", "a2.txt"]
    assert contents(tmp_path) == before


def test_a_name_taken_by_a_file_outside_the_rename_is_refused_and_that_file_survives(client, tmp_path):
    make_files(tmp_path, ["new.txt"])
    paths = make_files(tmp_path, ["old.txt"])
    rule = {"type": "replace", "find": "old", "replace": "new"}
    assert rename_plan(client, paths, [rule]).json()["items"][0]["conflict"] == "exists"
    reply = rename_apply(client, paths, [rule])
    assert reply.status_code == 409
    assert reply.json()["error"] == "1 name conflict or cannot be used; nothing was renamed"
    assert (tmp_path / "new.txt").read_text() == "content of new.txt"
    assert (tmp_path / "old.txt").read_text() == "content of old.txt"


def test_a_name_with_a_forbidden_character_is_marked_invalid_and_refused(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    rule = {"type": "insert", "text": "x:y", "position": "end"}
    assert rename_plan(client, paths, [rule]).json()["items"][0]["conflict"] == "invalid"
    assert rename_apply(client, paths, [rule]).status_code == 409
    assert names(tmp_path) == ["a.txt"]


def test_a_rule_that_empties_a_name_is_marked_invalid(client, tmp_path):
    paths = make_files(tmp_path, ["abc"])
    rule = {"type": "remove", "from": 0, "count": 3}
    assert rename_plan(client, paths, [rule]).json()["items"][0]["conflict"] == "invalid"


def test_a_rename_onto_a_name_another_renamed_file_is_leaving_keeps_both_contents(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "aa.txt"])
    before = contents(tmp_path)
    reply = rename_apply(client, paths, [{"type": "insert", "text": "a", "position": "start"}])
    assert reply.json()["renamed"] == 2
    assert names(tmp_path) == ["aa.txt", "aaa.txt"]
    assert (tmp_path / "aa.txt").read_text() == "content of a.txt"
    assert (tmp_path / "aaa.txt").read_text() == "content of aa.txt"
    assert contents(tmp_path) == before


def test_a_rename_that_changes_nothing_renames_nothing_and_gives_no_undo(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    reply = rename_apply(client, paths, []).json()
    assert reply["renamed"] == 0 and reply["undo"] is None
    assert rename_plan(client, paths, []).json()["items"][0]["changed"] is False


def test_undo_puts_every_name_and_content_back(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "aa.txt", "b.txt"])
    before = contents(tmp_path)
    done = rename_apply(client, paths, [{"type": "insert", "text": "a", "position": "start"}, {"type": "extension", "mode": "set", "value": "md"}]).json()
    assert names(tmp_path) == ["aa.md", "aaa.md", "ab.md"]
    back = client.post("/api/rename/undo", json={"undo": done["undo"]}).json()
    assert back["restored"] == 3
    assert names(tmp_path) == ["a.txt", "aa.txt", "b.txt"]
    assert all((tmp_path / n).read_text() == f"content of {n}" for n in names(tmp_path))
    assert contents(tmp_path) == before


def test_an_undo_can_be_used_only_once(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    done = rename_apply(client, paths, [{"type": "case", "mode": "upper"}]).json()
    assert client.post("/api/rename/undo", json={"undo": done["undo"]}).status_code == 200
    again = client.post("/api/rename/undo", json={"undo": done["undo"]})
    assert again.status_code == 404
    assert again.json()["error"] == "there is no undo with that id; only the last 20 renames are kept"
    assert names(tmp_path) == ["a.txt"]


def test_undo_is_refused_when_a_renamed_file_has_gone(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt", "b.txt"])
    done = rename_apply(client, paths, [{"type": "insert", "text": "x", "position": "start"}]).json()
    (tmp_path / "xa.txt").unlink()
    reply = client.post("/api/rename/undo", json={"undo": done["undo"]})
    assert reply.status_code == 409
    assert reply.json()["error"] == "xa.txt is no longer there, so the rename cannot be undone"
    assert names(tmp_path) == ["xb.txt"]


def test_undo_is_refused_when_the_old_name_is_taken_again(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    done = rename_apply(client, paths, [{"type": "insert", "text": "x", "position": "start"}]).json()
    (tmp_path / "a.txt").write_text("newcomer")
    reply = client.post("/api/rename/undo", json={"undo": done["undo"]})
    assert reply.status_code == 409
    assert reply.json()["error"] == "a.txt exists again, so the rename cannot be undone"
    assert (tmp_path / "a.txt").read_text() == "newcomer"
    assert (tmp_path / "xa.txt").read_text() == "content of a.txt"


def test_the_same_rename_through_the_agent_tool_and_the_route_agree(client, tmp_path):
    from app.tools.batch import rename_plan_tool

    paths = make_files(tmp_path, ["a.txt", "b.txt"])
    rules = [{"type": "counter", "start": 7, "pad": 2}]
    assert rename_plan_tool({"paths": paths, "rules": rules}) == rename_plan(client, paths, rules).json()


def test_a_missing_file_is_refused_by_name(client, tmp_path):
    reply = rename_plan(client, [str(tmp_path / "ghost.txt")], [])
    assert reply.status_code == 404
    assert reply.json()["error"] == "ghost.txt does not exist"


def test_an_unknown_rule_and_an_empty_list_are_refused(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    reply = rename_plan(client, paths, [{"type": "shuffle"}])
    assert reply.status_code == 400 and reply.json()["error"] == "unknown rule type shuffle"
    empty = rename_plan(client, [], [])
    assert empty.status_code == 400 and empty.json()["error"] == "paths must list at least one file or folder"


def test_a_folder_and_a_file_inside_it_cannot_be_renamed_together(client, tmp_path):
    (tmp_path / "box").mkdir()
    inner = make_files(tmp_path / "box", ["a.txt"])
    reply = rename_plan(client, [str(tmp_path / "box")] + inner, [{"type": "case", "mode": "upper"}])
    assert reply.status_code == 400
    assert reply.json()["error"].startswith("a.txt is inside a folder that is renamed too")


def test_the_same_path_given_twice_is_renamed_once(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    reply = rename_plan(client, paths + paths, [{"type": "counter", "start": 1}]).json()
    assert new_names(reply) == ["a_1.txt"]
