import os

import pytest
from PIL import Image

from .support import can_link, dupes, group_sets, pattern, put


def test_files_with_the_same_bytes_and_different_names_are_one_group(client, tmp_path):
    data = pattern(5000, 1)
    put(tmp_path / "t" / "alpha.dat", data)
    put(tmp_path / "t" / "sub" / "beta.bin", data)
    put(tmp_path / "t" / "gamma.txt", data)
    result = dupes(client, [tmp_path / "t"])
    assert group_sets(result) == {frozenset({"alpha.dat", "beta.bin", "gamma.txt"})}
    assert result["groups"][0]["size"] == 5000
    assert result["groups"][0]["wasted"] == 10000
    assert result["wasted"] == 10000


def test_same_size_but_different_content_is_never_paired(client, tmp_path):
    put(tmp_path / "t" / "a.dat", pattern(5000, 1))
    put(tmp_path / "t" / "b.dat", pattern(5000, 2))
    result = dupes(client, [tmp_path / "t"])
    assert result["groups"] == []
    assert result["wasted"] == 0


def test_a_single_changed_byte_in_the_middle_of_a_large_file_is_not_a_duplicate(client, tmp_path):
    data = bytearray(pattern(300000, 5))
    other = bytearray(data)
    other[150000] ^= 0xFF
    put(tmp_path / "t" / "one.big", bytes(data))
    put(tmp_path / "t" / "two.big", bytes(other))
    put(tmp_path / "t" / "three.big", bytes(data))
    assert group_sets(dupes(client, [tmp_path / "t"])) == {frozenset({"one.big", "three.big"})}


def test_a_changed_last_byte_is_not_a_duplicate(client, tmp_path):
    data = pattern(2000, 9)
    put(tmp_path / "t" / "a", data)
    put(tmp_path / "t" / "b", data[:-1] + bytes([data[-1] ^ 1]))
    assert dupes(client, [tmp_path / "t"])["groups"] == []


def test_two_separate_pairs_make_two_groups_and_wasted_is_their_sum(client, tmp_path):
    put(tmp_path / "t" / "p1.a", pattern(1000, 1))
    put(tmp_path / "t" / "p1.b", pattern(1000, 1))
    put(tmp_path / "t" / "q1.a", pattern(3000, 2))
    put(tmp_path / "t" / "q1.b", pattern(3000, 2))
    put(tmp_path / "t" / "unique.c", pattern(3000, 3))
    result = dupes(client, [tmp_path / "t"])
    assert group_sets(result) == {frozenset({"p1.a", "p1.b"}), frozenset({"q1.a", "q1.b"})}
    assert [group["wasted"] for group in result["groups"]] == [3000, 1000]
    assert result["wasted"] == 4000


def test_a_group_of_four_wastes_three_copies(client, tmp_path):
    for name in "abcd":
        put(tmp_path / "t" / f"{name}.dat", pattern(800, 4))
    result = dupes(client, [tmp_path / "t"])
    assert result["groups"][0]["wasted"] == 2400
    assert len(result["groups"][0]["files"]) == 4


def test_empty_files_are_ignored_by_default(client, tmp_path):
    put(tmp_path / "t" / "e1", b"")
    put(tmp_path / "t" / "e2", b"")
    assert dupes(client, [tmp_path / "t"])["groups"] == []


def test_min_size_hides_small_duplicates(client, tmp_path):
    put(tmp_path / "t" / "s1", pattern(100, 1))
    put(tmp_path / "t" / "s2", pattern(100, 1))
    put(tmp_path / "t" / "l1", pattern(1000, 2))
    put(tmp_path / "t" / "l2", pattern(1000, 2))
    assert group_sets(dupes(client, [tmp_path / "t"], min_size=101)) == {frozenset({"l1", "l2"})}
    assert len(dupes(client, [tmp_path / "t"], min_size=0)["groups"]) == 2


def test_not_recursive_looks_only_at_the_top_folder(client, tmp_path):
    put(tmp_path / "t" / "top.dat", pattern(500, 1))
    put(tmp_path / "t" / "sub" / "deep.dat", pattern(500, 1))
    put(tmp_path / "t" / "twin.dat", pattern(500, 1))
    assert group_sets(dupes(client, [tmp_path / "t"], recursive=False)) == {frozenset({"top.dat", "twin.dat"})}
    assert len(group_sets(dupes(client, [tmp_path / "t"])).pop()) == 3


def test_hidden_files_are_skipped_unless_asked_for(client, tmp_path):
    put(tmp_path / "t" / "seen.dat", pattern(500, 1))
    put(tmp_path / "t" / ".hidden.dat", pattern(500, 1))
    put(tmp_path / "t" / ".cache" / "inner.dat", pattern(500, 1))
    assert dupes(client, [tmp_path / "t"])["groups"] == []
    assert group_sets(dupes(client, [tmp_path / "t"], include_hidden=True)) == {frozenset({"seen.dat", ".hidden.dat", "inner.dat"})}


def test_duplicates_are_found_across_two_roots(client, tmp_path):
    put(tmp_path / "one" / "a.dat", pattern(700, 1))
    put(tmp_path / "two" / "b.dat", pattern(700, 1))
    assert group_sets(dupes(client, [tmp_path / "one", tmp_path / "two"])) == {frozenset({"a.dat", "b.dat"})}


def test_a_folder_listed_twice_or_inside_another_root_is_not_scanned_twice(client, tmp_path):
    put(tmp_path / "t" / "a.dat", pattern(700, 1))
    put(tmp_path / "t" / "inner" / "b.dat", pattern(700, 2))
    result = dupes(client, [tmp_path / "t", tmp_path / "t" / "inner", tmp_path / "t"])
    assert result["scanned"] == 2
    assert result["groups"] == []


