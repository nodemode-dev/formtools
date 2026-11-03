import numpy as np

KEY = 0.18
EXPOSURE_RANGE = (0.0625, 16.0)
SAMPLE_LIMIT = 400_000


def luminance(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722


def aces_fit(x: np.ndarray) -> np.ndarray:
    return np.clip((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0)


def srgb_encode(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1.0 / 2.4) - 0.055)


def auto_exposure(rgb: np.ndarray) -> float:
    lum = luminance(rgb).ravel()
    if lum.size > SAMPLE_LIMIT:
        lum = lum[:: lum.size // SAMPLE_LIMIT + 1]
    lum = lum[lum > 1e-6]
    if lum.size == 0:
        return 1.0
    average = float(np.exp(np.mean(np.log(lum))))
    return float(np.clip(KEY / average, *EXPOSURE_RANGE))


def display_referred(rgb: np.ndarray) -> bool:
    sample = rgb.ravel()
    if sample.size > SAMPLE_LIMIT:
        sample = sample[:: sample.size // SAMPLE_LIMIT + 1]
    return bool(sample.size == 0 or np.percentile(sample, 99.9) <= 1.0)


def tonemap(linear: np.ndarray) -> np.ndarray:
    data = np.nan_to_num(linear.astype(np.float32, copy=False), nan=0.0, posinf=65504.0, neginf=0.0)
    data = np.maximum(data, 0.0)
    if data.ndim == 2:
        data = data[..., None]
    channels = data.shape[2]
    if channels == 1:
        data = np.repeat(data, 3, axis=2)
        channels = 3
    rgb = data[..., :3]
    if display_referred(rgb):
        mapped = srgb_encode(rgb)
    else:
        mapped = srgb_encode(aces_fit(rgb * auto_exposure(rgb)))
    out = [mapped]
    if channels >= 4:
        out.append(np.clip(data[..., 3:4], 0.0, 1.0))
    return (np.concatenate(out, axis=2) * 255.0 + 0.5).astype(np.uint8)
