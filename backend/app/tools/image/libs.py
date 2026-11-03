import os
import shutil
import sys
from functools import lru_cache

from app.core.filetypes import RAW


@lru_cache(maxsize=None)
def rawpy():
    try:
        import rawpy as module

        return module
    except Exception:
        return None


@lru_cache(maxsize=None)
def psd_tools():
    try:
        import psd_tools as module

        return module
    except Exception:
        return None


@lru_cache(maxsize=None)
def openexr():
    try:
        import OpenEXR as module

        return module
    except Exception:
        return None


@lru_cache(maxsize=None)
def sips() -> str | None:
    if sys.platform != "darwin":
        return None
    return shutil.which("sips") or ("/usr/bin/sips" if os.path.exists("/usr/bin/sips") else None)


@lru_cache(maxsize=None)
def pillow_feature(name: str) -> bool:
    from PIL import features

    try:
        return bool(features.check(name))
    except Exception:
        return False


PILLOW_ENGINE = frozenset("tif tiff ico icns tga qoi dds pcx ppm pgm pbm pnm".split())
WEBVIEW_NATIVE = frozenset("jpg jpeg jpe jfif png apng gif webp bmp svg".split())
HEIC = frozenset("heic heif heics heifs".split())


def engine_extensions() -> list[str]:
    found = set(PILLOW_ENGINE) | {"hdr", "fvd", "fmv", "formvis"}
    if pillow_feature("avif"):
        found.update(("avif", "avifs"))
    if pillow_feature("jpg_2000"):
        found.update(("jp2", "j2k", "jpf", "jpx"))
    if psd_tools():
        found.update(("psd", "psb"))
    if openexr():
        found.add("exr")
    if rawpy():
        found.update(RAW)
    if sips():
        found.update(HEIC)
    return sorted(found)


def native_extensions() -> list[str]:
    return sorted(WEBVIEW_NATIVE)