def test_a_symbolic_link_to_a_file_is_not_a_duplicate_of_it(client, tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    put(tmp_path / "t" / "real.dat", pattern(900, 1))
    os.symlink(tmp_path / "t" / "real.dat", tmp_path / "t" / "alias.dat")
    result = dupes(client, [tmp_path / "t"])
    assert result["groups"] == []
    assert result["scanned"] == 1


def test_a_link_to_an_identical_file_outside_the_tree_is_not_paired(client, tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    put(tmp_path / "outside" / "same.dat", pattern(900, 1))
    put(tmp_path / "t" / "mine.dat", pattern(900, 1))
    os.symlink(tmp_path / "outside", tmp_path / "t" / "out", target_is_directory=True)
    assert dupes(client, [tmp_path / "t"])["groups"] == []


@pytest.mark.skipif(os.name == "nt", reason="needs POSIX hard links")
def test_hard_links_to_one_file_hold_no_wasted_space(client, tmp_path):
    put(tmp_path / "t" / "one.dat", pattern(900, 1))
    os.link(tmp_path / "t" / "one.dat", tmp_path / "t" / "two.dat")
    result = dupes(client, [tmp_path / "t"])
    assert result["groups"] == []
    assert result["wasted"] == 0


@pytest.mark.skipif(os.name == "nt", reason="needs POSIX hard links")
def test_hard_links_of_a_copy_are_listed_with_it_and_the_waste_is_one_file(client, tmp_path):
    put(tmp_path / "t" / "one.dat", pattern(900, 1))
    os.link(tmp_path / "t" / "one.dat", tmp_path / "t" / "one-link.dat")
    put(tmp_path / "t" / "copy.dat", pattern(900, 1))
    result = dupes(client, [tmp_path / "t"])
    assert len(result["groups"]) == 1
    assert group_sets(result) == {frozenset({"one.dat", "one-link.dat", "copy.dat"})}
    assert result["groups"][0]["wasted"] == 900


def test_nothing_is_deleted_or_changed_by_a_scan(client, tmp_path):
    for name in ("a", "b"):
        put(tmp_path / "t" / name, pattern(600, 1))
    before = {p.name: p.read_bytes() for p in (tmp_path / "t").iterdir()}
    dupes(client, [tmp_path / "t"])
    assert {p.name: p.read_bytes() for p in (tmp_path / "t").iterdir()} == before


def test_every_listed_file_carries_its_size_and_the_group_key_is_shared_content(client, tmp_path):
    put(tmp_path / "t" / "x1", pattern(1234, 1))
    put(tmp_path / "t" / "x2", pattern(1234, 1))
    put(tmp_path / "t" / "y1", pattern(1234, 2))
    put(tmp_path / "t" / "y2", pattern(1234, 2))
    result = dupes(client, [tmp_path / "t"])
    assert len({group["key"] for group in result["groups"]}) == 2
    for group in result["groups"]:
        assert all(item["size"] == 1234 for item in group["files"])


def test_a_scan_without_roots_is_refused(client):
    reply = client.post("/api/dupes/scan", json={"roots": []})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the request is missing or has a bad value for roots"


def test_a_missing_root_is_refused_with_a_message(client, tmp_path):
    reply = client.post("/api/dupes/scan", json={"roots": [str(tmp_path / "gone")]})
    assert reply.status_code == 404
    assert reply.json()["error"] == "that folder does not exist"


def test_an_unknown_mode_is_refused(client, tmp_path):
    reply = client.post("/api/dupes/scan", json={"roots": [str(tmp_path)], "mode": "fuzzy"})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the request is missing or has a bad value for mode"


def test_the_dupes_tool_refuses_roots_that_are_not_a_list(client):
    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "dupes_scan", "arguments": {"roots": "/tmp"}}})
    result = reply.json()["result"]
    assert result["isError"] is True
    assert result["content"][0]["text"] == "roots must be a list of folder paths"


def gradient(path, size, flip=False):
    image = Image.new("RGB", size)
    width, height = size
    pixels = image.load()
    for x in range(width):
        for y in range(height):
            level = int(255 * (x / (width - 1)))
            pixels[x, y] = (255 - level if flip else level, 40, 90)
    image.save(path)


def blocks(path, size):
    image = Image.new("RGB", size, (250, 250, 250))
    for x in range(size[0]):
        for y in range(size[1]):
            if (x // (size[0] // 4) + y // (size[1] // 4)) % 2 == 0:
                image.putpixel((x, y), (10, 10, 10))
    image.save(path)


def test_similar_images_pairs_a_picture_with_its_smaller_copy_and_not_with_a_different_one(client, tmp_path):
    (tmp_path / "t").mkdir()
    gradient(tmp_path / "t" / "big.png", (256, 192))
    gradient(tmp_path / "t" / "small.png", (128, 96))
    blocks(tmp_path / "t" / "checks.png", (128, 96))
    result = dupes(client, [tmp_path / "t"], mode="similar-images")
    assert result["mode"] == "similar-images"
    assert group_sets(result) == {frozenset({"big.png", "small.png"})}
    names = [item["path"].rsplit(os.sep, 1)[-1] for item in result["groups"][0]["files"]]
    assert names[0] == "big.png"
    assert result["groups"][0]["files"][0]["width"] == 256


def test_similar_images_ignores_files_that_are_not_pictures(client, tmp_path):
    (tmp_path / "t").mkdir()
    gradient(tmp_path / "t" / "a.png", (64, 48))
    put(tmp_path / "t" / "notes.txt", pattern(500, 1))
    put(tmp_path / "t" / "notes2.txt", pattern(500, 1))
    result = dupes(client, [tmp_path / "t"], mode="similar-images")
    assert result["groups"] == []
    assert result["scanned"] == 1
