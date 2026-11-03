import hashlib
import logging
import os
import re
import threading
import time
from pathlib import Path
from urllib.parse import unquote

import numpy as np
import trimesh
from trimesh.resolvers import FilePathResolver

from app.core import config, jobs
from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.routers.fs import absolute
from app.tools.model import assets, gltfinfo

log = logging.getLogger("formtools.model")

READ = ("glb", "gltf", "obj", "stl", "ply", "off", "xyz")
WRITE = ("glb", "obj", "stl", "ply", "off")
NATIVE = ("glb", "gltf", "obj", "stl", "ply", "fbx", "3mf", "dae", "usdz")
SIZE_LIMIT = 768 * 1024 * 1024
CACHE_BYTES = 1024 * 1024 * 1024
SLOTS = threading.BoundedSemaphore(2)
VIEW_VERSION = "1"
TEXTURE_FIELDS = ("image", "baseColorTexture", "emissiveTexture", "normalTexture", "occlusionTexture", "metallicRoughnessTexture")


class DecodingResolver(FilePathResolver):
    def get(self, name):
        try:
            return super().get(name)
        except FileNotFoundError:
            decoded = unquote(name)
            if decoded == name:
                raise
            return super().get(decoded)


def viewable_formats()-> list[str]:
    return sorted(set(NATIVE) | set(READ))


def existing_file(raw: str) -> Path:
    target = absolute(raw)
    if not target.exists():
        raise ApiError(404, "that file does not exist")
    if not target.is_file():
        raise ApiError(400, "that path is not a file")
    return target


def readable_model(raw: str) -> tuple[Path, str]:
    target = existing_file(raw)
    ext = ext_of(target.name)
    if ext not in READ:
        shown = ext or "that"
        raise ApiError(415, f"this engine cannot read {shown} models; the window opens it directly when its loader supports it")
    if target.stat().st_size > SIZE_LIMIT:
        raise ApiError(413, "that model is larger than 768 MB")
    return target, ext


def load(target: Path, ext: str, merge: bool) -> trimesh.Scene:
    try:
        with SLOTS:
            scene = trimesh.load_scene(str(target), file_type=ext, process=merge, resolver=DecodingResolver(str(target)))
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(422, f"that {ext} model could not be read: {exc}")
    if not isinstance(scene, trimesh.Scene) or not scene.geometry:
        raise ApiError(422, f"that {ext} model holds no geometry")
    return scene


def number_list(values) -> list[float]:
    return [round(float(v), 6) for v in values]


def mtl_notes(target: Path) -> list[str]:
    notes = []
    try:
        with open(target, "rb") as handle:
            head = handle.read(65536).decode("utf-8", "replace")
    except OSError:
        return notes
    for line in head.splitlines():
        if line.startswith("mtllib "):
            for name in line[7:].split():
                try:
                    assets.locate(target, name)
                except ApiError:
                    notes.append(f"the material library {name} is missing beside the model")
    return notes


def gltf_notes(document: dict, target: Path, found: dict) -> list[str]:
    notes = []
    required = [item for item in gltfinfo.items(document, "extensionsRequired") if isinstance(item, str)]
    if required:
        notes.append("requires glTF extensions: " + ", ".join(required))
    used = [item for item in gltfinfo.items(document, "extensionsUsed") if isinstance(item, str)]
    compressed = [item for item in used if item in ("KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu")]
    if compressed:
        notes.append("uses compression: " + ", ".join(compressed))
    if found["skins"]:
        notes.append(f"{found['skins']} skin(s) with joints")
    generator = document.get("asset", {}).get("generator") if isinstance(document.get("asset"), dict) else None
    if isinstance(generator, str) and generator:
        notes.append(f"written by {generator}")
    missing = 0
    for uri in gltfinfo.reference_uris(document):
        if uri.startswith("data:"):
            continue
        try:
            assets.locate(target, uri)
        except ApiError:
            missing += 1
    if missing:
        notes.append(f"{missing} referenced file(s) are missing or outside the model's folder")
    return notes


def gltf_info(target: Path, ext: str) -> dict:
    document = gltfinfo.read_document(target, ext)
    found = gltfinfo.summarize(document)
    notes = gltf_notes(document, target, found)
    if found["min"] is None:
        low, high = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]
        notes.append("the file gives no position bounds, so the box is empty")
    else:
        low, high = number_list(found["min"]), number_list(found["max"])
    return {
        "format": ext,
        "meshes": found["meshes"],
        "vertices": found["vertices"],
        "triangles": found["triangles"],
        "materials": found["materials"],
        "textures": found["textures"],
        "animations": found["animations"],
        "nodes": found["nodes"],
        "bbox": {"min": low, "max": high},
        "units": "m",
        "notes": notes,
    }


