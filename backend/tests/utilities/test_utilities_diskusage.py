import json
import os

import pytest

from .support import can_link, disk, finish, pattern, put


def build_tree(root):
    sizes = {"a.txt": 10, "b.bin": 4096, "sub/c.jpg": 777, "sub/deep/d.mp4": 100000, "sub/deep/e.py": 1, "empty.dat": 0, "other/f.zip": 2048}
    for name, size in sizes.items():
        put(root / name, pattern(size, size))
    return sizes


def test_disk_usage_total_equals_the_sum_of_the_file_sizes(client, tmp_path):
    sizes = build_tree(tmp_path / "t")
    result = disk(client, tmp_path / "t")
    assert result["size"] == sum(sizes.values())
    assert result["files"] == len(sizes)
    assert result["stats"]["apparent"] == sum(sizes.values())


def test_disk_usage_counts_folders_beneath_the_root(client, tmp_path):
    build_tree(tmp_path / "t")
    result = disk(client, tmp_path / "t")
    assert result["dirs"] == 3
    assert result["stats"]["folders"] == 3


def test_every_folder_size_is_the_sum_of_what_is_inside_it(client, tmp_path):
    sizes = build_tree(tmp_path / "t")
    result = disk(client, tmp_path / "t")
    by_name = {child["name"]: child for child in result["children"]}
    assert by_name["sub"]["size"] == 777 + 100000 + 1
    assert by_name["other"]["size"] == 2048
    deep = {child["name"]: child for child in by_name["sub"]["children"]}["deep"]
    assert deep["size"] == 100001
    assert by_name["b.bin"]["size"] == sizes["b.bin"]


def test_children_sizes_add_up_to_the_parent(client, tmp_path):
    build_tree(tmp_path / "t")
    result = disk(client, tmp_path / "t")

    def check(node):
        if node.get("children"):
            assert sum(c["size"] for c in node["children"]) == node["size"]
            for child in node["children"]:
                check(child)

    check(result)


def test_disk_usage_by_type_groups_files_by_extension_category(client, tmp_path):
    build_tree(tmp_path / "t")
    types = {row["category"]: row for row in disk(client, tmp_path / "t")["stats"]["by_type"]}
    assert types["video"]["bytes"] == 100000
    assert types["images"]["bytes"] == 777
    assert types["archives"]["bytes"] == 2048
    assert types["code"]["bytes"] == 1
    assert types["video"]["files"] == 1
    assert sum(row["bytes"] for row in types.values()) == 10 + 4096 + 777 + 100000 + 1 + 2048


def test_disk_usage_names_the_largest_files_biggest_first(client, tmp_path):
    build_tree(tmp_path / "t")
    largest = disk(client, tmp_path / "t")["stats"]["largest"]
    assert [item["size"] for item in largest[:3]] == [100000, 4096, 2048]
    assert largest[0]["path"].endswith("d.mp4")
    assert [item["size"] for item in largest] == sorted((item["size"] for item in largest), reverse=True)


def test_disk_usage_of_an_empty_folder_is_zero(client, tmp_path):
    (tmp_path / "void").mkdir()
    result = disk(client, tmp_path / "void")
    assert result["size"] == 0 and result["files"] == 0
    assert result["stats"]["average_file"] == 0
    assert result["stats"]["newest"] is None


def test_average_file_size_is_total_divided_by_file_count(client, tmp_path):
    for index, size in enumerate((100, 200, 600)):
        put(tmp_path / "t" / f"f{index}.dat", pattern(size, index))
    assert disk(client, tmp_path / "t")["stats"]["average_file"] == 300


def test_hidden_files_are_left_out_unless_asked_for(client, tmp_path):
    put(tmp_path / "t" / "seen.txt", b"x" * 50)
    put(tmp_path / "t" / ".secret", b"y" * 70)
    put(tmp_path / "t" / ".cfg" / "inner.txt", b"z" * 90)
    assert disk(client, tmp_path / "t")["size"] == 50
    assert disk(client, tmp_path / "t", include_hidden=True)["size"] == 210


@pytest.mark.skipif(os.name == "nt", reason="needs POSIX hard links")
def test_a_hard_link_is_counted_once(client, tmp_path):
    put(tmp_path / "t" / "one.bin", pattern(5000, 1))
    os.link(tmp_path / "t" / "one.bin", tmp_path / "t" / "two.bin")
    result = disk(client, tmp_path / "t")
    assert result["size"] == 5000
    assert result["stats"]["hardlinks_counted_once"] == 1


