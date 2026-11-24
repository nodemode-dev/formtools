import json
import struct

import pytest

from .support import TRIANGLE, binary_stl, document, read_binary_stl, read_glb, write_glb, write_gltf
from .tools import wait_job

OBJ_QUAD = "# a unit quad\nv 0 0 0\nv 2 0 0\nv 2 3 0\nv 0 3 0\nf 1 2 3\nf 1 3 4\n"
PLY_TRIANGLE = "ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n"
OFF_TRIANGLE = "OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n"


def info(client, path):
    return client.get("/api/model/info", params={"path": str(path)})


def convert(client, path, fmt, **more):
    answer = client.post("/api/model/convert", json={"path": str(path), "format": fmt, **more})
    assert answer.status_code == 200, answer.text
    return wait_job(client, answer.json()["id"])


def triangle_set(points):
    return sorted(tuple(round(v, 5) for v in p) for p in points)


@pytest.mark.parametrize(
    "name,text,counts,box",
    [
        ("quad.obj", OBJ_QUAD, (4, 2), ([0, 0, 0], [2, 3, 0])),
        ("tri.ply", PLY_TRIANGLE, (3, 1), ([0, 0, 0], [1, 1, 0])),
        ("tri.off", OFF_TRIANGLE, (3, 1), ([0, 0, 0], [1, 1, 0])),
    ],
    ids=["obj", "ply", "off"],
)
def test_text_meshes_report_the_vertex_and_triangle_counts_and_box_their_format_defines(client, tmp_path, name, text, counts, box):
    target = tmp_path / name
    target.write_text(text, encoding="utf-8")
    body = info(client, target).json()
    assert (body["vertices"], body["triangles"]) == counts
    assert body["bbox"] == {"min": [float(v) for v in box[0]], "max": [float(v) for v in box[1]]}
    assert body["format"] == name.split(".")[1]


def test_a_binary_stl_with_two_triangles_sharing_an_edge_reports_four_vertices_after_merging(client, tmp_path):
    target = tmp_path / "quad.stl"
    target.write_bytes(binary_stl([[(0, 0, 0), (1, 0, 0), (1, 1, 0)], [(0, 0, 0), (1, 1, 0), (0, 1, 0)]]))
    body = info(client, target).json()
    assert (body["vertices"], body["triangles"]) == (4, 2)
    assert body["bbox"] == {"min": [0.0, 0.0, 0.0], "max": [1.0, 1.0, 0.0]}


def test_a_model_format_the_engine_cannot_read_is_refused_with_the_window_hint(client, tmp_path):
    target = tmp_path / "thing.fbx"
    target.write_bytes(b"x")
    answer = info(client, target)
    assert (answer.status_code, answer.json()["error"]) == (415, "this engine cannot read fbx models; the window opens it directly when its loader supports it")


def test_a_missing_model_a_folder_and_a_relative_path_are_named(client, tmp_path):
    missing = info(client, tmp_path / "none.glb")
    assert (missing.status_code, missing.json()["error"]) == (404, "that file does not exist")
    folder = info(client, tmp_path)
    assert (folder.status_code, folder.json()["error"]) == (400, "that path is not a file")
    relative = client.get("/api/model/info", params={"path": "a.glb"})
    assert (relative.status_code, relative.json()["error"]) == (400, "the path must be absolute")


def test_an_obj_with_no_geometry_is_refused(client, tmp_path):
    target = tmp_path / "empty.obj"
    target.write_text("# nothing here\n", encoding="utf-8")
    answer = info(client, target)
    assert answer.status_code == 422
    assert "obj" in answer.json()["error"]


def test_the_view_route_serves_an_stl_as_a_glb_with_the_same_triangle(client, tmp_path):
    target = tmp_path / "tri.stl"
    target.write_bytes(binary_stl([TRIANGLE]))
    answer = client.get("/api/model/view", params={"path": str(target)})
    assert answer.status_code == 200
    doc, blob = read_glb(answer.content)
    accessor = doc["accessors"][doc["meshes"][0]["primitives"][0]["attributes"]["POSITION"]]
    view = doc["bufferViews"][accessor["bufferView"]]
    start = view.get("byteOffset", 0) + accessor.get("byteOffset", 0)
    corners = [struct.unpack("<3f", blob[start + 12 * k:start + 12 * k + 12]) for k in range(accessor["count"])]
    assert triangle_set(corners) == triangle_set(TRIANGLE)


def test_viewing_the_same_unchanged_model_twice_gives_the_same_bytes(client, tmp_path):
    target = tmp_path / "tri.stl"
    target.write_bytes(binary_stl([TRIANGLE]))
    first = client.get("/api/model/view", params={"path": str(target)}).content
    second = client.get("/api/model/view", params={"path": str(target)}).content
    assert first == second


