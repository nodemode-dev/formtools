import threading
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from app.core import config
from app.tools.demos import pixelfont

PALETTES = {
    "dawn": ((0.98, 0.72, 0.52), (0.36, 0.42, 0.70), ((0.42, 0.34, 0.52), (0.30, 0.24, 0.40), (0.18, 0.14, 0.26)), (1.0, 0.86, 0.62)),
    "day": ((0.62, 0.80, 0.96), (0.22, 0.48, 0.86), ((0.46, 0.60, 0.66), (0.28, 0.44, 0.40), (0.14, 0.26, 0.20)), (1.0, 0.98, 0.90)),
    "dusk": ((0.98, 0.50, 0.32), (0.26, 0.16, 0.40), ((0.40, 0.22, 0.36), (0.26, 0.14, 0.26), (0.12, 0.07, 0.14)), (1.0, 0.70, 0.40)),
    "mist": ((0.86, 0.88, 0.90), (0.62, 0.68, 0.74), ((0.66, 0.70, 0.74), (0.48, 0.54, 0.58), (0.30, 0.34, 0.38)), (1.0, 1.0, 0.98)),
    "night": ((0.16, 0.20, 0.38), (0.03, 0.04, 0.12), ((0.10, 0.12, 0.22), (0.06, 0.07, 0.14), (0.02, 0.02, 0.06)), (0.92, 0.94, 1.0)),
}
_font_lock = threading.Lock()


def landscape(seed: int, width: int, height: int, palette: str = "day", sun: tuple[float, float] | None = None) -> Image.Image:
    rng = np.random.default_rng(seed)
    chosen = PALETTES[palette]
    light, deep, glow = np.array(chosen[0]), np.array(chosen[1]), np.array(chosen[3])
    ridges = [np.array(c) for c in chosen[2]]
    y = np.linspace(0.0, 1.0, height, dtype=np.float32)[:, None, None]
    x = np.linspace(0.0, 1.0, width, dtype=np.float32)[None, :, None]
    sky = deep * (1 - y) + light * y
    image = np.broadcast_to(sky, (height, width, 3)).astype(np.float32)
    sx, sy = sun if sun else (float(rng.uniform(0.2, 0.8)), float(rng.uniform(0.18, 0.42)))
    aspect = width / height
    dist = np.sqrt(((x - sx) * aspect) ** 2 + (y - sy) ** 2)
    image += glow[None, None, :] * (np.exp(-(dist / 0.05) ** 2) * 0.9 + np.exp(-(dist / 0.32) ** 2) * 0.35)
    xs = np.linspace(0.0, 1.0, width, dtype=np.float32)
    for depth, colour in enumerate(ridges):
        base = 0.48 + depth * 0.14 + float(rng.uniform(-0.04, 0.04))
        line = np.full(width, base, dtype=np.float32)
        for octave in range(5):
            freq = (2 + depth) * (2.1 ** octave)
            amp = 0.10 / (1.8 ** octave) * (1.2 - depth * 0.2)
            line += amp * np.sin(xs * freq * np.pi + float(rng.uniform(0, 6.28)))
        mask = (y[:, :, 0] > line[None, :])[:, :, None]
        haze = 0.55 - depth * 0.22
        shade = colour * (1 - haze) + light * haze
        image = np.where(mask, shade * (0.92 + 0.08 * (1 - y)), image)
    grain = rng.normal(0.0, 0.012, size=(height, width, 1)).astype(np.float32)
    image = np.clip(image + grain, 0.0, 1.0)
    return Image.fromarray((image * 255 + 0.5).astype(np.uint8), "RGB")


def font_path() -> Path:
    folder = config.cache_dir("demos")
    path = folder / f"demo-pixel-{config.VERSION}.ttf"
    with _font_lock:
        if not path.exists():
            temp = path.with_suffix(".part")
            pixelfont.build(temp)
            temp.replace(path)
    return path


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(font_path()), size)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int, fill) -> None:
    draw.text(xy, value.upper(), font=font(size), fill=fill)