def test_a_link_leading_out_of_the_tree_is_not_followed(client, tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    put(tmp_path / "outside" / "big.bin", pattern(90000, 3))
    put(tmp_path / "t" / "real.txt", b"r" * 40)
    os.symlink(tmp_path / "outside" / "big.bin", tmp_path / "t" / "file-link")
    os.symlink(tmp_path / "outside", tmp_path / "t" / "dir-link", target_is_directory=True)
    result = disk(client, tmp_path / "t")
    assert result["size"] == 40
    assert result["files"] == 1


def test_a_link_pointing_back_up_does_not_make_the_scan_loop(client, tmp_path):
    if not can_link(tmp_path):
        pytest.skip("this system does not allow symbolic links here")
    put(tmp_path / "t" / "a" / "x.txt", b"x" * 33)
    os.symlink(tmp_path / "t", tmp_path / "t" / "a" / "loop", target_is_directory=True)
    result = disk(client, tmp_path / "t")
    assert result["size"] == 33
    assert result["dirs"] == 1


def test_a_folder_with_more_than_sixty_children_folds_the_rest_into_other(client, tmp_path):
    total = 0
    for index in range(75):
        size = index + 1
        total += size
        put(tmp_path / "t" / f"f{index:02}.dat", pattern(size, index))
    result = disk(client, tmp_path / "t")
    assert result["size"] == total
    assert len(result["children"]) == 61
    other = result["children"][-1]
    assert other["other"] is True
    assert other["name"] == "Other (15 items)"
    assert other["size"] == sum(range(1, 16))
    assert sum(child["size"] for child in result["children"]) == total
    assert {child["size"] for child in result["children"][:-1]} == set(range(16, 76))


def test_a_tree_deeper_than_eight_levels_still_totals_every_byte(client, tmp_path):
    folder = tmp_path / "t"
    expected = 0
    for depth in range(12):
        folder = folder / f"d{depth}"
        put(folder / "leaf.txt", pattern(depth + 1, depth))
        expected += depth + 1
    result = disk(client, tmp_path / "t")
    assert result["size"] == expected
    assert result["files"] == 12
    assert result["dirs"] == 12


def test_a_folder_named_like_a_cache_counts_its_files_as_system(client, tmp_path):
    put(tmp_path / "t" / "node_modules" / "pkg" / "index.js", b"j" * 300)
    put(tmp_path / "t" / "readme.txt", b"r" * 20)
    types = {row["category"]: row["bytes"] for row in disk(client, tmp_path / "t")["stats"]["by_type"]}
    assert types == {"system": 300, "documents": 20}


def test_a_file_without_extension_is_named_by_its_well_known_name(client, tmp_path):
    put(tmp_path / "t" / "Makefile", b"all:\n" * 4)
    put(tmp_path / "t" / "LICENSE", b"l" * 30)
    put(tmp_path / "t" / "mystery", b"m" * 7)
    types = {row["category"]: row["bytes"] for row in disk(client, tmp_path / "t")["stats"]["by_type"]}
    assert types == {"code": 20, "documents": 30, "other": 7}


def test_disk_usage_of_a_missing_folder_is_refused_with_a_message(client, tmp_path):
    reply = client.post("/api/diskusage/scan", json={"root": str(tmp_path / "nowhere")})
    assert reply.status_code == 404
    assert reply.json()["error"] == "that folder does not exist"


def test_disk_usage_of_a_file_is_refused_with_a_message(client, tmp_path):
    put(tmp_path / "plain.txt", b"x")
    reply = client.post("/api/diskusage/scan", json={"root": str(tmp_path / "plain.txt")})
    assert reply.status_code == 400
    assert reply.json()["error"] == "that path is not a folder"


def test_disk_usage_of_a_relative_path_is_refused(client):
    reply = client.post("/api/diskusage/scan", json={"root": "relative/dir"})
    assert reply.status_code == 400
    assert reply.json()["error"] == "the path must be absolute"


def test_the_disk_usage_tool_reports_the_same_total_as_the_route(client, tmp_path):
    sizes = build_tree(tmp_path / "t")
    reply = client.post("/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "disk_usage", "arguments": {"root": str(tmp_path / "t")}}})
    started = reply.json()["result"]["content"][0]["text"]
    job = finish(client, json.loads(started))
    assert job["result"]["size"] == sum(sizes.values())


def test_allocated_space_is_never_less_than_zero_and_covers_nonempty_files(client, tmp_path):
    put(tmp_path / "t" / "a.dat", pattern(10, 1))
    stats = disk(client, tmp_path / "t")["stats"]
    assert stats["apparent"] == 10
    assert stats["allocated"] >= 10
