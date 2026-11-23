import pytest
from PIL import Image

from .support import A, B, C, D, E, F, GRID, close, error_of, flip_h, flip_v, png_bytes, ppm_bytes, read_grid, turn_180, turn_ccw, turn_cw


@pytest.fixture
def picture(tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    return path


def edit(client, path, ops, **more):
    return client.post("/api/image/edit", json={"path": str(path), "ops": ops, **more})


@pytest.mark.parametrize(
    "step,geometry",
    [
        ({"op": "rotate", "degrees": 90}, turn_cw),
        ({"op": "rotate", "degrees": 180}, turn_180),
        ({"op": "rotate", "degrees": 270}, turn_ccw),
        ({"op": "flip", "axis": "h"}, flip_h),
        ({"op": "flip", "axis": "v"}, flip_v),
    ],
    ids=["quarter turn clockwise", "half turn", "three quarter turn clockwise", "mirror left to right", "mirror top to bottom"],
)
def test_edit_moves_every_pixel_where_geometry_says(client, picture, step, geometry):
    reply = edit(client, picture, [step]).json()
    assert read_grid(reply["path"]) == geometry(GRID)


def test_a_quarter_turn_of_a_3_by_2_picture_is_2_wide_and_3_high_with_the_bottom_left_pixel_on_top(client, picture):
    out = edit(client, picture, [{"op": "rotate", "degrees": 90}]).json()["path"]
    assert read_grid(out) == [[D, A], [E, B], [F, C]]


def test_crop_keeps_exactly_the_pixels_inside_the_box(client, picture):
    out = edit(client, picture, [{"op": "crop", "x": 1, "y": 0, "w": 2, "h": 2}]).json()["path"]
    assert read_grid(out) == [[B, C], [E, F]]


def test_steps_run_in_the_order_given(client, picture):
    out = edit(client, picture, [{"op": "crop", "x": 0, "y": 0, "w": 2, "h": 1}, {"op": "flip", "axis": "h"}]).json()["path"]
    assert read_grid(out) == [[B, A]]


def test_four_quarter_turns_give_back_the_original_pixels(client, picture):
    out = edit(client, picture, [{"op": "rotate", "degrees": 90}] * 4).json()["path"]
    assert read_grid(out) == GRID


def test_nearest_resize_to_double_size_repeats_each_pixel_in_a_2_by_2_block(client, picture):
    out = edit(client, picture, [{"op": "resize", "width": 6, "height": 4, "resample": "nearest"}]).json()["path"]
    assert read_grid(out) == [[GRID[y // 2][x // 2] for x in range(6)] for y in range(4)]


def test_resize_with_only_a_width_keeps_the_3_to_2_shape(client, tmp_path):
    path = tmp_path / "flat.png"
    path.write_bytes(png_bytes([[F] * 3] * 2))
    out = edit(client, path, [{"op": "resize", "width": 9}]).json()["path"]
    grid = read_grid(out)
    assert (len(grid[0]), len(grid)) == (9, 6)
    assert close(grid, [[F] * 9] * 6, 0)


def test_resize_with_only_a_height_keeps_the_3_to_2_shape(client, picture):
    out = edit(client, picture, [{"op": "resize", "height": 8, "resample": "nearest"}]).json()["path"]
    with Image.open(out) as image:
        assert image.size == (12, 8)


def test_shrinking_a_single_colour_picture_keeps_that_colour(client, tmp_path):
    path = tmp_path / "flat.png"
    path.write_bytes(png_bytes([[F] * 8] * 8))
    out = edit(client, path, [{"op": "resize", "width": 2, "height": 2}]).json()["path"]
    assert read_grid(out) == [[F, F], [F, F]]


def test_a_crop_box_outside_the_picture_is_refused_with_the_picture_size(client, picture):
    reply = edit(client, picture, [{"op": "crop", "x": 2, "y": 0, "w": 2, "h": 1}])
    assert error_of(reply) == (400, "the crop box falls outside the 3 by 2 picture")
    assert not (picture.parent / "six edited.png").exists()


def test_a_crop_box_with_no_width_is_refused(client, picture):
    reply = edit(client, picture, [{"op": "crop", "x": 0, "y": 0, "w": 0, "h": 1}])
    assert error_of(reply) == (400, "the crop box needs a width and height of at least 1 pixel")


def test_resize_without_a_width_or_height_is_refused(client, picture):
    assert error_of(edit(client, picture, [{"op": "resize"}])) == (400, "resize needs a width, a height or both")


def test_resize_past_65535_pixels_is_refused(client, picture):
    assert error_of(edit(client, picture, [{"op": "resize", "width": 65536}])) == (400, "resize sizes must be between 1 and 65535 pixels")


def test_an_edit_with_no_steps_is_refused(client, picture):
    assert error_of(edit(client, picture, [])) == (400, "ops needs at least one step")


def test_a_turn_that_is_not_a_quarter_turn_is_refused(client, picture):
    reply = edit(client, picture, [{"op": "rotate", "degrees": 45}])
    assert reply.status_code == 400 and reply.json()["ok"] is False
    assert list(picture.parent.iterdir()) == [picture]


def test_the_edit_is_saved_beside_the_original_and_the_original_is_untouched(client, picture):
    before = picture.read_bytes()
    first = edit(client, picture, [{"op": "flip", "axis": "h"}]).json()["path"]
    second = edit(client, picture, [{"op": "flip", "axis": "v"}]).json()["path"]
    assert first == str(picture.parent / "six edited.png")
    assert second == str(picture.parent / "six edited (2).png")
    assert picture.read_bytes() == before
    assert read_grid(first) == flip_h(GRID) and read_grid(second) == flip_v(GRID)


def test_an_existing_output_file_is_kept_unless_overwrite_is_set(client, picture, tmp_path):
    taken = tmp_path / "taken.png"
    taken.write_bytes(png_bytes([[A]]))
    step = [{"op": "flip", "axis": "h"}]
    refused = edit(client, picture, step, out={"path": str(taken)})
    assert error_of(refused) == (400, "a file with that name already exists; set overwrite to true to replace it")
    assert read_grid(taken) == [[A]]
    assert edit(client, picture, step, out={"path": str(taken)}, overwrite=True).status_code == 200
    assert read_grid(taken) == flip_h(GRID)


def test_replacing_the_original_needs_overwrite(client, picture):
    before = picture.read_bytes()
    reply = edit(client, picture, [{"op": "flip", "axis": "h"}], out={"path": str(picture)})
    assert error_of(reply) == (400, "that would replace the original; set overwrite to true and give the same out.path to confirm")
    assert picture.read_bytes() == before
    assert edit(client, picture, [{"op": "flip", "axis": "h"}], out={"path": str(picture)}, overwrite=True).status_code == 200
    assert read_grid(picture) == flip_h(GRID)


def test_an_output_name_that_disagrees_with_the_format_is_refused(client, picture, tmp_path):
    reply = edit(client, picture, [{"op": "flip", "axis": "h"}], out={"path": str(tmp_path / "x.png"), "format": "jpeg"})
    assert error_of(reply) == (400, "the output file extension does not match the output format")


def test_an_output_name_with_an_unknown_ending_is_refused(client, picture, tmp_path):
    reply = edit(client, picture, [{"op": "flip", "axis": "h"}], out={"path": str(tmp_path / "x.bmp")})
    assert error_of(reply) == (400, "the output path must end in .jpg, .png, .webp, .avif or .tiff, or out.format must be set")


def test_an_output_folder_that_does_not_exist_is_refused(client, picture, tmp_path):
    reply = edit(client, picture, [{"op": "flip", "axis": "h"}], out={"path": str(tmp_path / "nowhere" / "x.png")})
    assert error_of(reply) == (400, "the output folder does not exist")


def test_a_missing_source_is_refused(client, tmp_path):
    assert error_of(edit(client, tmp_path / "gone.png", [{"op": "flip", "axis": "h"}])) == (404, "that file does not exist")


def test_a_text_file_named_like_a_picture_is_refused_and_nothing_is_written(client, tmp_path):
    path = tmp_path / "notes.png"
    path.write_text("this is not a picture")
    reply = edit(client, path, [{"op": "flip", "axis": "h"}])
    assert error_of(reply) == (415, "formtools cannot decode that file as a picture")
    assert list(tmp_path.iterdir()) == [path]


@pytest.mark.parametrize("fmt,ending,file_format", [("png", "png", "PNG"), ("tiff", "tiff", "TIFF")])
def test_converting_to_a_lossless_format_keeps_every_pixel(client, picture, fmt, ending, file_format):
    out = edit(client, picture, [{"op": "flip", "axis": "h"}, {"op": "flip", "axis": "h"}], out={"format": fmt}).json()["path"]
    assert out.endswith("six edited." + ending)
    with Image.open(out) as image:
        assert image.format == file_format
    assert read_grid(out) == GRID


@pytest.mark.parametrize("fmt,ending,file_format", [("jpeg", "jpg", "JPEG"), ("webp", "webp", "WEBP")])
def test_converting_a_single_colour_picture_to_a_lossy_format_stays_within_a_few_levels(client, tmp_path, fmt, ending, file_format):
    path = tmp_path / "flat.png"
    path.write_bytes(png_bytes([[F] * 16] * 16))
    out = edit(client, path, [{"op": "rotate", "degrees": 180}], out={"format": fmt}).json()["path"]
    assert out.endswith("flat edited." + ending)
    with Image.open(out) as image:
        assert image.format == file_format and image.size == (16, 16)
    assert close(read_grid(out), [[F] * 16] * 16, 4)


def test_a_ppm_source_is_saved_as_png_with_the_same_pixels(client, tmp_path):
    path = tmp_path / "raw.ppm"
    path.write_bytes(ppm_bytes(GRID))
    out = edit(client, path, [{"op": "rotate", "degrees": 90}]).json()["path"]
    assert out == str(tmp_path / "raw edited.png")
    assert read_grid(out) == turn_cw(GRID)


def test_see_through_pixels_survive_in_png_and_turn_white_in_jpeg(client, tmp_path):
    path = tmp_path / "glass.png"
    clear, solid = (10, 20, 30, 0), (10, 20, 30, 255)
    path.write_bytes(png_bytes([[clear] * 8 + [solid] * 8] * 16))
    step = [{"op": "flip", "axis": "v"}]
    kept = edit(client, path, step, out={"format": "png"}).json()["path"]
    assert read_grid(kept) == [[clear] * 8 + [solid] * 8] * 16
    flat = read_grid(edit(client, path, step, out={"format": "jpeg", "quality": 100}).json()["path"])
    assert all(abs(v - 255) <= 4 for v in flat[8][1]) and all(abs(a - b) <= 4 for a, b in zip(flat[8][14], (10, 20, 30)))
