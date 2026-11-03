import json
import struct
from pathlib import Path

import numpy as np

from app.core.errors import ApiError

JSON_CHUNK = 0x4E4F534A
JSON_LIMIT = 256 * 1024 * 1024
STEP_LIMIT = 2_000_000


def read_document(path: Path, ext: str) -> dict:
    try:
        with open(path, "rb") as handle:
            if ext == "glb":
                head = handle.read(20)
                if len(head) < 20 or head[:4] != b"glTF":
                    raise ApiError(422, "that file is not a valid GLB container")
                length, kind = struct.unpack("<II", head[12:20])
                if kind != JSON_CHUNK or length > JSON_LIMIT:
                    raise ApiError(422, "the GLB container has no readable JSON chunk")
                raw = handle.read(length)
            else:
                raw = handle.read(JSON_LIMIT + 1)
                if len(raw) > JSON_LIMIT:
                    raise ApiError(413, "that glTF description is too large to read")
        document = json.loads(raw)
    except (OSError, ValueError) as exc:
        raise ApiError(422, f"that glTF file could not be read: {exc}")
    if not isinstance(document, dict):
        raise ApiError(422, "that glTF file does not hold a JSON object")
    return document


def items(document: dict, key: str) -> list:
    value = document.get(key)
    return value if isinstance(value, list) else []


def pick(values: list, index) -> dict:
    if isinstance(index, int) and 0 <= index < len(values) and isinstance(values[index], dict):
        return values[index]
    return {}


def triangles_of(mode: int, count: int) -> int:
    if mode == 4:
        return count // 3
    if mode in (5, 6):
        return max(count - 2, 0)
    return 0


def mesh_totals(document: dict) -> list[dict]:
    accessors = items(document, "accessors")
    totals = []
    for mesh in items(document, "meshes"):
        vertices = 0
        triangles = 0
        low = None
        high = None
        primitives = mesh.get("primitives") if isinstance(mesh, dict) else None
        for primitive in primitives if isinstance(primitives, list) else []:
            if not isinstance(primitive, dict):
                continue
            attributes = primitive.get("attributes")
            position = pick(accessors, attributes.get("POSITION") if isinstance(attributes, dict) else None)
            count = position.get("count") if isinstance(position.get("count"), int) else 0
            vertices += count
            indices = pick(accessors, primitive.get("indices"))
            drawn = indices.get("count") if isinstance(indices.get("count"), int) else count
            mode = primitive.get("mode", 4)
            triangles += triangles_of(mode if isinstance(mode, int) else 4, drawn)
            lower, upper = position.get("min"), position.get("max")
            if isinstance(lower, list) and isinstance(upper, list) and len(lower) == 3 and len(upper) == 3:
                try:
                    lo = np.array(lower, dtype=float)
                    hi = np.array(upper, dtype=float)
                except (TypeError, ValueError):
                    continue
                low = lo if low is None else np.minimum(low, lo)
                high = hi if high is None else np.maximum(high, hi)
        totals.append({"vertices": vertices, "triangles": triangles, "min": low, "max": high})
    return totals


def local_matrix(node: dict) -> np.ndarray:
    try:
        raw = node.get("matrix")
        if isinstance(raw, list) and len(raw) == 16:
            return np.array(raw, dtype=float).reshape(4, 4).T
        matrix = np.eye(4)
        scale = node.get("scale")
        rotation = node.get("rotation")
        translation = node.get("translation")
        if isinstance(scale, list) and len(scale) == 3:
            matrix = np.diag([float(scale[0]), float(scale[1]), float(scale[2]), 1.0])
        if isinstance(rotation, list) and len(rotation) == 4:
            x, y, z, w = (float(v) for v in rotation)
            norm = (x * x + y * y + z * z + w * w) ** 0.5 or 1.0
            x, y, z, w = x / norm, y / norm, z / norm, w / norm
            turn = np.array(
                [
                    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 0],
                    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 0],
                    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y), 0],
                    [0, 0, 0, 1],
                ]
            )
            matrix = turn @ matrix
        if isinstance(translation, list) and len(translation) == 3:
            move = np.eye(4)
            move[:3, 3] = [float(v) for v in translation]
            matrix = move @ matrix
        return matrix
    except (TypeError, ValueError):
        return np.eye(4)


def roots_of(document: dict, nodes: list) -> list[int]:
    scenes = items(document, "scenes")
    chosen = pick(scenes, document.get("scene", 0))
    listed = chosen.get("nodes")
    if isinstance(listed, list):
        return [index for index in listed if isinstance(index, int)]
    children = set()
    for node in nodes:
        if isinstance(node, dict) and isinstance(node.get("children"), list):
            children.update(child for child in node["children"] if isinstance(child, int))
    return [index for index in range(len(nodes)) if index not in children]


def corners(low: np.ndarray, high: np.ndarray) -> np.ndarray:
    points = np.array([[x, y, z, 1.0] for x in (low[0], high[0]) for y in (low[1], high[1]) for z in (low[2], high[2])])
    return points


def summarize(document: dict) -> dict:
    nodes = items(document, "nodes")
    totals = mesh_totals(document)
    vertices = 0
    triangles = 0
    low = None
    high = None
    stack = [(index, np.eye(4)) for index in roots_of(document, nodes)]
    steps = 0
    while stack and steps < STEP_LIMIT:
        steps += 1
        index, parent = stack.pop()
        node = pick(nodes, index)
        if not node:
            continue
        world = parent @ local_matrix(node)
        mesh_index = node.get("mesh")
        if isinstance(mesh_index, int) and 0 <= mesh_index < len(totals):
            entry = totals[mesh_index]
            vertices += entry["vertices"]
            triangles += entry["triangles"]
            if entry["min"] is not None:
                moved = (world @ corners(entry["min"], entry["max"]).T).T[:, :3]
                low = moved.min(axis=0) if low is None else np.minimum(low, moved.min(axis=0))
                high = moved.max(axis=0) if high is None else np.maximum(high, moved.max(axis=0))
        children = node.get("children")
        if isinstance(children, list):
            stack.extend((child, world) for child in children if isinstance(child, int))
    images = items(document, "images")
    textures = items(document, "textures")
    return {
        "meshes": len(items(document, "meshes")),
        "vertices": vertices,
        "triangles": triangles,
        "materials": len(items(document, "materials")),
        "textures": len(images) if images else len(textures),
        "animations": len(items(document, "animations")),
        "nodes": len(nodes),
        "min": low,
        "max": high,
        "skins": len(items(document, "skins")),
        "cameras": len(items(document, "cameras")),
    }


def reference_uris(document: dict) -> list[str]:
    found = []
    for key in ("buffers", "images"):
        for entry in items(document, key):
            uri = entry.get("uri") if isinstance(entry, dict) else None
            if isinstance(uri, str) and uri:
                found.append(uri)
    return found
