import re
from pathlib import Path
from urllib.parse import unquote

from app.core.errors import ApiError
from app.core.filetypes import content_type, ext_of

OWNERS = frozenset({"gltf", "obj", "mtl", "dae", "fbx"})
SCHEME = re.compile(r"^[A-Za-z][A-Za-z0-9+.\-]*:")
EXTRA_TYPES = {"mtl": "text/plain; charset=utf-8", "bin": "application/octet-stream", "obj": "text/plain; charset=utf-8"}


def relative_part(uri: str) -> str:
    if not uri or "\x00" in uri:
        raise ApiError(400, "a uri is needed")
    text = unquote(uri)
    if "\x00" in text:
        raise ApiError(400, "that uri is not allowed")
    if SCHEME.match(text) or text.startswith(("//", "\\\\")):
        raise ApiError(403, "only files beside the model can be served, not data or network addresses")
    text = text.replace("\\", "/")
    if text.startswith("/") or re.match(r"^[A-Za-z]:", text):
        raise ApiError(403, "absolute paths are not served")
    return text.split("#", 1)[0].split("?", 1)[0]


def locate(owner: Path, uri: str) -> Path:
    if ext_of(owner.name) not in OWNERS:
        raise ApiError(400, "assets are served only for gltf, obj, mtl, dae and fbx models")
    if not owner.is_file():
        raise ApiError(404, "that model does not exist")
    text = relative_part(uri)
    if not text:
        raise ApiError(400, "a uri is needed")
    base = owner.parent.resolve()
    try:
        target = (base / text).resolve(strict=True)
    except (OSError, RuntimeError, ValueError):
        raise ApiError(404, "that file does not exist beside the model")
    if target != base and base not in target.parents:
        raise ApiError(403, "that file is outside the model's folder")
    if not target.is_file():
        raise ApiError(404, "that file does not exist beside the model")
    return target


def media_type(target: Path) -> str:
    ext = ext_of(target.name)
    return EXTRA_TYPES.get(ext) or content_type(target.name)
