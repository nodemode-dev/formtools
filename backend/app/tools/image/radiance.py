import numpy as np

from app.core.errors import ApiError


def read_header(handle) -> tuple[int, int, bool, bool]:
    first = handle.readline()
    if not first.startswith(b"#?"):
        raise ApiError(415, "that file is not a Radiance HDR picture")
    while True:
        line = handle.readline()
        if not line:
            raise ApiError(415, "the Radiance HDR header is cut short")
        if line.strip() == b"":
            break
    parts = handle.readline().split()
    if len(parts) != 4 or parts[0][1:] not in (b"Y", b"X"):
        raise ApiError(415, "the Radiance HDR size line is not understood")
    if parts[0][1:] != b"Y":
        raise ApiError(415, "rotated Radiance HDR layouts are not supported")
    height, width = int(parts[1]), int(parts[3])
    return width, height, parts[0][:1] == b"-", parts[2][:1] == b"+"


def read_run_length_scanline(handle, width: int) -> np.ndarray:
    row = np.zeros((width, 4), dtype=np.uint8)
    for channel in range(4):
        position = 0
        while position < width:
            count = handle.read(1)
            if not count:
                raise ApiError(415, "the Radiance HDR pixel data is cut short")
            count = count[0]
            if count > 128:
                run = count - 128
                value = handle.read(1)
                if not value or position + run > width:
                    raise ApiError(415, "the Radiance HDR pixel data is damaged")
                row[position : position + run, channel] = value[0]
                position += run
            else:
                if count == 0 or position + count > width:
                    raise ApiError(415, "the Radiance HDR pixel data is damaged")
                chunk = handle.read(count)
                if len(chunk) != count:
                    raise ApiError(415, "the Radiance HDR pixel data is cut short")
                row[position : position + count, channel] = np.frombuffer(chunk, dtype=np.uint8)
                position += count
    return row


def read(path: str) -> np.ndarray:
    with open(path, "rb") as handle:
        width, height, top_down, left_right = read_header(handle)
        if width * height > 400_000_000:
            raise ApiError(400, "that picture is larger than 400 megapixels")
        rows = []
        for _ in range(height):
            lead = handle.read(4)
            if len(lead) < 4:
                raise ApiError(415, "the Radiance HDR pixel data is cut short")
            if 8 <= width < 32768 and lead[0] == 2 and lead[1] == 2 and (lead[2] & 0x80) == 0 and (lead[2] << 8 | lead[3]) == width:
                rows.append(read_run_length_scanline(handle, width))
            else:
                rest = handle.read((width - 1) * 4)
                if len(rest) != (width - 1) * 4:
                    raise ApiError(415, "the Radiance HDR pixel data is cut short")
                rows.append(np.frombuffer(lead + rest, dtype=np.uint8).reshape(width, 4))
    packed = np.stack(rows).astype(np.float32)
    exponent = packed[..., 3:4]
    scale = np.where(exponent > 0, np.ldexp(1.0, (exponent - 136).astype(np.int32)), 0.0).astype(np.float32)
    rgb = (packed[..., :3] + 0.5) * scale
    rgb = np.where(exponent > 0, rgb, 0.0)
    if not top_down:
        rgb = rgb[::-1]
    if not left_right:
        rgb = rgb[:, ::-1]
    return np.ascontiguousarray(rgb)
