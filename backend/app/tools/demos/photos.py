import shutil
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, TiffImagePlugin

from app.tools.demos import art

WIDTH, HEIGHT = 1600, 1066
SHOTS = (
    ("dawn", (0.30, 0.40)), ("dawn", (0.62, 0.36)), ("mist", (0.50, 0.30)), ("mist", (0.20, 0.34)),
    ("day", (0.74, 0.22)), ("day", (0.40, 0.18)), ("day", (0.58, 0.26)), ("mist", (0.66, 0.30)),
    ("dusk", (0.42, 0.40)), ("dusk", (0.70, 0.44)), ("dusk", (0.26, 0.38)), ("night", (0.78, 0.20)),
)
START = datetime(2026, 6, 14, 5, 52, 10)
EXPOSURES = ((1, 60), (1, 125), (1, 250), (1, 500), (1, 1000), (1, 30))


def exif_for(index: int, when: datetime) -> Image.Exif:
    exif = Image.Exif()
    exif[0x010F] = "formtools demo"
    exif[0x0110] = "Sample camera"
    exif[0x0131] = "formtools demo generator"
    exif[0x0132] = when.strftime("%Y:%m:%d %H:%M:%S")
    exif[0x013B] = "formtools"
    ifd = exif.get_ifd(0x8769)
    ifd[0x9003] = when.strftime("%Y:%m:%d %H:%M:%S")
    ifd[0x9004] = when.strftime("%Y:%m:%d %H:%M:%S")
    num, den = EXPOSURES[index % len(EXPOSURES)]
    ifd[0x829A] = TiffImagePlugin.IFDRational(num, den)
    ifd[0x829D] = TiffImagePlugin.IFDRational((40, 56, 80, 110)[index % 4], 10)
    ifd[0x8827] = (100, 200, 400, 800)[index % 4]
    ifd[0x920A] = TiffImagePlugin.IFDRational((24, 35, 50, 85)[index % 4], 1)
    return exif


def badge(size: int) -> Image.Image:
    scale = 4
    big = Image.new("RGBA", (size * scale, size * scale), (0, 0, 0, 0))
    draw = ImageDraw.Draw(big)
    pad = 24 * scale
    draw.ellipse((pad, pad, size * scale - pad, size * scale - pad), fill=(249, 115, 22, 255))
    inner = 70 * scale
    draw.ellipse((inner, inner, size * scale - inner, size * scale - inner), fill=(255, 245, 230, 235))
    art.text(draw, (size * scale // 2 - 150 * scale // 2, size * scale // 2 - 30 * scale // 2), "DEMO", 40 * scale, (120, 50, 10, 255))
    return big.resize((size, size), Image.Resampling.LANCZOS)


def overlay(width: int, height: int) -> Image.Image:
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    edge = np.minimum(np.minimum(x, width - 1 - x), np.minimum(y, height - 1 - y))
    alpha = np.clip(1.0 - edge / (min(width, height) * 0.22), 0.0, 1.0) ** 1.6
    rgba = np.zeros((height, width, 4), dtype=np.uint8)
    rgba[..., 0:3] = (12, 10, 20)
    rgba[..., 3] = (alpha * 230).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def scan16(width: int, height: int) -> Image.Image:
    y, x = np.mgrid[0:height, 0:width].astype(np.float32)
    rings = 0.5 + 0.5 * np.sin(np.hypot(x - width * 0.4, y - height * 0.6) / 18.0)
    ramp = x / (width - 1)
    data = (np.clip(ramp * 0.7 + rings * 0.3, 0, 1) * 65535).astype(np.uint16)
    return Image.fromarray(data, "I;16")


def write_exr(path: Path, seed: int) -> bool:
    try:
        import OpenEXR
    except Exception:
        return False
    picture = np.asarray(art.landscape(seed, 960, 540, "dawn", (0.5, 0.36)), dtype=np.float32) / 255.0
    linear = picture ** 2.2
    y, x = np.mgrid[0:540, 0:960].astype(np.float32)
    sun = np.exp(-(((x - 480) / 960 * 1.78) ** 2 + ((y - 194) / 540) ** 2) / 0.0008) * 24.0
    linear = linear + sun[..., None] * np.array((1.0, 0.86, 0.6), dtype=np.float32)
    try:
        header = {"compression": OpenEXR.ZIP_COMPRESSION, "type": OpenEXR.scanlineimage}
        OpenEXR.File(header, {"RGB": np.ascontiguousarray(linear.astype(np.float32))}).write(str(path))
    except Exception:
        path.unlink(missing_ok=True)
        return False
    return True


def build(folder: Path) -> list[str]:
    notes: list[str] = []
    names = []
    for index, (palette, sun) in enumerate(SHOTS):
        name = f"IMG_{412 + index:04d}.jpg"
        when = START + timedelta(minutes=index * 37, seconds=index * 13)
        picture = art.landscape(1000 + index, WIDTH, HEIGHT, palette, sun)
        picture.save(folder / name, "JPEG", quality=88, exif=exif_for(index, when))
        names.append(name)
    shutil.copyfile(folder / names[3], folder / "IMG_0415 copy.jpg")
    shutil.copyfile(folder / names[8], folder / "IMG_0420 (1).jpg")
    with Image.open(folder / names[6]) as source:
        exif = source.getexif()
        source.resize((1200, 800), Image.Resampling.LANCZOS).save(folder / "IMG_0418-small.jpg", "JPEG", quality=70, exif=exif)
    with Image.open(folder / names[9]) as source:
        exif = source.getexif()
        ImageEnhance.Brightness(source).enhance(1.06).save(folder / "IMG_0421 edit.jpg", "JPEG", quality=86, exif=exif)
    broken = art.landscape(1999, WIDTH, HEIGHT, "day", (0.5, 0.2))
    broken.save(folder / "IMG_0424.jpg", "JPEG", quality=88, exif=exif_for(12, START + timedelta(hours=8)))
    data = (folder / "IMG_0424.jpg").read_bytes()
    (folder / "IMG_0424.jpg").write_bytes(data[: len(data) * 2 // 5])
    badge(512).save(folder / "badge.png", "PNG", optimize=True)
    overlay(1200, 800).save(folder / "vignette-overlay.png", "PNG", optimize=True)
    web = folder / "web"
    web.mkdir()
    hero = art.landscape(2001, 1600, 900, "dusk", (0.6, 0.42))
    hero.save(web / "hero.webp", "WEBP", quality=82)
    hero.resize((320, 180), Image.Resampling.LANCZOS).save(web / "hero-thumb.webp", "WEBP", quality=80)
    scan16(1200, 800).save(folder / "scan-16bit.tif", "TIFF", compression="tiff_deflate")
    if not write_exr(folder / "sky-hdr.exr", 2002):
        notes.append("The HDR picture was left out: this engine cannot write OpenEXR.")
    (folder / "to sort").mkdir()
    return notes


def cover(width: int, height: int) -> Image.Image:
    sheet = Image.new("RGB", (width, height), (18, 17, 22))
    cols, rows, gap = 3, 3, 10
    cell_w = (width - gap * (cols + 1)) // cols
    cell_h = (height - gap * (rows + 1)) // rows
    for index in range(cols * rows):
        palette, sun = SHOTS[(index * 5) % len(SHOTS)]
        tile = art.landscape(3000 + index, cell_w, cell_h, palette, sun)
        sheet.paste(tile, (gap + (index % cols) * (cell_w + gap), gap + (index // cols) * (cell_h + gap)))
    return sheet
