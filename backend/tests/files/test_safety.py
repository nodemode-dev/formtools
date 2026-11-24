import os

import pytest

from app.core.errors import ApiError
from app.tools.files import safety


@pytest.mark.parametrize(
    "name,parts",
    [
        ("a.txt", ["a.txt"]),
        ("dir/sub/a.txt", ["dir", "sub", "a.txt"]),
        ("./a.txt", ["a.txt"]),
        ("a//b///c", ["a", "b", "c"]),
        ("dir\\sub\\a.txt", ["dir", "sub", "a.txt"]),
        ("trailing/", ["trailing"]),
        ("a/./b", ["a", "b"]),
        ("...", ["..."]),
        ("name..ext", ["name..ext"]),
    ],
)
def test_ordinary_member_names_are_split_into_their_parts(name, parts):
    assert safety.split_name(name) == parts


@pytest.mark.parametrize(
    "name,reason",
    [
        ("", "the name is empty or has a null character"),
        ("a\x00b", "the name is empty or has a null character"),
        ("/etc/passwd", "the name is absolute"),
        ("\\windows\\x", "the name is absolute"),
        ("C:/x", "the name starts with a drive letter"),
        ("z:\\x", "the name starts with a drive letter"),
        ("c:x", "the name starts with a drive letter"),
        ("..", "the name climbs out of the destination with .."),
        ("../x", "the name climbs out of the destination with .."),
        ("a/../x", "the name climbs out of the destination with .."),
        ("a/b/..", "the name climbs out of the destination with .."),
        ("a\\..\\x", "the name climbs out of the destination with .."),
        ("./", "the name has no usable part"),
        ("a/..\\..\\x", "the name climbs out of the destination with .."),
    ],
)
def test_names_that_could_escape_the_destination_are_refused_with_a_reason(name, reason):
    with pytest.raises(safety.Refused) as caught:
        safety.split_name(name)
    assert str(caught.value) == reason


def test_unique_returns_the_same_path_when_nothing_is_there(tmp_path):
    assert safety.unique(tmp_path / "a.txt") == tmp_path / "a.txt"


def test_unique_counts_up_from_two_and_keeps_the_extension(tmp_path):
    (tmp_path / "a.txt").write_bytes(b"")
    assert safety.unique(tmp_path / "a.txt") == tmp_path / "a (2).txt"
    (tmp_path / "a (2).txt").write_bytes(b"")
    assert safety.unique(tmp_path / "a.txt") == tmp_path / "a (3).txt"


def test_unique_keeps_a_double_tar_extension_together(tmp_path):
    (tmp_path / "pack.tar.gz").write_bytes(b"")
    assert safety.unique(tmp_path / "pack.tar.gz") == tmp_path / "pack (2).tar.gz"


def test_unique_treats_a_dangling_symbolic_link_as_taken(tmp_path):
    os.symlink(tmp_path / "nowhere", tmp_path / "a.txt")
    assert safety.unique(tmp_path / "a.txt") == tmp_path / "a (2).txt"


def test_place_moves_the_temp_file_to_the_wanted_name(tmp_path):
    temp = tmp_path / "t.part"
    temp.write_bytes(b"content")
    final = safety.place(temp, tmp_path / "wanted.bin")
    assert final == tmp_path / "wanted.bin" and final.read_bytes() == b"content"
    assert not temp.exists()


def test_place_never_overwrites_an_existing_file(tmp_path):
    (tmp_path / "wanted.bin").write_bytes(b"old")
    temp = tmp_path / "t.part"
    temp.write_bytes(b"new")
    final = safety.place(temp, tmp_path / "wanted.bin")
    assert final == tmp_path / "wanted (2).bin"
    assert (tmp_path / "wanted.bin").read_bytes() == b"old" and final.read_bytes() == b"new"


def test_temp_names_are_distinct_hidden_part_files_in_the_given_folder(tmp_path):
    first = safety.temp_beside(tmp_path)
    second = safety.temp_beside(tmp_path)
    assert first != second
    assert first.parent == tmp_path and first.name.startswith(".") and first.name.endswith(".part")


