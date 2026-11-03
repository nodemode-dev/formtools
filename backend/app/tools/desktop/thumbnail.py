import io
import os
import sys
from pathlib import Path

FONT_EXTS = frozenset(("ttf", "otf", "ttc", "otc", "woff", "woff2"))
FONT_TAGS = (b"\x00\x01\x00\x00", b"OTTO", b"ttcf", b"wOFF", b"wOF2", b"true")
MIN_SIZE = 16
MAX_SIZE = 1024
PAPER = (246, 246, 244, 255)
INK = (28, 28, 30, 255)


class Failure(Exception):
    pass


def is_font(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext in FONT_EXTS:
        return True
    if ext:
        return False
    try:
        with open(path, "rb") as handle:
            return handle.read(4) in FONT_TAGS
    except OSError:
        return False


def sample_text(font) -> str:
    cmap = font.getBestCmap() or {}
    if ord("A") in cmap and ord("a") in cmap:
        return "Aa"
    picked = [chr(code) for code in sorted(cmap) if 0x21 <= code < 0xD800 and chr(code).isprintable()][:2]
    return "".join(picked) or "Aa"


def font_bytes(path: str):
    from fontTools.ttLib import TTCollection, TTFont, TTLibError

    try:
        with open(path, "rb") as handle:
            tag = handle.read(4)
        if tag == b"ttcf":
            collection = TTCollection(path, lazy=True)
            font = collection.fonts[0]
            return None, sample_text(font)
        font = TTFont(path, lazy=True)
        text = sample_text(font)
        if font.flavor:
            font.flavor = None
            buffer = io.BytesIO()
            font.save(buffer)
            buffer.seek(0)
            return buffer, text
        return None, text
    except (TTLibError, OSError, KeyError, ImportError, NotImplementedError, EOFError, AssertionError) as exc:
        raise Failure(f"that file is not a font formtools can read ({type(exc).__name__})")


def render_font(path: str, size: int):
    from PIL import Image, ImageDraw, ImageFont

    buffer, text = font_bytes(path)
    source = buffer if buffer is not None else path
    canvas = Image.new("RGBA", (size, size), PAPER)
    draw = ImageDraw.Draw(canvas)
    pixels = max(8, int(size * 0.62))
    while True:
        if buffer is not None:
            buffer.seek(0)
        try:
            face = ImageFont.truetype(source, pixels)
        except (OSError, ValueError) as exc:
            raise Failure(f"that font could not be drawn ({type(exc).__name__})")
        left, top, right, bottom = draw.textbbox((0, 0), text, font=face)
        if (right - left <= size * 0.86 and bottom - top <= size * 0.86) or pixels <= 8:
            break
        pixels -= max(1, pixels // 12)
    x = (size - (right - left)) / 2 - left
    y = (size - (bottom - top)) / 2 - top
    draw.text((x, y), text, font=face, fill=INK)
    return canvas


def render_picture(path: str, size: int):
    from app.core.errors import ApiError
    from app.tools.image import decode

    try:
        image = decode.render(path, size)
    except ApiError as exc:
        raise Failure(exc.message)
    except Exception as exc:
        raise Failure(f"that file could not be drawn ({type(exc).__name__})")
    if image.mode not in ("RGB", "RGBA"):
        image = image.convert("RGBA")
    if max(image.size) > size:
        from PIL import Image

        image.thumbnail((size, size), Image.Resampling.LANCZOS)
    return image


def make(source: str, target: str, size: int) -> None:
    if not os.path.isfile(source):
        raise Failure("the input file does not exist")
    image = render_font(source, size) if is_font(source) else render_picture(source, size)
    try:
        image.save(target, "PNG")
    except OSError as exc:
        try:
            os.unlink(target)
        except OSError:
            pass
        raise Failure(f"the output could not be written ({exc.strerror or type(exc).__name__})")


def main(args: list[str]) -> int:
    if len(args) != 3:
        print("usage: formtools-engine --thumbnail <input> <output.png> <size>", file=sys.stderr)
        return 2
    source, target, raw_size = args
    try:
        size = int(raw_size)
    except ValueError:
        print(f"the size {raw_size} is not a number", file=sys.stderr)
        return 2
    size = max(MIN_SIZE, min(MAX_SIZE, size))
    try:
        make(str(Path(source)), str(Path(target)), size)
    except Failure as exc:
        print(str(exc).splitlines()[0], file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"the thumbnail failed ({type(exc).__name__})", file=sys.stderr)
        return 1
    return 0
