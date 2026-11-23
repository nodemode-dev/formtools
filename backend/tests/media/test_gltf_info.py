import json
import math
import struct

import pytest

from .support import TRIANGLE, document, glb_bytes, read_glb, write_glb, write_gltf


def info(client, path):
    return client.get("/api/model/info", params={"path": str(path)})


def test_a_one_triangle_gltf_reports_one_mesh_three_vertices_one_triangle(client, tmp_path):
    body = info(client, write_gltf(tmp_path)).json()
    assert (body["format"], body["meshes"], body["vertices"], body["triangles"], body["nodes"]) == ("gltf", 1, 3, 1, 1)
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 0.0]}
    assert body["units"] == "m"


def test_a_one_triangle_glb_reports_the_same_counts_and_box_as_the_gltf(client, tmp_path):
    glb = info(client, write_glb(tmp_path)).json()
    gltf = info(client, write_gltf(tmp_path)).json()
    assert glb["format"] == "glb"
    for key in ("meshes", "vertices", "triangles", "bbox", "nodes"):
        assert glb[key] == gltf[key]
    assert glb["triangles"] == 1


def test_a_node_translation_moves_the_box_by_the_same_amount(client, tmp_path):
    body = info(client, write_gltf(tmp_path, nodes=[{"mesh": 0, "translation": [10, 20, 30]}])).json()
    assert body["bbox"] == {"min": [10.0, 20.0, 30.0], "max": [11.0, 21.0, 30.0]}


def test_a_node_scale_stretches_the_box_on_each_axis(client, tmp_path):
    body = info(client, write_gltf(tmp_path, nodes=[{"mesh": 0, "scale": [2, 3, 4]}])).json()
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [2.0, 3.0, 0.0]}


def test_a_quarter_turn_about_z_maps_x_to_y_and_y_to_minus_x(client, tmp_path):
    half = math.sqrt(0.5)
    body = info(client, write_gltf(tmp_path, nodes=[{"mesh": 0, "rotation": [0, 0, half, half]}])).json()
    assert body["bbox"]["min"] == pytest.approx([-1.0, 0.0, 0.0], abs=1e-6)
    assert body["bbox"]["max"] == pytest.approx([0.0, 1.0, 0.0], abs=1e-6)


def test_a_column_major_matrix_carries_its_translation_in_the_last_column(client, tmp_path):
    matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 5, 6, 7, 1]
    body = info(client, write_gltf(tmp_path, nodes=[{"mesh": 0, "matrix": matrix}])).json()
    assert body["bbox"] == {"min": [5.0, 6.0, 7.0], "max": [6.0, 7.0, 7.0]}


def test_a_child_node_inherits_its_parents_translation(client, tmp_path):
    nodes = [{"translation": [1, 0, 0], "children": [1]}, {"mesh": 0, "translation": [0, 2, 0]}]
    body = info(client, write_gltf(tmp_path, nodes=nodes)).json()
    assert body["bbox"] == {"min": [1.0, 2.0, 0.0], "max": [2.0, 3.0, 0.0]}
    assert body["nodes"] == 2


def test_the_scale_applies_before_the_translation_as_the_format_says(client, tmp_path):
    body = info(client, write_gltf(tmp_path, nodes=[{"mesh": 0, "scale": [2, 2, 2], "translation": [1, 1, 1]}])).json()
    assert body["bbox"] == {"min": [1.0, 1.0, 1.0], "max": [3.0, 3.0, 1.0]}


def test_one_mesh_drawn_by_two_nodes_counts_its_vertices_twice(client, tmp_path):
    nodes = [{"mesh": 0}, {"mesh": 0, "translation": [5, 0, 0]}]
    body = info(client, write_gltf(tmp_path, nodes=nodes, scenes=[{"nodes": [0, 1]}])).json()
    assert (body["meshes"], body["vertices"], body["triangles"]) == (1, 6, 2)
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [6.0, 1.0, 0.0]}


def test_a_node_outside_the_chosen_scene_is_not_counted(client, tmp_path):
    nodes = [{"mesh": 0}, {"mesh": 0, "translation": [100, 0, 0]}]
    body = info(client, write_gltf(tmp_path, nodes=nodes, scenes=[{"nodes": [0]}])).json()
    assert (body["vertices"], body["triangles"]) == (3, 1)
    assert body["bbox"]["max"] == [1.0, 1.0, 0.0]


