import math
import xml.etree.ElementTree as ET

import numpy as np
import pytest
from PIL import Image

from .support import A, B, F, GRID, aces, close, error_of, grey16_png_bytes, hdr_bytes, hdr_run_length_bytes, png_bytes, ppm_bytes, read_grid, rgbe_value, srgb8

XMP_NS = "http://ns.adobe.com/xap/1.0/"
HAND_XMP = (
    '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">'
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmp:Rating="3" xmp:Label="Blue"/>'
    "</rdf:RDF></x:xmpmeta>"
)


def info(client, path):
    return client.get("/api/image/info", params={"path": str(path)})


def stored(sidecar, name):
    root = ET.fromstring(sidecar.read_bytes())
    for element in root.iter():
        if element.tag == "{%s}%s" % (XMP_NS, name):
            return element.text
        value = element.get("{%s}%s" % (XMP_NS, name))
        if value is not None:
            return value
    return None


def edited(client, path):
    reply = client.post("/api/image/edit", json={"path": str(path), "ops": [{"op": "flip", "axis": "h"}, {"op": "flip", "axis": "h"}]})
    assert reply.status_code == 200, reply.text
    return read_grid(reply.json()["path"])


def test_info_reports_the_size_format_and_depth_written_in_a_png_header(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    found = info(client, path).json()
    assert (found["width"], found["height"], found["format"], found["mode"], found["bit_depth"]) == (3, 2, "PNG", "RGB", 8)
    assert found["has_alpha"] is False and found["frames"] == 1 and found["animated"] is False
    assert found["size"] == len(png_bytes(GRID))
    assert found["gps"] is None and found["xmp"]["rating"] in (0, None)


def test_info_reports_alpha_for_a_png_with_an_alpha_channel(client, tmp_path):
    path = tmp_path / "glass.png"
    path.write_bytes(png_bytes([[(1, 2, 3, 0), (1, 2, 3, 255)]]))
    found = info(client, path).json()
    assert (found["width"], found["height"], found["has_alpha"], found["mode"]) == (2, 1, True, "RGBA")


def test_info_reports_16_bits_for_a_16_bit_grey_png(client, tmp_path):
    path = tmp_path / "deep.png"
    path.write_bytes(grey16_png_bytes([[0, 0x8000, 0xFFFF]]))
    found = info(client, path).json()
    assert (found["width"], found["height"], found["bit_depth"]) == (3, 1, 16)


def test_a_16_bit_grey_png_is_shown_at_the_nearest_8_bit_level(client, tmp_path):
    path = tmp_path / "deep.png"
    path.write_bytes(grey16_png_bytes([[0, 0x8000, 0xFFFF, 257 * 77]]))
    assert edited(client, path) == [[(0, 0, 0), (128, 128, 128), (255, 255, 255), (77, 77, 77)]]


def test_info_reads_a_ppm_written_by_hand(client, tmp_path):
    path = tmp_path / "raw.ppm"
    path.write_bytes(ppm_bytes(GRID))
    found = info(client, path).json()
    assert (found["width"], found["height"], found["format"]) == (3, 2, "PPM")


def test_info_reads_latitude_and_longitude_as_signed_degrees(client, tmp_path):
    path = tmp_path / "place.jpg"
    exif = Image.Exif()
    exif[0x8825] = {1: "N", 2: (40.0, 30.0, 0.0), 3: "W", 4: (74.0, 15.0, 0.0)}
    Image.new("RGB", (8, 8), F).save(path, "JPEG", exif=exif)
    gps = info(client, path).json()["gps"]
    assert gps["lat"] == pytest.approx(40.5) and gps["lon"] == pytest.approx(-74.25)


@pytest.mark.parametrize(
    "name,content,status,message",
    [
        ("notes.png", b"plain words", 415, "formtools cannot read that file as a picture"),
        ("empty.jpg", b"", 415, "formtools cannot read that file as a picture"),
        ("drawing.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", 415, "SVG pictures are shown by the window itself"),
        ("photo.jxl", b"\xff\x0a", 415, "JPEG XL has no cleared decoder in this build"),
        ("sky.hdr", b"plain words\n", 415, "that file is not a Radiance HDR picture"),
        ("sky2.hdr", b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n", 415, "the Radiance HDR header is cut short"),
        ("sky3.hdr", b"#?RADIANCE\n\n+X 2 -Y 2\n", 415, "rotated Radiance HDR layouts are not supported"),
        ("sky4.hdr", b"#?RADIANCE\n\nsize 2 by 2\n", 415, "the Radiance HDR size line is not understood"),
    ],
)
def test_info_refuses_a_file_that_is_not_a_readable_picture(client, tmp_path, name, content, status, message):
    path = tmp_path / name
    path.write_bytes(content)
    assert error_of(info(client, path)) == (status, message)


def test_info_refuses_a_missing_file_and_a_folder(client, tmp_path):
    assert error_of(info(client, tmp_path / "gone.png")) == (404, "that file does not exist")
    assert error_of(info(client, tmp_path)) == (400, "that path is not a file")


def test_a_rating_and_label_go_into_a_sidecar_and_the_picture_is_not_changed(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    reply = client.post("/api/meta/write", json={"path": str(path), "rating": 4, "label": "red"}).json()
    assert (reply["rating"], reply["label"]) == (4, "red")
    assert path.read_bytes() == png_bytes(GRID)
    sidecar = tmp_path / "six.png.xmp"
    assert stored(sidecar, "Rating") == "4" and stored(sidecar, "Label") == "Red"
    read = client.post("/api/meta/read", json={"paths": [str(path)]}).json()["items"][str(path)]
    assert (read["rating"], read["label"]) == (4, "red")
    found = info(client, path).json()["xmp"]
    assert (found["rating"], found["label"]) == (4, "red")


def test_a_rating_of_0_and_a_null_label_remove_them_again(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    client.post("/api/meta/write", json={"path": str(path), "rating": 5, "label": "green"})
    reply = client.post("/api/meta/write", json={"path": str(path), "rating": 0, "label": None}).json()
    assert (reply["rating"], reply["label"]) == (0, None)
    read = client.post("/api/meta/read", json={"paths": [str(path)]}).json()["items"][str(path)]
    assert (read["rating"], read["label"]) == (0, None)
    assert stored(tmp_path / "six.png.xmp", "Rating") in ("0", None)


def test_setting_only_the_label_keeps_the_rating(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    client.post("/api/meta/write", json={"path": str(path), "rating": 2})
    reply = client.post("/api/meta/write", json={"path": str(path), "label": "purple"}).json()
    assert (reply["rating"], reply["label"]) == (2, "purple")


def test_a_sidecar_written_by_hand_is_read(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    (tmp_path / "six.xmp").write_text(HAND_XMP, encoding="utf-8")
    read = client.post("/api/meta/read", json={"paths": [str(path), str(tmp_path / "gone.png")]}).json()["items"]
    assert (read[str(path)]["rating"], read[str(path)]["label"]) == (3, "blue")
    assert read[str(tmp_path / "gone.png")] == {"rating": 0, "label": None}


@pytest.mark.parametrize(
    "body,message",
    [
        ({"rating": 6}, "rating must be a whole number from 0 to 5"),
        ({"rating": -1}, "rating must be a whole number from 0 to 5"),
        ({"label": "pink"}, "label must be red, orange, yellow, green, blue, purple, grey or null"),
    ],
)
def test_a_bad_rating_or_label_is_refused_and_no_sidecar_appears(client, tmp_path, body, message):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    assert error_of(client.post("/api/meta/write", json={"path": str(path), **body})) == (400, message)
    assert [p.name for p in tmp_path.iterdir()] == ["six.png"]


def test_a_sidecar_that_is_not_xmp_is_left_alone(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    sidecar = tmp_path / "six.png.xmp"
    sidecar.write_text("<notes>mine</notes>", encoding="utf-8")
    reply = client.post("/api/meta/write", json={"path": str(path), "rating": 1})
    assert reply.status_code == 400 and "left it alone" in reply.json()["error"]
    assert sidecar.read_text(encoding="utf-8") == "<notes>mine</notes>"


def test_hdr_info_reports_the_size_on_the_size_line(client, tmp_path):
    path = tmp_path / "sky.hdr"
    path.write_bytes(hdr_bytes([[(128, 128, 128, 128)] * 3] * 2))
    found = info(client, path).json()
    assert (found["width"], found["height"], found["format"], found["bit_depth"]) == (3, 2, "HDR", 32)


def test_radiance_values_up_to_1_are_shown_with_the_srgb_curve(client, tmp_path):
    path = tmp_path / "dim.hdr"
    rows = [[(127, 127, 127, 128), (0, 0, 0, 0)], [(63, 127, 255, 128), (127, 127, 127, 126)]]
    path.write_bytes(hdr_bytes(rows))
    wanted = [[tuple(srgb8(rgbe_value(m, p[3])) for m in p[:3]) for p in row] for row in rows]
    assert wanted[0][1] == (0, 0, 0) and wanted[0][0] == (187, 187, 187)
    assert close(edited(client, path), wanted, 1)


@pytest.mark.parametrize("mantissa,exponent", [(127, 130), (180, 130)])
def test_a_bright_grey_radiance_picture_is_exposed_to_middle_grey_then_filmic_mapped(client, tmp_path, mantissa, exponent):
    path = tmp_path / "bright.hdr"
    path.write_bytes(hdr_bytes([[(mantissa, mantissa, mantissa, exponent)] * 4] * 4))
    assert rgbe_value(mantissa, exponent) > 1.0
    level = srgb8(aces(0.18))
    assert close(edited(client, path), [[(level, level, level)] * 4] * 4, 1)


def test_a_very_bright_radiance_picture_is_darkened_by_at_most_four_stops(client, tmp_path):
    path = tmp_path / "sun.hdr"
    path.write_bytes(hdr_bytes([[(127, 127, 127, 133)] * 4] * 4))
    level = srgb8(aces(rgbe_value(127, 133) / 16.0))
    assert close(edited(client, path), [[(level, level, level)] * 4] * 4, 1)


def test_a_bright_two_level_radiance_picture_follows_exposure_from_the_geometric_mean(client, tmp_path):
    path = tmp_path / "two.hdr"
    low, high = (127, 127, 127, 130), (127, 127, 127, 134)
    path.write_bytes(hdr_bytes([[low, high]] * 2))
    values = [rgbe_value(127, 130), rgbe_value(127, 134)]
    exposure = min(16.0, max(0.0625, 0.18 / math.sqrt(values[0] * values[1])))
    wanted = [[(srgb8(aces(v * exposure)),) * 3 for v in values]] * 2
    assert close(edited(client, path), wanted, 1)


def test_a_bottom_up_radiance_picture_is_shown_top_row_last(client, tmp_path):
    path = tmp_path / "up.hdr"
    dark, light = (0, 0, 0, 0), (255, 255, 255, 128)
    path.write_bytes(hdr_bytes([[dark, dark], [light, light]], size_line=b"+Y 2 +X 2"))
    assert edited(client, path) == [[(255, 255, 255)] * 2, [(0, 0, 0)] * 2]


def test_a_right_to_left_radiance_picture_is_mirrored(client, tmp_path):
    path = tmp_path / "back.hdr"
    dark, light = (0, 0, 0, 0), (255, 255, 255, 128)
    path.write_bytes(hdr_bytes([[dark, light]], size_line=b"-Y 1 -X 2"))
    assert edited(client, path) == [[(255, 255, 255), (0, 0, 0)]]


def test_run_length_and_flat_radiance_files_of_the_same_pixels_decode_alike(client, tmp_path):
    rows = [[(127, 127, 127, 128)] * 4 + [(63, 63, 63, 127)] * 4, [(255, 0, 0, 128)] * 8]
    flat, packed = tmp_path / "flat.hdr", tmp_path / "packed.hdr"
    flat.write_bytes(hdr_bytes(rows))
    packed.write_bytes(hdr_run_length_bytes(rows))
    assert packed.read_bytes() != flat.read_bytes()
    wanted = [[tuple(srgb8(rgbe_value(m, p[3])) for m in p[:3]) for p in row] for row in rows]
    assert close(edited(client, packed), wanted, 1)
    assert edited(client, packed) == edited(client, flat)


def test_a_radiance_file_with_missing_pixels_is_refused(client, tmp_path):
    path = tmp_path / "short.hdr"
    path.write_bytes(hdr_bytes([[(127, 127, 127, 128)] * 2] * 2)[:-5])
    reply = client.get("/api/image/view", params={"path": str(path)})
    assert error_of(reply) == (415, "the Radiance HDR pixel data is cut short")


def test_tonemap_maps_display_range_values_through_the_srgb_curve_and_keeps_alpha():
    from app.tools.image.tonemap import tonemap

    linear = np.array([[[0.0, 0.5, 1.0, 0.25], [float("nan"), 0.0031308, 0.2, 1.0]]], dtype=np.float32)
    out = tonemap(linear)
    assert out.shape == (1, 2, 4)
    assert out[0, 0].tolist() == [0, 188, 255, 64]
    assert out[0, 1].tolist() == [0, srgb8(0.0031308), srgb8(0.2), 255]


def test_tonemap_turns_one_channel_into_equal_red_green_and_blue():
    from app.tools.image.tonemap import tonemap

    assert tonemap(np.array([[0.5, 1.0]], dtype=np.float32)).tolist() == [[[188, 188, 188], [255, 255, 255]]]


def test_view_shrinks_to_the_longest_side_asked_for_and_keeps_the_shape(client, tmp_path):
    import io

    path = tmp_path / "wide.png"
    path.write_bytes(png_bytes([[F] * 40] * 20))
    reply = client.get("/api/image/view", params={"path": str(path), "max": 10})
    assert reply.headers["content-type"] == "image/webp"
    with Image.open(io.BytesIO(reply.content)) as image:
        assert image.format == "WEBP" and image.size == (10, 5)
        assert all(abs(a - b) <= 4 for a, b in zip(image.convert("RGB").getpixel((5, 2)), F))


def test_view_keeps_see_through_pixels_by_answering_with_png(client, tmp_path):
    import io

    path = tmp_path / "glass.png"
    grid = [[(9, 8, 7, 0), (9, 8, 7, 255)]]
    path.write_bytes(png_bytes(grid))
    reply = client.get("/api/image/view", params={"path": str(path)})
    assert reply.headers["content-type"] == "image/png"
    with Image.open(io.BytesIO(reply.content)) as image:
        assert [image.getpixel((0, 0)), image.getpixel((1, 0))] == grid[0]


def test_view_refuses_a_size_outside_its_range(client, tmp_path):
    path = tmp_path / "six.png"
    path.write_bytes(png_bytes(GRID))
    for value in (-1, 30001):
        assert error_of(client.get("/api/image/view", params={"path": str(path), "max": value})) == (400, "max must be between 0 and 30000")


def test_a_thumbnail_is_never_smaller_than_64_pixels_on_its_long_side(client, tmp_path):
    path = tmp_path / "wide.png"
    path.write_bytes(png_bytes([[A] * 100 + [B] * 100] * 100))
    reply = client.get("/api/image/thumb", params={"path": str(path), "size": 8})
    assert reply.headers["content-type"] == "image/webp"
    import io

    with Image.open(io.BytesIO(reply.content)) as image:
        assert image.size == (64, 32)
        left, right = image.convert("RGB").getpixel((8, 16)), image.convert("RGB").getpixel((56, 16))
    assert left[0] > 200 and left[1] < 60 and right[1] > 200 and right[0] < 60


def test_a_thumbnail_of_a_text_file_is_refused(client, tmp_path):
    path = tmp_path / "notes.png"
    path.write_text("words")
    assert error_of(client.get("/api/image/thumb", params={"path": str(path)})) == (415, "formtools cannot decode that file as a picture")
