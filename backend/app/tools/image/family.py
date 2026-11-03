import io
import json
import re
import zipfile

from PIL import Image

from app.core.errors import ApiError

FORMVIS = frozenset(("fvd", "fmv", "formvis"))
FORMATS = frozenset(("com.nodemode.formvis", "com.nodemode.canvasor", "com.nodemode.sonny"))
MANIFEST_LIMIT = 4 * 1024 * 1024
THUMB_LIMIT = 4 * 1024 * 1024
LAYER_LIMIT = 64 * 1024 * 1024
SAFE_ASSET = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,199}")
MODE_LABELS = {"grayscale": "Grayscale", "bitmap": "Bitmap", "indexed": "Indexed", "cmyk": "CMYK", "lab": "Lab", "duotone": "Duotone", "multichannel": "Multichannel"}


def owner(ext: str) -> str | None:
    return "formvis" if ext in FORMVIS else None


def _root(names: list[str]) -> str:
    if "manifest.json" in names:
        return ""
    roots = {n.split("/", 1)[0] for n in names if n.endswith("/manifest.json") and n.count("/") == 1 and not n.startswith("__MACOSX")}
    if len(roots) == 1:
        return roots.pop() + "/"
    raise ApiError(415, "that file is not a formvis project (no manifest)")


def _read(archive: zipfile.ZipFile, name: str, limit: int) -> bytes | None:
    try:
        info = archive.getinfo(name)
    except KeyError:
        return None
    if info.file_size > limit:
        return None
    return archive.read(info)


def _open(path: str) -> tuple[zipfile.ZipFile, str, dict]:
    try:
        archive = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as exc:
        raise ApiError(415, f"that formvis project cannot be opened ({type(exc).__name__})") from exc
    try:
        root = _root(archive.namelist())
        raw = _read(archive, root + "manifest.json", MANIFEST_LIMIT)
        if raw is None:
            raise ApiError(415, "that formvis project has no readable manifest")
        manifest = json.loads(raw.decode("utf-8"))
    except ApiError:
        archive.close()
        raise
    except (ValueError, UnicodeDecodeError) as exc:
        archive.close()
        raise ApiError(415, "that formvis project has a damaged manifest") from exc
    if not isinstance(manifest, dict) or manifest.get("format") not in FORMATS or manifest.get("version") != 1:
        archive.close()
        raise ApiError(415, "that formvis project is a version formtools does not read")
    return archive, root, manifest


def _layers(manifest: dict) -> list[dict]:
    layers = manifest.get("layers")
    return [x for x in layers if isinstance(x, dict)] if isinstance(layers, list) else []


def _fallback(archive: zipfile.ZipFile, root: str, manifest: dict) -> Image.Image | None:
    for layer in _layers(manifest):
        name = layer.get("imageFile")
        if not isinstance(name, str) or not SAFE_ASSET.fullmatch(name) or ".." in name or not name.lower().endswith(".png"):
            continue
        data = _read(archive, root + "images/" + name, LAYER_LIMIT)
        if data is None:
            continue
        try:
            image = Image.open(io.BytesIO(data))
            image.load()
            return image
        except Exception:
            continue
    return None


def preview(path: str) -> tuple[Image.Image, int]:
    archive, root, manifest = _open(path)
    with archive:
        data = _read(archive, root + "thumbnail.png", THUMB_LIMIT)
        if data and data.startswith(b"\x89PNG\r\n\x1a\n"):
            try:
                image = Image.open(io.BytesIO(data))
                image.load()
                return image, 1
            except Exception:
                pass
        image = _fallback(archive, root, manifest)
        if image is None:
            raise ApiError(415, "that formvis project has no preview formtools can show")
        return image, 1


def describe(path: str) -> dict:
    archive, root, manifest = _open(path)
    with archive:
        has_thumb = (root + "thumbnail.png") in archive.namelist()
    layers = _layers(manifest)
    width = manifest.get("width") if isinstance(manifest.get("width"), int) else 0
    height = manifest.get("height") if isinstance(manifest.get("height"), int) else 0
    depth = manifest.get("depth") if manifest.get("depth") in (8, 16, 32) else 8
    mode = MODE_LABELS.get(str(manifest.get("mode", "")), "RGB")
    names = [str(x.get("name", "")) for x in layers if x.get("name")][:12]
    exif = {
        "Project": "formvis",
        "Layers": len(layers),
        "Colour space": str(manifest.get("colorSpace") or "sRGB"),
        "Preview": "stored thumbnail" if has_thumb else "bottom layer only (approximate)",
    }
    if names:
        exif["Layer names"] = ", ".join(reversed(names))
    return {
        "width": width,
        "height": height,
        "format": "formvis project",
        "mode": mode,
        "frames": 1,
        "animated": False,
        "has_alpha": True,
        "icc": manifest.get("profile", {}).get("name") if isinstance(manifest.get("profile"), dict) else None,
        "bit_depth": depth,
        "exif": exif,
        "gps": None,
        "orientation": 1,
        "owner": "formvis",
    }
