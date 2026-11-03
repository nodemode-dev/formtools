import hashlib
import importlib.util
import os
import shutil
import struct
import subprocess
import sys
from collections import Counter
from pathlib import Path

from fontTools import unicodedata as ucd
from fontTools.ttLib import TTCollection, TTFont, TTLibError

from app.core.errors import ApiError
from app.tools.files import safety, text

INSTALLABLE = (".ttf", ".otf", ".ttc", ".otc")
SCAN_CEILING = 30000
NOT_FONT = "that file is not a font formtools can read"


def brotli_present() -> bool:
    return importlib.util.find_spec("brotli") is not None


def open_font(path: Path) -> tuple[TTFont, str, int, object | None]:
    try:
        with open(path, "rb") as handle:
            tag = handle.read(4)
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    if tag == b"wOF2" and not brotli_present():
        raise ApiError(415, "WOFF2 fonts need the brotli module, which is not installed on this system")
    try:
        if tag == b"ttcf":
            collection = TTCollection(str(path), lazy=True)
            return collection.fonts[0], "collection", len(collection.fonts), collection
        font = TTFont(str(path), lazy=True, fontNumber=0)
    except (TTLibError, struct.error, AssertionError, KeyError, IndexError, ImportError, NotImplementedError, OSError, EOFError):
        raise ApiError(415, NOT_FONT)
    if tag == b"wOFF":
        label = "WOFF"
    elif tag == b"wOF2":
        label = "WOFF2"
    elif font.sfntVersion == "OTTO":
        label = "OpenType CFF"
    else:
        label = "TrueType"
    return font, label, 1, None


def pick(names, ids: list[int]) -> str | None:
    for number in ids:
        try:
            value = names.getDebugName(number)
        except Exception:
            value = None
        if value:
            return value.strip()[:4000]
    return None


def layout_tags(font: TTFont) -> tuple[list[str], list[str]]:
    features: set[str] = set()
    scripts: set[str] = set()
    for table in ("GSUB", "GPOS"):
        if table not in font:
            continue
        try:
            body = font[table].table
            if body.FeatureList:
                features.update(record.FeatureTag for record in body.FeatureList.FeatureRecord)
            if body.ScriptList:
                scripts.update(record.ScriptTag for record in body.ScriptList.ScriptRecord)
        except Exception:
            continue
    return sorted(features), sorted(scripts)


def coverage(font: TTFont) -> list[dict]:
    try:
        cmap = font.getBestCmap() or {}
    except Exception:
        return []
    blocks: Counter = Counter()
    for code in cmap:
        try:
            blocks[ucd.block(chr(code))] += 1
        except (ValueError, OverflowError):
            continue
    ranked = sorted(blocks.items(), key=lambda pair: (-pair[1], pair[0]))
    return [{"block": block, "count": count} for block, count in ranked[:80]]


def axes_of(font: TTFont, names) -> list[dict]:
    if "fvar" not in font:
        return []
    found = []
    for axis in font["fvar"].axes:
        found.append(
            {
                "tag": axis.axisTag,
                "name": pick(names, [axis.axisNameID]) or axis.axisTag,
                "min": round(axis.minValue, 4),
                "default": round(axis.defaultValue, 4),
                "max": round(axis.maxValue, 4),
            }
        )
    return found


def user_dir() -> Path:
    home = Path.home()
    if sys.platform == "darwin":
        return home / "Library" / "Fonts"
    if sys.platform.startswith("win"):
        return Path(os.environ.get("LOCALAPPDATA") or home / "AppData" / "Local") / "Microsoft" / "Windows" / "Fonts"
    return home / ".local" / "share" / "fonts"


def font_dirs() -> list[Path]:
    home = Path.home()
    if sys.platform == "darwin":
        return [user_dir(), Path("/Library/Fonts"), Path("/System/Library/Fonts")]
    if sys.platform.startswith("win"):
        return [user_dir(), Path(os.environ.get("WINDIR") or "C:\\Windows") / "Fonts"]
    return [user_dir(), home / ".fonts", Path("/usr/local/share/fonts"), Path("/usr/share/fonts")]