def test_viewing_a_model_the_engine_cannot_read_is_refused(client, tmp_path):
    target = tmp_path / "scene.dae"
    target.write_bytes(b"x")
    answer = client.get("/api/model/view", params={"path": str(target)})
    assert answer.status_code == 415


def test_converting_a_gltf_to_stl_writes_one_triangle_beside_the_source(client, tmp_path):
    source = write_gltf(tmp_path)
    job = convert(client, source, "stl")
    destination = tmp_path / "tri.stl"
    assert job["state"] == "done"
    assert job["result"] == {"path": str(destination)}
    assert (job["done"], job["total"]) == (3, 3)
    triangles = read_binary_stl(destination.read_bytes())
    assert len(triangles) == 1
    assert triangle_set(triangles[0]) == triangle_set(TRIANGLE)


def test_converting_a_gltf_to_obj_writes_three_vertices_and_one_face_with_one_based_indexes(client, tmp_path):
    job = convert(client, write_gltf(tmp_path), "obj")
    lines = (tmp_path / "tri.obj").read_text(encoding="utf-8").splitlines()
    vertices = [tuple(float(x) for x in line.split()[1:4]) for line in lines if line.startswith("v ")]
    faces = [line.split()[1:] for line in lines if line.startswith("f ")]
    assert job["state"] == "done"
    assert triangle_set(vertices) == triangle_set(TRIANGLE)
    assert len(faces) == 1
    assert sorted(int(part.split("/")[0]) for part in faces[0]) == [1, 2, 3]


def test_converting_a_gltf_to_ply_writes_a_header_that_counts_three_vertices_and_one_face(client, tmp_path):
    convert(client, write_gltf(tmp_path), "ply")
    head = (tmp_path / "tri.ply").read_bytes().split(b"end_header")[0].decode("ascii")
    assert head.startswith("ply\n")
    assert "element vertex 3" in head
    assert "element face 1" in head


def test_converting_a_gltf_to_off_writes_the_off_counts_line_and_the_vertices(client, tmp_path):
    convert(client, write_gltf(tmp_path), "off")
    tokens = (tmp_path / "tri.off").read_text(encoding="utf-8").split()
    assert tokens[0] == "OFF"
    assert tokens[1:3] == ["3", "1"]
    numbers = [float(t) for t in tokens[4:13]]
    corners = [tuple(numbers[i:i + 3]) for i in range(0, 9, 3)]
    assert triangle_set(corners) == triangle_set(TRIANGLE)


@pytest.mark.parametrize("fmt", ["glb", "obj", "stl", "ply", "off"])
def test_a_converted_file_reports_the_same_counts_and_box_as_its_source(client, tmp_path, fmt):
    source = write_gltf(tmp_path, nodes=[{"mesh": 0, "translation": [1, 2, 3]}])
    first = info(client, source).json()
    job = convert(client, source, fmt)
    again = info(client, job["result"]["path"]).json()
    assert (again["vertices"], again["triangles"]) == (first["vertices"], first["triangles"])
    assert again["bbox"]["min"] == pytest.approx(first["bbox"]["min"], abs=1e-5)
    assert again["bbox"]["max"] == pytest.approx(first["bbox"]["max"], abs=1e-5)


def test_a_second_conversion_to_the_same_format_gets_a_numbered_name(client, tmp_path):
    source = write_gltf(tmp_path)
    convert(client, source, "stl")
    second = convert(client, source, "stl")
    assert second["result"]["path"] == str(tmp_path / "tri (2).stl")


def test_an_output_name_without_the_extension_gets_it_added_and_a_missing_folder_is_refused(client, tmp_path):
    source = write_gltf(tmp_path)
    (tmp_path / "out").mkdir()
    job = convert(client, source, "stl", out=str(tmp_path / "out" / "result"))
    assert job["result"]["path"] == str(tmp_path / "out" / "result.stl")
    answer = client.post("/api/model/convert", json={"path": str(source), "format": "stl", "out": str(tmp_path / "gone" / "x")})
    assert (answer.status_code, answer.json()["error"]) == (400, "the output folder does not exist")


def test_a_format_outside_the_five_writable_ones_is_refused(client, tmp_path):
    answer = client.post("/api/model/convert", json={"path": str(write_gltf(tmp_path)), "format": "fbx"})
    assert answer.status_code == 400
    assert not list(tmp_path.glob("*.fbx"))


def test_a_point_cloud_cannot_become_an_stl_and_no_empty_file_is_left(client, tmp_path):
    source = tmp_path / "cloud.ply"
    source.write_text("ply\nformat ascii 1.0\nelement vertex 2\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 1 1\n", encoding="utf-8")
    job = convert(client, source, "stl")
    assert job["state"] == "failed"
    assert job["errors"][0]["error"] == "that model has no faces, so it cannot be written as STL"
    assert not (tmp_path / "cloud.stl").exists()


