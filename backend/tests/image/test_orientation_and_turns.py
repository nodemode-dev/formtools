import pytest
from PIL import Image

from .support import GRID, SHOWN_FOR_ORIENTATION, error_of, flip_h, flip_v, png_bytes, ppm_bytes, read_grid, turn_180, turn_ccw, turn_cw

def info(client, path):
    return client.get("/api/image/info", params={"path": str(path)})


def turn(client, path, op, **more):
    return client.post("/api/image/transform", json={"path": str(path), "op": op, **more})


@pytest.mark.parametrize("orientation", range(1, 9))
def test_the_orientation_tag_decides_how_the_stored_pixels_are_shown(client, tmp_path, orientation):
    path = tmp_path / "tagged.png"
    path.write_bytes(png_bytes(GRID, orientation))
    shown = SHOWN_FOR_ORIENTATION[orientation](GRID)
    found = info(client, path).json()
    assert (found["width"], found["height"], found["orientation"]) == (len(shown[0]), len(shown), orientation)
    out = client.post("/api/image/edit", json={"path": str(path), "ops": [{"op": "flip", "axis": "h"}, {"op": "flip", "axis": "h"}]}).json()["path"]
    assert read_grid(out) == shown
    with Image.open(out) as image:
        assert image.getexif().get(0x0112, 1) == 1


@pytest.mark.parametrize(
    "op,geometry",
    [("rotate-cw", turn_cw), ("rotate-ccw", turn_ccw), ("rotate-180", turn_180), ("flip-h", flip_h), ("flip-v", flip_v)],
)
def test_turning_a_png_in_place_moves_the_pixels_where_geometry_says(client, tmp_path, op, geometry):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    reply = turn(client, path, op).json()
    assert reply == {"ok": True, "lossless_used": True, "path": str(path)}
    assert read_grid(path) == geometry(GRID)
    assert sorted(p.name for p in tmp_path.iterdir()) == ["six.png"]


def test_turning_a_tagged_png_applies_the_tag_first_and_resets_it(client, tmp_path):
    path = tmp_path / "tagged.png"
    path.write_bytes(png_bytes(GRID, 6))
    turn(client, path, "rotate-cw")
    assert read_grid(path) == turn_180(GRID)
    assert info(client, path).json()["orientation"] == 1


def test_a_clockwise_then_a_counterclockwise_turn_gives_back_the_picture(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    turn(client, path, "rotate-cw")
    turn(client, path, "rotate-ccw")
    assert read_grid(path) == GRID


@pytest.mark.parametrize("op,tag", [("rotate-cw", 6), ("rotate-ccw", 8), ("rotate-180", 3), ("flip-h", 2), ("flip-v", 4)])
def test_a_lossless_jpeg_turn_only_writes_the_orientation_tag(client, tmp_path, op, tag):
    path = tmp_path / "photo.jpg"
    Image.new("RGB", (16, 8), (200, 40, 40)).save(path, "JPEG", quality=90)
    before = path.read_bytes()
    reply = turn(client, path, op).json()
    assert reply["lossless_used"] is True
    after = path.read_bytes()
    scan = before[before.index(b"\xff\xda") :]
    assert after.endswith(scan)
    with Image.open(path) as image:
        assert image.getexif()[0x0112] == tag
        assert image.size == (16, 8)
    found = info(client, path).json()
    assert (found["width"], found["height"]) == ((8, 16) if tag in (6, 8) else (16, 8))


def test_two_lossless_quarter_turns_of_a_jpeg_make_a_half_turn_tag(client, tmp_path):
    path = tmp_path / "photo.jpg"
    Image.new("RGB", (16, 8), (200, 40, 40)).save(path, "JPEG")
    turn(client, path, "rotate-cw")
    turn(client, path, "rotate-cw")
    with Image.open(path) as image:
        assert image.getexif()[0x0112] == 3
    turn(client, path, "rotate-180")
    with Image.open(path) as image:
        assert image.getexif()[0x0112] == 1


def test_a_jpeg_turn_without_lossless_rewrites_the_pixels_at_the_new_size(client, tmp_path):
    path = tmp_path / "photo.jpg"
    Image.new("RGB", (16, 8), (200, 40, 40)).save(path, "JPEG", quality=95)
    reply = turn(client, path, "rotate-cw", lossless=False).json()
    assert reply["lossless_used"] is False
    with Image.open(path) as image:
        assert image.size == (8, 16)
        assert all(abs(a - b) <= 4 for a, b in zip(image.getpixel((4, 8)), (200, 40, 40)))


def test_a_ppm_is_view_only_and_is_left_alone(client, tmp_path):
    path = tmp_path / "raw.ppm"
    path.write_bytes(ppm_bytes(GRID))
    before = path.read_bytes()
    reply = turn(client, path, "rotate-cw")
    assert error_of(reply) == (415, "formtools can turn JPEG, PNG, WebP, GIF, BMP and TIFF files; other formats are view-only")
    assert path.read_bytes() == before


def test_turning_a_text_file_is_refused_and_the_file_is_left_alone(client, tmp_path):
    path = tmp_path / "notes.jpg"
    path.write_text("not a picture")
    assert error_of(turn(client, path, "flip-h")) == (415, "formtools cannot read that file as a picture")
    assert path.read_text() == "not a picture"


def test_turning_a_missing_file_is_refused(client, tmp_path):
    assert error_of(turn(client, tmp_path / "gone.png", "flip-h")) == (404, "that file does not exist")


def test_turning_a_folder_is_refused(client, tmp_path):
    assert error_of(turn(client, tmp_path, "flip-h")) == (400, "that path is not a file")


def test_an_unknown_turn_is_refused(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    reply = turn(client, path, "rotate-45")
    assert error_of(reply) == (400, "the request is missing or has a bad value for op")
    assert read_grid(path) == GRID
