import base64
import json
import struct
from pathlib import Path

TRIANGLE = [(0.0, 0.0, 0.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]
JSON_TYPE = 0x4E4F534A
BIN_TYPE = 0x004E4942


def floats(points) -> bytes:
    return b"".join(struct.pack("<3f", *p) for p in points)


def bounds(points) -> tuple[list[float], list[float]]:
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]


def document(points=TRIANGLE, nodes=None, scenes=None, mode=None, indices=None, uri=True, with_bounds=True, extra=None) -> dict:
    data = floats(points)
    index_bytes = b"".join(struct.pack("<H", i) for i in indices) if indices else b""
    pad = (4 - len(index_bytes) % 4) % 4
    blob = data + index_bytes + b"\0" * pad
    buffer = {"byteLength": len(blob)}
    if uri:
        buffer["uri"] = "data:application/octet-stream;base64," + base64.b64encode(blob).decode()
    views = [{"buffer": 0, "byteOffset": 0, "byteLength": len(data)}]
    position = {"bufferView": 0, "componentType": 5126, "count": len(points), "type": "VEC3"}
    if with_bounds:
        low, high = bounds(points)
        position["min"], position["max"] = low, high
    accessors = [position]
    primitive = {"attributes": {"POSITION": 0}}
    if indices:
        views.append({"buffer": 0, "byteOffset": len(data), "byteLength": len(index_bytes)})
        accessors.append({"bufferView": 1, "componentType": 5123, "count": len(indices), "type": "SCALAR"})
        primitive["indices"] = 1
    if mode is not None:
        primitive["mode"] = mode
    doc = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": scenes if scenes is not None else [{"nodes": [0]}],
        "nodes": nodes if nodes is not None else [{"mesh": 0}],
        "meshes": [{"primitives": [primitive]}],
        "buffers": [buffer],
        "bufferViews": views,
        "accessors": accessors,
    }
    doc.update(extra or {})
    return doc, blob


def write_gltf(folder: Path, name: str = "tri.gltf", **kw) -> Path:
    doc, _ = document(**kw)
    target = folder / name
    target.write_text(json.dumps(doc), encoding="utf-8")
    return target


def glb_bytes(doc: dict, blob: bytes) -> bytes:
    text = json.dumps(doc, separators=(",", ":")).encode()
    text += b" " * ((4 - len(text) % 4) % 4)
    body = struct.pack("<II", len(text), JSON_TYPE) + text
    if blob:
        blob = blob + b"\0" * ((4 - len(blob) % 4) % 4)
        body += struct.pack("<II", len(blob), BIN_TYPE) + blob
    return b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body


def write_glb(folder: Path, name: str = "tri.glb", **kw) -> Path:
    doc, blob = document(uri=False, **kw)
    target = folder / name
    target.write_bytes(glb_bytes(doc, blob))
    return target


def read_glb(data: bytes) -> tuple[dict, bytes]:
    magic, version, length = struct.unpack("<4sII", data[:12])
    assert magic == b"glTF" and version == 2 and length == len(data)
    size, kind = struct.unpack("<II", data[12:20])
    assert kind == JSON_TYPE
    doc = json.loads(data[20:20 + size])
    rest = data[20 + size:]
    blob = b""
    if rest:
        bsize, bkind = struct.unpack("<II", rest[:8])
        assert bkind == BIN_TYPE
        blob = rest[8:8 + bsize]
    return doc, blob


def binary_stl(triangles) -> bytes:
    body = b"".join(struct.pack("<3f", 0, 0, 0) + floats(t) + b"\0\0" for t in triangles)
    return b"\0" * 80 + struct.pack("<I", len(triangles)) + body


def read_binary_stl(data: bytes) -> list[tuple]:
    count = struct.unpack("<I", data[80:84])[0]
    assert len(data) == 84 + 50 * count
    out = []
    for i in range(count):
        values = struct.unpack("<12f", data[84 + 50 * i:84 + 50 * i + 48])
        out.append(tuple(tuple(values[3 + 3 * k:6 + 3 * k]) for k in range(3)))
    return out