def test_the_scene_index_picks_which_scene_is_measured(client, tmp_path):
    nodes = [{"mesh": 0}, {"mesh": 0, "translation": [0, 0, 9]}]
    doc_path = write_gltf(tmp_path, nodes=nodes, scenes=[{"nodes": [0]}, {"nodes": [1]}], extra={"scene": 1})
    body = info(client, doc_path).json()
    assert body["bbox"] == {"min": [0.0, 0.0, 9.0], "max": [1.0, 1.0, 9.0]}


def test_without_scenes_every_node_that_is_no_child_is_a_root(client, tmp_path):
    nodes = [{"mesh": 0, "children": [1]}, {"mesh": 0, "translation": [0, 3, 0]}, {"mesh": 0, "translation": [-2, 0, 0]}]
    doc, _ = document(nodes=nodes)
    del doc["scenes"]
    del doc["scene"]
    target = tmp_path / "noscene.gltf"
    target.write_text(json.dumps(doc), encoding="utf-8")
    body = info(client, target).json()
    assert (body["vertices"], body["triangles"]) == (9, 3)
    assert body["bbox"] == {"min": [-2.0, 0.0, 0.0], "max": [1.0, 4.0, 0.0]}


def test_an_indexed_quad_counts_four_vertices_and_two_triangles(client, tmp_path):
    quad = [(0, 0, 0), (2, 0, 0), (2, 3, 0), (0, 3, 0)]
    body = info(client, write_gltf(tmp_path, points=quad, indices=[0, 1, 2, 0, 2, 3])).json()
    assert (body["vertices"], body["triangles"]) == (4, 2)
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [2.0, 3.0, 0.0]}


@pytest.mark.parametrize(
    "mode,count,expected",
    [(4, 6, 2), (5, 5, 3), (6, 4, 2), (5, 2, 0), (0, 6, 0), (1, 6, 0), (2, 6, 0), (3, 6, 0)],
    ids=["triangles", "strip", "fan", "short-strip", "points", "lines", "line-loop", "line-strip"],
)
def test_the_triangle_count_follows_the_primitive_mode(client, tmp_path, mode, count, expected):
    points = [(float(i), float(i % 2), 0.0) for i in range(count)]
    body = info(client, write_gltf(tmp_path, points=points, mode=mode)).json()
    assert body["vertices"] == count
    assert body["triangles"] == expected


def test_lists_of_materials_images_animations_skins_are_counted(client, tmp_path):
    extra = {
        "materials": [{}, {}],
        "images": [{"uri": "data:image/png;base64,AA=="}, {"uri": "data:image/png;base64,AA=="}, {"uri": "data:image/png;base64,AA=="}],
        "textures": [{"source": 0}],
        "animations": [{"channels": [], "samplers": []}],
    }
    body = info(client, write_gltf(tmp_path, extra=extra)).json()
    assert (body["materials"], body["textures"], body["animations"]) == (2, 3, 1)


def test_textures_are_counted_when_the_file_lists_no_images(client, tmp_path):
    body = info(client, write_gltf(tmp_path, extra={"textures": [{}, {}]})).json()
    assert body["textures"] == 2


def test_a_position_without_min_and_max_gives_an_empty_box_and_says_so(client, tmp_path):
    body = info(client, write_gltf(tmp_path, with_bounds=False)).json()
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [0.0, 0.0, 0.0]}
    assert "the file gives no position bounds, so the box is empty" in body["notes"]
    assert body["vertices"] == 3


def test_required_extensions_compression_generator_and_skins_appear_in_the_notes(client, tmp_path):
    extra = {
        "extensionsRequired": ["KHR_materials_variants"],
        "extensionsUsed": ["KHR_draco_mesh_compression", "KHR_materials_variants"],
        "asset": {"version": "2.0", "generator": "Hand Writer 1"},
        "skins": [{"joints": [0]}],
    }
    notes = info(client, write_gltf(tmp_path, extra=extra)).json()["notes"]
    assert "requires glTF extensions: KHR_materials_variants" in notes
    assert "uses compression: KHR_draco_mesh_compression" in notes
    assert "written by Hand Writer 1" in notes
    assert "1 skin(s) with joints" in notes


