import re

import pytest

from app.core.errors import ApiError
from app.tools.batch import regexguard

from .support import make_files, names, rename_apply, rename_plan


def test_a_pattern_that_backtracks_without_end_is_stopped_and_nothing_is_renamed(client, tmp_path):
    paths = make_files(tmp_path, ["a" * 40 + "!.txt"])
    rule = {"type": "replace", "regex": True, "find": "(a+)+$", "replace": "x"}
    reply = rename_apply(client, paths, [rule])
    assert reply.status_code == 400
    assert reply.json()["error"] == "that regular expression took longer than 1 second and was stopped"
    assert names(tmp_path) == ["a" * 40 + "!.txt"]


def test_a_broken_pattern_is_refused_with_a_message(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    reply = rename_plan(client, paths, [{"type": "replace", "regex": True, "find": "(a", "replace": "x"}])
    assert reply.status_code == 400
    assert "not valid" in reply.json()["error"]


def test_a_pattern_longer_than_256_characters_is_refused(client, tmp_path):
    paths = make_files(tmp_path, ["a.txt"])
    reply = rename_plan(client, paths, [{"type": "replace", "regex": True, "find": "a" * 257, "replace": "x"}])
    assert reply.status_code == 400
    assert reply.json()["error"] == "the regular expression is too long"


@pytest.mark.parametrize("pattern", ["(a+)+$", "(a*)*b", "(a|aa)+$", "(.*a){12}", "a+b+c+d+"])
def test_the_guard_refuses_patterns_whose_repeats_can_blow_up(pattern):
    with pytest.raises(ApiError) as caught:
        regexguard.inline_checked(pattern)
    assert caught.value.status == 400
    assert caught.value.message == "that regular expression is too complex to run safely here; simplify the repeats"


@pytest.mark.parametrize("pattern", [r"\d+", r"IMG_(\d{4})", "^a|b$", r"[a-z]+\.[a-z]+", "a?b"])
def test_the_guard_lets_ordinary_patterns_through(pattern):
    assert regexguard.inline_checked(pattern) is None


@pytest.mark.parametrize(
    "pattern, replacement, ignore, count",
    [(r"\d+", "#", False, 0), ("a", "b", True, 1), (r"(\w)(\w)", r"\g<2>\g<1>", False, 0)],
)
def test_substitute_agrees_with_the_standard_library(pattern, replacement, ignore, count):
    texts = ["Abc123a45", "AaAa", "no digits", ""]
    expected = [re.sub(pattern, replacement, t, count=count, flags=re.IGNORECASE if ignore else 0) for t in texts]
    assert regexguard.substitute(pattern, replacement, texts, ignore, count) == expected


def test_substitute_refuses_a_name_longer_than_1024_characters():
    with pytest.raises(ApiError) as caught:
        regexguard.substitute("a", "b", ["a" * 1025], False, 0)
    assert caught.value.message == "a name is longer than 1024 characters"