def material_stats(scene: trimesh.Scene) -> tuple[int, int]:
    materials = set()
    images = set()
    for geometry in scene.geometry.values():
        visual = getattr(geometry, "visual", None)
        material = getattr(visual, "material", None)
        if material is None:
            continue
        materials.add(id(material))
        for field in TEXTURE_FIELDS:
            picture = getattr(material, field, None)
            if picture is not None:
                images.add(id(picture))
    return len(materials), len(images)


def mesh_info(target: Path, ext: str) -> dict:
    scene = load(target, ext, True)
    vertices = 0
    triangles = 0
    notes = []
    points = 0
    for geometry in scene.geometry.values():
        vertices += len(geometry.vertices)
        if isinstance(geometry, trimesh.Trimesh):
            triangles += len(geometry.faces)
        else:
            points += 1
    if points:
        notes.append(f"{points} point cloud(s) without faces")
    if ext == "obj":
        notes.extend(mtl_notes(target))
    colored = [g for g in scene.geometry.values() if isinstance(g, trimesh.Trimesh) and g.visual.kind == "vertex"]
    if colored:
        notes.append("has per-vertex colours")
    materials, textures = material_stats(scene)
    try:
        bounds = scene.bounds
    except Exception:
        bounds = None
    if bounds is None:
        low, high = [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]
    else:
        low, high = number_list(bounds[0]), number_list(bounds[1])
    try:
        units = scene.units
    except Exception:
        units = None
    return {
        "format": ext,
        "meshes": len(scene.geometry),
        "vertices": vertices,
        "triangles": triangles,
        "materials": materials,
        "textures": textures,
        "animations": 0,
        "nodes": max(len(scene.graph.nodes) - 1, 0),
        "bbox": {"min": low, "max": high},
        "units": units if isinstance(units, str) else None,
        "notes": notes,
    }


def info(raw: str) -> dict:
    target, ext = readable_model(raw)
    if ext in ("glb", "gltf"):
        return gltf_info(target, ext)
    return mesh_info(target, ext)


def view_folder() -> Path:
    return config.cache_dir("models")


def view_file(target: Path, stat: os.stat_result) -> Path:
    key = f"{target}|{stat.st_size}|{stat.st_mtime_ns}|{VIEW_VERSION}".encode("utf-8", "surrogatepass")
    digest = hashlib.sha1(key).hexdigest()
    return view_folder() / digest[:2] / f"{digest}.glb"


def write_atomic(destination: Path, data: bytes) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(f".{os.getpid()}.{threading.get_ident()}.tmp")
    temporary.write_bytes(data)
    os.replace(temporary, destination)


def view(raw: str) -> Path:
    target, ext = readable_model(raw)
    if ext == "glb":
        return target
    stat = target.stat()
    cached = view_file(target, stat)
    if cached.is_file():
        os.utime(cached, None)
        return cached
    scene = load(target, ext, False)
    data = export_glb(scene)
    write_atomic(cached, data)
    return cached


def export_glb(scene: trimesh.Scene) -> bytes:
    try:
        data = scene.export(file_type="glb")
    except Exception as exc:
        raise ApiError(422, f"that model could not be written as GLB: {exc}")
    return data if isinstance(data, bytes) else bytes(data)


def flattened(scene: trimesh.Scene) -> tuple[list[trimesh.Trimesh], list[trimesh.PointCloud]]:
    meshes = []
    clouds = []
    for geometry in scene.dump(concatenate=False):
        if isinstance(geometry, trimesh.Trimesh):
            meshes.append(geometry)
        elif isinstance(geometry, trimesh.PointCloud):
            clouds.append(geometry)
    return meshes, clouds


def merged_mesh(scene: trimesh.Scene, label: str) -> trimesh.Trimesh:
    meshes, _ = flattened(scene)
    if not meshes:
        raise ApiError(422, f"that model has no faces, so it cannot be written as {label}")
    return meshes[0] if len(meshes) == 1 else trimesh.util.concatenate(meshes)


