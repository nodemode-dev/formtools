import os
from concurrent.futures import as_completed

import pytest
from PIL import Image

from .support import contents, make_picture, wait_job


def plan(client, **body):
    return client.post("/api/batch/plan", json=body)


def run(client, **body):
    reply = client.post("/api/batch/run", json=body)
    assert reply.status_code == 200, reply.text
    return wait_job(client, reply.json())


def test_the_plan_lists_pictures_in_natural_order_and_writes_nothing(client, tmp_path):
    for name in ["img10.png", "img2.png", "img1.png"]:
        make_picture(tmp_path / name)
    (tmp_path / "notes.txt").write_text("x")
    out = tmp_path / "out"
    reply = plan(client, inputs=[str(tmp_path)], output={"format": "jpeg", "folder": str(out), "naming": "{name}_{n:3}"}).json()
    assert [os.path.basename(i["src"]) for i in reply["items"]] == ["img1.png", "img2.png", "img10.png"]
    assert [i["dst"] for i in reply["items"]] == [str(out / "img1_001.jpg"), str(out / "img2_002.jpg"), str(out / "img10_003.jpg")]
    assert not out.exists()


def test_the_plan_reports_a_named_file_that_is_missing_or_not_a_picture(client, tmp_path):
    make_picture(tmp_path / "a.png")
    (tmp_path / "notes.txt").write_text("x")
    reply = plan(client, inputs=[str(tmp_path / "a.png"), str(tmp_path / "notes.txt"), str(tmp_path / "gone.png")]).json()
    assert len(reply["items"]) == 1
    assert reply["skipped"] == [
        {"path": str(tmp_path / "notes.txt"), "reason": "not a picture type this run converts"},
        {"path": str(tmp_path / "gone.png"), "reason": "it does not exist"},
    ]


def test_the_plan_never_points_two_pictures_at_one_file(client, tmp_path):
    (tmp_path / "one").mkdir()
    (tmp_path / "two").mkdir()
    make_picture(tmp_path / "one" / "a.png")
    make_picture(tmp_path / "two" / "a.png")
    out = tmp_path / "out"
    reply = plan(client, inputs=[str(tmp_path)], recursive=True, output={"folder": str(out)}).json()
    assert sorted(i["dst"] for i in reply["items"]) == [str(out / "a (2).png"), str(out / "a.png")]
    kept = plan(client, inputs=[str(tmp_path)], recursive=True, output={"folder": str(out), "keep_folders": True}).json()
    assert sorted(i["dst"] for i in kept["items"]) == [str(out / "one" / "a.png"), str(out / "two" / "a.png")]


def test_a_folder_is_only_searched_below_its_top_level_when_asked(client, tmp_path):
    (tmp_path / "deep").mkdir()
    make_picture(tmp_path / "top.png")
    make_picture(tmp_path / "deep" / "low.png")
    flat = plan(client, inputs=[str(tmp_path)]).json()
    assert [os.path.basename(i["src"]) for i in flat["items"]] == ["top.png"]


@pytest.mark.parametrize(
    "output, message",
    [
        ({"naming": "{nope}"}, "the naming template has an unknown token {nope}"),
        ({"naming": "{name"}, "the naming template has an unmatched brace"),
        ({"subfolder": "../up"}, "the subfolder cannot climb out of the destination"),
        ({"folder": "relative/out"}, "the output folder must be an absolute path"),
        ({"overwrite": "maybe"}, "overwrite must be skip, replace or rename"),
    ],
)
def test_a_bad_output_setting_is_refused_with_its_reason(client, tmp_path, output, message):
    make_picture(tmp_path / "a.png")
    reply = plan(client, inputs=[str(tmp_path)], output=output)
    assert reply.status_code == 400
    assert reply.json()["error"] == message


def test_a_run_with_no_pictures_is_refused(client, tmp_path):
    (tmp_path / "notes.txt").write_text("x")
    reply = client.post("/api/batch/run", json={"inputs": [str(tmp_path)]})
    assert reply.status_code == 400
    assert reply.json()["error"] == "there are no pictures to process in those inputs"


def test_a_run_writes_every_picture_and_one_broken_file_does_not_stop_the_others(client, tmp_path):
    src = tmp_path / "in"
    src.mkdir()
    for name in ["a.png", "b.png", "d.png"]:
        make_picture(src / name)
    (src / "c.png").write_bytes(b"this is not a picture")
    before = contents(src)
    out = tmp_path / "out"
    job = run(client, inputs=[str(src)], actions=[{"id": "flip", "params": {"axis": "h"}}], output={"folder": str(out)})
    assert job["state"] == "done"
    assert job["done"] == job["total"] == 4
    assert job["result"]["written"] == 3 and job["result"]["failed"] == 1
    assert sorted(job["result"]["outputs"]) == [str(out / "a.png"), str(out / "b.png"), str(out / "d.png")]
    assert [e["path"] for e in job["errors"]] == [str(src / "c.png")]
    assert sorted(os.listdir(out)) == ["a.png", "b.png", "d.png"]
    assert contents(src) == before
    with Image.open(out / "a.png") as flipped:
        assert flipped.size == (8, 4)
        assert flipped.convert("RGB").getpixel((0, 0)) == (0, 0, 255)
        assert flipped.convert("RGB").getpixel((7, 3)) == (255, 0, 0)