def test_a_missing_buffer_file_and_one_outside_the_folder_are_both_reported(client, tmp_path):
    extra = {"images": [{"uri": "missing.png"}, {"uri": "../outside.png"}]}
    (tmp_path.parent / "outside.png").write_bytes(b"x")
    folder = tmp_path / "model"
    folder.mkdir()
    notes = info(client, write_gltf(folder, extra=extra)).json()["notes"]
    assert "2 referenced file(s) are missing or outside the model's folder" in notes


def test_a_buffer_file_beside_the_model_is_not_reported_missing(client, tmp_path):
    doc, blob = document(uri=False)
    doc["buffers"][0]["uri"] = "tri.bin"
    (tmp_path / "tri.bin").write_bytes(blob)
    (tmp_path / "tri.gltf").write_text(json.dumps(doc), encoding="utf-8")
    body = info(client, tmp_path / "tri.gltf").json()
    assert not any("missing" in note for note in body["notes"])
    assert body["triangles"] == 1


def test_a_glb_with_the_wrong_magic_is_refused(client, tmp_path):
    target = tmp_path / "bad.glb"
    target.write_bytes(b"gLTF" + glb_bytes(*document(uri=False))[4:])
    answer = info(client, target)
    assert answer.status_code == 422
    assert answer.json()["error"] == "that file is not a valid GLB container"


def test_a_glb_shorter_than_its_header_is_refused(client, tmp_path):
    target = tmp_path / "short.glb"
    target.write_bytes(b"glTF\x02\x00\x00\x00")
    answer = info(client, target)
    assert (answer.status_code, answer.json()["error"]) == (422, "that file is not a valid GLB container")


def test_a_glb_whose_first_chunk_is_binary_is_refused(client, tmp_path):
    good = glb_bytes(*document(uri=False))
    target = tmp_path / "swapped.glb"
    target.write_bytes(good[:16] + struct.pack("<I", 0x004E4942) + good[20:])
    answer = info(client, target)
    assert (answer.status_code, answer.json()["error"]) == (422, "the GLB container has no readable JSON chunk")


def test_a_glb_with_broken_json_is_refused_as_unreadable(client, tmp_path):
    text = b'{"asset": '
    text += b" " * ((4 - len(text) % 4) % 4)
    body = struct.pack("<II", len(text), 0x4E4F534A) + text
    target = tmp_path / "broken.glb"
    target.write_bytes(b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body)
    answer = info(client, target)
    assert answer.status_code == 422
    assert answer.json()["error"].startswith("that glTF file could not be read")


def test_a_gltf_that_is_not_json_is_refused(client, tmp_path):
    target = tmp_path / "text.gltf"
    target.write_text("this is not json", encoding="utf-8")
    answer = info(client, target)
    assert answer.status_code == 422
    assert answer.json()["error"].startswith("that glTF file could not be read")


def test_a_gltf_holding_a_json_list_is_refused(client, tmp_path):
    target = tmp_path / "list.gltf"
    target.write_text("[1, 2, 3]", encoding="utf-8")
    answer = info(client, target)
    assert (answer.status_code, answer.json()["error"]) == (422, "that glTF file does not hold a JSON object")


def test_a_gltf_with_no_meshes_reports_zero_everything(client, tmp_path):
    target = tmp_path / "empty.gltf"
    target.write_text(json.dumps({"asset": {"version": "2.0"}}), encoding="utf-8")
    body = info(client, target).json()
    assert (body["meshes"], body["vertices"], body["triangles"], body["nodes"]) == (0, 0, 0, 0)


def test_the_view_route_hands_back_a_glb_unchanged(client, tmp_path):
    target = write_glb(tmp_path)
    answer = client.get("/api/model/view", params={"path": str(target)})
    assert answer.status_code == 200
    assert answer.headers["content-type"] == "model/gltf-binary"
    assert answer.content == target.read_bytes()


def test_the_view_route_turns_a_gltf_into_a_glb_holding_the_same_triangle(client, tmp_path):
    answer = client.get("/api/model/view", params={"path": str(write_gltf(tmp_path))})
    assert answer.status_code == 200
    doc, blob = read_glb(answer.content)
    corners = []
    for mesh in doc["meshes"]:
        for primitive in mesh["primitives"]:
            accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
            view = doc["bufferViews"][accessor["bufferView"]]
            start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
            for k in range(accessor["count"]):
                corners.append(struct.unpack("<3f", blob[start + 12 * k:start + 12 * k + 12]))
    assert sorted(corners) == sorted(TRIANGLE)