def encode_obj(scene: trimesh.Scene, stem: str) -> dict[str, bytes]:
    meshes, _ = flattened(scene)
    if not meshes:
        raise ApiError(422, "that model has no faces, so it cannot be written as OBJ")
    flat = trimesh.Scene()
    for index, mesh in enumerate(meshes):
        material = getattr(mesh.visual, "material", None)
        if material is not None and hasattr(material, "to_simple"):
            mesh.visual.material = material.to_simple()
        flat.add_geometry(mesh, node_name=f"part_{index}", geom_name=f"part_{index}")
    from trimesh.exchange import obj as obj_exchange

    text, extras = obj_exchange.export_obj(flat, include_texture=True, return_texture=True, mtl_name=f"{stem}.mtl")
    files = {f"{stem}.obj": text.encode("utf-8")}
    renames = {}
    for name in extras:
        if name != f"{stem}.mtl":
            renames[name] = f"{stem}_{name}"
    for name, data in extras.items():
        if name == f"{stem}.mtl":
            body = data.decode("utf-8") if isinstance(data, bytes) else str(data)
            for old, new in renames.items():
                body = body.replace(old, new)
            files[name] = body.encode("utf-8")
        else:
            files[renames[name]] = data if isinstance(data, bytes) else bytes(data)
    return files


def encode(scene: trimesh.Scene, fmt: str, stem: str) -> dict[str, bytes]:
    name = f"{stem}.{fmt}"
    try:
        if fmt == "glb":
            return {name: export_glb(scene)}
        if fmt == "obj":
            return encode_obj(scene, stem)
        if fmt == "ply":
            meshes, clouds = flattened(scene)
            if meshes:
                data = merged_mesh(scene, "PLY").export(file_type="ply")
            elif clouds:
                data = trimesh.PointCloud(np.vstack([c.vertices for c in clouds])).export(file_type="ply")
            else:
                raise ApiError(422, "that model holds nothing that can be written as PLY")
            return {name: bytes(data)}
        data = merged_mesh(scene, fmt.upper()).export(file_type=fmt)
        return {name: data if isinstance(data, bytes) else str(data).encode("utf-8")}
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(422, f"that model could not be written as {fmt.upper()}: {exc}")


def reserve(destination: Path) -> Path:
    stem, suffix = destination.stem, destination.suffix
    number = 1
    candidate = destination
    while True:
        try:
            with open(candidate, "xb"):
                pass
            return candidate
        except FileExistsError:
            number += 1
            candidate = destination.with_name(f"{stem} ({number}){suffix}")
        except OSError as exc:
            raise ApiError(400, f"the output file cannot be created: {exc.strerror or exc}")


def output_path(target: Path, fmt: str, out: str | None) -> Path:
    if not out:
        return target.with_name(f"{target.stem}.{fmt}")
    chosen = absolute(out)
    if not chosen.parent.is_dir():
        raise ApiError(400, "the output folder does not exist")
    if chosen.suffix.lower() != f".{fmt}":
        chosen = chosen.with_name(f"{chosen.name}.{fmt}")
    return chosen


def safe_stem(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|\x00-\x1f]', "_", name)


def start_convert(raw: str, fmt: str, out: str | None) -> dict:
    target, ext = readable_model(raw)
    if fmt not in WRITE:
        raise ApiError(400, "format must be glb, obj, stl, ply or off")
    destination = reserve(output_path(target, fmt, out))
    written: list[Path] = [destination]

    def work(job: jobs.Job) -> dict:
        try:
            job.step(done=0, current=target.name, total=3)
            scene = load(target, ext, False)
            job.check()
            job.step(done=1, current="Converting")
            files = encode(scene, fmt, safe_stem(destination.stem))
            main = files.pop(f"{safe_stem(destination.stem)}.{fmt}")
            job.check()
            job.step(done=2, current="Writing")
            for name in files:
                if (destination.parent / name).exists():
                    raise ApiError(409, f"{name} already exists beside the output")
            destination.write_bytes(main)
            for name, data in files.items():
                companion = destination.parent / name
                with open(companion, "xb") as handle:
                    handle.write(data)
                written.append(companion)
            job.step(done=3)
            return {"path": str(destination)}
        except BaseException:
            for item in written:
                item.unlink(missing_ok=True)
            raise

    return jobs.start("model-convert", f"Convert {target.name} to {fmt.upper()}", 3, work).to_dict()


def prune() -> None:
    started = time.time()
    entries = []
    total = 0
    try:
        for folder, _, names in os.walk(view_folder()):
            for name in names:
                path = Path(folder) / name
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if name.endswith(".tmp") and started - stat.st_mtime > 3600:
                    path.unlink(missing_ok=True)
                    continue
                entries.append((max(stat.st_atime, stat.st_mtime), stat.st_size, path))
                total += stat.st_size
    except OSError:
        return
    if total <= CACHE_BYTES:
        return
    entries.sort(key=lambda item: item[0])
    for _, size, path in entries:
        if total <= CACHE_BYTES * 0.8:
            break
        try:
            path.unlink()
            total -= size
        except OSError:
            continue