def test_converting_a_model_the_engine_cannot_read_is_refused(client, tmp_path):
    source = tmp_path / "m.fbx"
    source.write_bytes(b"x")
    answer = client.post("/api/model/convert", json={"path": str(source), "format": "glb"})
    assert answer.status_code == 415


def asset(client, model, uri):
    return client.get("/api/model/asset", params={"path": str(model), "uri": uri})


@pytest.fixture
def folder(tmp_path):
    inner = tmp_path / "inner"
    inner.mkdir()
    doc, blob = document(uri=False)
    doc["buffers"][0]["uri"] = "tri.bin"
    (inner / "tri.gltf").write_text(json.dumps(doc), encoding="utf-8")
    (inner / "tri.bin").write_bytes(blob)
    (inner / "tex.png").write_bytes(b"\x89PNG\r\n\x1a\nxx")
    (inner / "m.mtl").write_text("newmtl a\n", encoding="utf-8")
    (tmp_path / "secret.txt").write_text("secret", encoding="utf-8")
    return inner


def test_a_buffer_beside_the_model_is_served_with_its_bytes_and_a_no_sniff_header(client, folder):
    answer = asset(client, folder / "tri.gltf", "tri.bin")
    assert answer.status_code == 200
    assert answer.content == (folder / "tri.bin").read_bytes()
    assert answer.headers["content-type"] == "application/octet-stream"
    assert answer.headers["x-content-type-options"] == "nosniff"


def test_a_png_and_an_mtl_beside_the_model_are_served_with_their_own_types(client, folder):
    assert asset(client, folder / "tri.gltf", "tex.png").headers["content-type"] == "image/png"
    assert asset(client, folder / "tri.gltf", "m.mtl").headers["content-type"].startswith("text/plain")


def test_a_query_string_or_fragment_on_the_uri_is_ignored_and_percent_escapes_are_decoded(client, folder):
    (folder / "my tex.png").write_bytes(b"p")
    assert asset(client, folder / "tri.gltf", "tri.bin?v=2#x").content == (folder / "tri.bin").read_bytes()
    assert asset(client, folder / "tri.gltf", "my%20tex.png").content == b"p"


@pytest.mark.parametrize("uri", ["../secret.txt", "%2e%2e/secret.txt", "..%2fsecret.txt", "sub/../../secret.txt", "..\\secret.txt"])
def test_a_uri_that_climbs_out_of_the_models_folder_is_refused_and_the_secret_not_served(client, folder, uri):
    answer = asset(client, folder / "tri.gltf", uri)
    assert answer.status_code in (403, 404)
    assert b"secret" not in answer.content


def test_a_symbolic_link_leading_outside_the_folder_is_refused(client, folder, tmp_path):
    (folder / "link.txt").symlink_to(tmp_path / "secret.txt")
    answer = asset(client, folder / "tri.gltf", "link.txt")
    assert (answer.status_code, answer.json()["error"]) == (403, "that file is outside the model's folder")


@pytest.mark.parametrize(
    "uri,status,message",
    [
        ("data:application/octet-stream;base64,AAAA", 403, "only files beside the model can be served, not data or network addresses"),
        ("http://example.invalid/x.bin", 403, "only files beside the model can be served, not data or network addresses"),
        ("//host/share/x", 403, "only files beside the model can be served, not data or network addresses"),
        ("/etc/passwd", 403, "absolute paths are not served"),
        ("C:/Windows/win.ini", 403, "only files beside the model can be served, not data or network addresses"),
        ("nothere.bin", 404, "that file does not exist beside the model"),
        ("", 400, "a uri is needed"),
    ],
)
def test_assets_that_are_not_plain_files_beside_the_model_are_refused_with_the_reason(client, folder, uri, status, message):
    answer = asset(client, folder / "tri.gltf", uri)
    assert (answer.status_code, answer.json()["error"]) == (status, message)


def test_assets_are_only_served_for_model_files_and_never_for_a_text_file(client, folder):
    answer = asset(client, folder.parent / "secret.txt", "secret.txt")
    assert (answer.status_code, answer.json()["error"]) == (400, "assets are served only for gltf, obj, mtl, dae and fbx models")


def test_an_asset_request_for_a_model_that_is_gone_is_a_404(client, folder):
    answer = asset(client, folder / "gone.gltf", "tri.bin")
    assert (answer.status_code, answer.json()["error"]) == (404, "that model does not exist")


def test_a_folder_named_as_the_asset_is_not_served(client, folder):
    (folder / "textures").mkdir()
    assert asset(client, folder / "tri.gltf", "textures").status_code == 404