def is_installed(path: Path) -> bool:
    try:
        real = os.path.realpath(path)
        size = path.stat().st_size
    except OSError:
        return False
    wanted = path.name.lower()
    scanned = 0
    for folder in font_dirs():
        if not folder.is_dir():
            continue
        if safety.inside(os.path.realpath(folder), real):
            return True
        for here, _, files in os.walk(folder):
            for name in files:
                scanned += 1
                if name.lower() == wanted:
                    try:
                        if (Path(here) / name).stat().st_size == size:
                            return True
                    except OSError:
                        pass
            if scanned > SCAN_CEILING:
                break
    return False


def font_info(raw: str) -> dict:
    path = text.readable(raw)
    font, label, faces, collection = open_font(path)
    try:
        names = font["name"] if "name" in font else None
        glyphs = font["maxp"].numGlyphs if "maxp" in font else 0
        features, scripts = layout_tags(font)
        return {
            "family": pick(names, [16, 1]) if names else None,
            "subfamily": pick(names, [17, 2]) if names else None,
            "full_name": pick(names, [4]) if names else None,
            "postscript": pick(names, [6]) if names else None,
            "version": pick(names, [5]) if names else None,
            "designer": pick(names, [9]) if names else None,
            "vendor": pick(names, [8]) if names else None,
            "license": pick(names, [13]) if names else None,
            "license_url": pick(names, [14]) if names else None,
            "copyright": pick(names, [0]) if names else None,
            "glyphs": glyphs,
            "format": label,
            "faces": faces,
            "axes": axes_of(font, names) if names else [],
            "features": features,
            "scripts": scripts,
            "coverage": coverage(font),
            "installed": is_installed(path),
        }
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(415, f"{NOT_FONT} ({type(exc).__name__})")
    finally:
        if collection is not None:
            for member in collection.fonts:
                member.close()
        else:
            font.close()


def same_content(first: Path, second: Path) -> bool:
    if first.stat().st_size != second.stat().st_size:
        return False
    digests = []
    for item in (first, second):
        engine = hashlib.sha256()
        with open(item, "rb") as handle:
            for block in iter(lambda: handle.read(safety.CHUNK), b""):
                engine.update(block)
        digests.append(engine.digest())
    return digests[0] == digests[1]


def register_windows(target: Path, title: str) -> None:
    import ctypes
    import winreg

    kind = "(OpenType)" if target.suffix.lower() in (".otf", ".otc") else "(TrueType)"
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows NT\CurrentVersion\Fonts") as key:
        winreg.SetValueEx(key, f"{title} {kind}", 0, winreg.REG_SZ, str(target))
    ctypes.windll.gdi32.AddFontResourceW(str(target))
    ctypes.windll.user32.SendMessageTimeoutW(0xFFFF, 0x001D, 0, 0, 2, 1000, None)


def install_font(raw: str) -> dict:
    path = text.readable(raw)
    if path.suffix.lower() not in INSTALLABLE:
        raise ApiError(415, "only TrueType and OpenType fonts (ttf, otf, ttc, otc) can be installed; web fonts cannot")
    font, _, _, collection = open_font(path)
    title = None
    try:
        names = font["name"] if "name" in font else None
        title = (pick(names, [4]) if names else None) or path.stem
    finally:
        if collection is not None:
            for member in collection.fonts:
                member.close()
        else:
            font.close()
    folder = user_dir()
    try:
        folder.mkdir(parents=True, exist_ok=True)
    except OSError:
        raise ApiError(400, "the per-user font folder could not be created")
    target = folder / path.name
    if os.path.lexists(target):
        if os.path.realpath(target) == os.path.realpath(path) or same_content(path, target):
            return {"ok": True, "path": str(target)}
        raise ApiError(400, "a different font file with that name is already installed")
    temp = safety.temp_beside(folder)
    try:
        shutil.copyfile(path, temp)
        final = safety.place(temp, target)
    except OSError as exc:
        raise ApiError(400, f"the font could not be copied ({exc.strerror or 'error'})")
    finally:
        safety.discard(temp)
    if sys.platform.startswith("win"):
        try:
            register_windows(final, title)
        except Exception as exc:
            raise ApiError(400, f"the font was copied but could not be registered ({type(exc).__name__})")
    elif sys.platform != "darwin":
        cache = shutil.which("fc-cache")
        if cache:
            try:
                subprocess.run([cache, "-f", str(folder)], timeout=120, capture_output=True, check=False)
            except (OSError, subprocess.SubprocessError):
                pass
    return {"ok": True, "path": str(final)}