def test_a_chain_of_actions_gives_the_size_and_colours_arithmetic_predicts(client, tmp_path):
    make_picture(tmp_path / "a.png", size=(8, 4), left=(200, 100, 0), right=(200, 100, 0))
    out = tmp_path / "out"
    chain = [
        {"id": "rotate", "params": {"degrees": 90}},
        {"id": "border", "params": {"size": 3, "color": "#00ff00"}},
        {"id": "invert"},
    ]
    job = run(client, inputs=[str(tmp_path / "a.png")], actions=chain, output={"folder": str(out), "naming": "{name}_{width}x{height}"})
    assert job["result"]["written"] == 1
    assert os.listdir(out) == ["a_10x14.png"]
    with Image.open(out / "a_10x14.png") as made:
        rgb = made.convert("RGB")
        assert rgb.size == (10, 14)
        assert rgb.getpixel((0, 0)) == (255, 0, 255)
        assert rgb.getpixel((5, 7)) == (55, 155, 255)


def test_grayscale_makes_every_channel_equal(client, tmp_path):
    make_picture(tmp_path / "a.png")
    out = tmp_path / "out"
    run(client, inputs=[str(tmp_path / "a.png")], actions=[{"id": "grayscale"}], output={"folder": str(out)})
    with Image.open(out / "a.png") as made:
        for spot in [(0, 0), (7, 3)]:
            r, g, b = made.convert("RGB").getpixel(spot)
            assert r == g == b


def test_converting_to_another_format_writes_a_file_an_independent_reader_accepts(client, tmp_path):
    make_picture(tmp_path / "a.png", left=(0, 0, 0), right=(0, 0, 0))
    out = tmp_path / "out"
    job = run(client, inputs=[str(tmp_path / "a.png")], output={"folder": str(out), "format": "bmp"})
    assert job["result"]["outputs"] == [str(out / "a.bmp")]
    data = (out / "a.bmp").read_bytes()
    assert data[:2] == b"BM"
    assert int.from_bytes(data[2:6], "little") == len(data)
    assert int.from_bytes(data[18:22], "little") == 8 and int.from_bytes(data[22:26], "little", signed=True) in (4, -4)


def test_overwrite_skip_leaves_an_existing_file_untouched(client, tmp_path):
    make_picture(tmp_path / "a.png")
    out = tmp_path / "out"
    out.mkdir()
    (out / "a.png").write_bytes(b"already here")
    job = run(client, inputs=[str(tmp_path / "a.png")], output={"folder": str(out), "overwrite": "skip"})
    assert job["result"]["written"] == 0 and job["result"]["skipped"] == 1
    assert (out / "a.png").read_bytes() == b"already here"


def test_overwrite_rename_keeps_the_existing_file_and_writes_beside_it(client, tmp_path):
    src = make_picture(tmp_path / "a.png")
    original = (tmp_path / "a.png").read_bytes()
    job = run(client, inputs=[src], actions=[{"id": "invert"}])
    assert job["result"]["outputs"] == [str(tmp_path / "a (2).png")]
    assert (tmp_path / "a.png").read_bytes() == original
    with Image.open(tmp_path / "a (2).png") as made:
        assert made.convert("RGB").getpixel((0, 0)) == (0, 255, 255)


def test_the_action_list_names_every_action_once_and_a_run_refuses_others(client, tmp_path):
    listed = [a["id"] for a in client.get("/api/batch/actions").json()["actions"]]
    assert len(listed) == len(set(listed))
    assert {"resize", "crop", "rotate", "flip", "grayscale", "watermark-text", "strip-metadata"} <= set(listed)
    make_picture(tmp_path / "a.png")
    reply = client.post("/api/batch/run", json={"inputs": [str(tmp_path)], "actions": [{"id": "explode"}]})
    assert reply.status_code == 400 and reply.json()["error"] == "unknown action explode"
    assert os.listdir(tmp_path) == ["a.png"]


def test_the_worker_pool_finishes_every_job_exactly_once(app):
    from app.tools.batch.pool import runner

    futures = {runner.submit(divmod, number, 7)[0]: number for number in range(40)}
    results = sorted((futures[f], f.result(timeout=40)) for f in as_completed(futures, timeout=40))
    assert results == [(n, (n // 7, n % 7)) for n in range(40)]


def test_the_pool_uses_one_worker_fewer_than_the_processors_and_never_zero(monkeypatch):
    from app.tools.batch import pool

    monkeypatch.setattr(pool.os, "cpu_count", lambda: 8)
    assert pool.worker_count() == 7
    monkeypatch.setattr(pool.os, "cpu_count", lambda: 1)
    assert pool.worker_count() == 1