def test_discard_removes_a_file_and_ignores_a_missing_one(tmp_path):
    target = tmp_path / "x.part"
    target.write_bytes(b"1")
    safety.discard(target)
    safety.discard(target)
    assert not target.exists()


def test_inside_accepts_the_root_and_children_but_not_a_sibling_with_the_same_prefix():
    assert safety.inside("/data/dest", "/data/dest")
    assert safety.inside("/data/dest", "/data/dest/sub/file")
    assert not safety.inside("/data/dest", "/data/dest-evil/file")
    assert not safety.inside("/data/dest", "/data")


def test_safe_folder_creates_each_missing_folder_below_the_root(tmp_path):
    made = safety.safe_folder(tmp_path, ["a", "b", "c"])
    assert made == tmp_path / "a" / "b" / "c" and made.is_dir()


@pytest.mark.skipif(os.name == "nt", reason="symbolic links need privileges on Windows")
def test_safe_folder_refuses_to_walk_through_a_symbolic_link(tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    root = tmp_path / "root"
    root.mkdir()
    os.symlink(outside, root / "hop")
    with pytest.raises(safety.Refused, match="a folder on the way is a symbolic link"):
        safety.safe_folder(root, ["hop", "deeper"])
    assert list(outside.iterdir()) == []


def test_safe_folder_refuses_when_a_file_is_where_a_folder_is_needed(tmp_path):
    (tmp_path / "a").write_bytes(b"file")
    with pytest.raises(safety.Refused, match="a file is in the way of a folder"):
        safety.safe_folder(tmp_path, ["a", "b"])


def test_prepare_target_returns_the_path_for_the_last_part_after_making_its_folders(tmp_path):
    target = safety.prepare_target(tmp_path, ["x", "y", "z.txt"])
    assert target == tmp_path / "x" / "y" / "z.txt"
    assert (tmp_path / "x" / "y").is_dir() and not target.exists()


def test_the_default_limits_are_twenty_gibibytes_and_a_ratio_of_one_thousand(monkeypatch):
    monkeypatch.delenv("FORMTOOLS_ARCHIVE_MAX_BYTES", raising=False)
    monkeypatch.delenv("FORMTOOLS_ARCHIVE_MAX_RATIO", raising=False)
    assert safety.limit_bytes() == 20 * 1024**3
    assert safety.limit_ratio() == 1000


def test_limits_can_be_lowered_through_the_environment_and_junk_values_are_ignored(monkeypatch):
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_BYTES", "5000")
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_RATIO", "junk")
    assert safety.limit_bytes() == 5000
    assert safety.limit_ratio() == 1000
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_BYTES", "0")
    assert safety.limit_bytes() == 20 * 1024**3


def test_the_budget_allows_data_up_to_the_ratio_and_refuses_beyond(monkeypatch):
    monkeypatch.delenv("FORMTOOLS_ARCHIVE_MAX_BYTES", raising=False)
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_RATIO", "100")
    budget = safety.Budget(archive_size=10)
    budget.add(1000)
    with pytest.raises(ApiError) as caught:
        budget.add(1)
    assert caught.value.status == 400
    assert caught.value.message == "extraction stopped because the archive expands more than 100 times its own size, which looks like a zip bomb"


def test_the_budget_refuses_a_declared_size_that_will_not_fit(monkeypatch):
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_BYTES", "500")
    budget = safety.Budget(archive_size=10**6)
    budget.declared(None)
    budget.declared(500)
    with pytest.raises(ApiError) as caught:
        budget.declared(501)
    assert caught.value.message == "extraction stopped because the archive expands past the size limit"


def test_the_budget_counts_all_members_together(monkeypatch):
    monkeypatch.setenv("FORMTOOLS_ARCHIVE_MAX_BYTES", "100")
    budget = safety.Budget(archive_size=10**6)
    budget.add(60)
    assert budget.room() == 40
    with pytest.raises(ApiError):
        budget.add(41)
