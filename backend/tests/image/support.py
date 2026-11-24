import math
import struct
import zlib

from PIL import Image

A, B, C, D, E, F = (255, 0, 0), (0, 255, 0), (0, 0, 255), (255, 255, 0), (0, 255, 255), (90, 60, 30)
GRID = [[A, B, C], [D, E, F]]


def chunk(kind: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)


def orientation_tiff(value: int) -> bytes:
    return b"MM\x00\x2a\x00\x00\x00\x08" + struct.pack(">H", 1) + struct.pack(">HHIHH", 0x0112, 3, 1, value, 0) + b"\x00\x00\x00\x00"


def png_bytes(grid, orientation=None) -> bytes:
    height, width = len(grid), len(grid[0])
    channels = len(grid[0][0])
    colour_type = {3: 2, 4: 6}[channels]
    raw = b"".join(b"\x00" + b"".join(bytes(p) for p in row) for row in grid)
    out = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, colour_type, 0, 0, 0))
    if orientation is not None:
        out += chunk(b"eXIf", orientation_tiff(orientation))
    return out + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def grey16_png_bytes(rows) -> bytes:
    height, width = len(rows), len(rows[0])
    raw = b"".join(b"\x00" + b"".join(struct.pack(">H", v) for v in row) for row in rows)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 16, 0, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def ppm_bytes(grid) -> bytes:
    return b"P6\n%d %d\n255\n" % (len(grid[0]), len(grid)) + b"".join(bytes(p) for row in grid for p in row)


def hdr_bytes(rows, size_line=None) -> bytes:
    height, width = len(rows), len(rows[0])
    line = size_line or b"-Y %d +X %d" % (height, width)
    return b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n" + line + b"\n" + b"".join(bytes(p) for row in rows for p in row)


def hdr_run_length_bytes(rows) -> bytes:
    height, width = len(rows), len(rows[0])
    body = b""
    for row in rows:
        body += bytes((2, 2, width >> 8, width & 255))
        for channel in range(4):
            position = 0
            while position < width:
                run = 1
                while position + run < width and row[position + run][channel] == row[position][channel] and run < 127:
                    run += 1
                body += bytes((128 + run, row[position][channel]))
                position += run
    return b"#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n" + b"-Y %d +X %d\n" % (height, width) + body


def rgbe_value(mantissa: int, exponent: int) -> float:
    return (mantissa + 0.5) * 2.0 ** (exponent - 136) if exponent else 0.0


def srgb8(linear: float) -> int:
    x = min(1.0, max(0.0, linear))
    encoded = x * 12.92 if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return int(encoded * 255 + 0.5)


def aces(x: float) -> float:
    return min(1.0, max(0.0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)))


def read_grid(path):
    with Image.open(path) as image:
        image.load()
        width, height = image.size
        return [[image.getpixel((x, y)) for x in range(width)] for y in range(height)]


def flip_h(grid):
    return [list(reversed(row)) for row in grid]


def flip_v(grid):
    return [list(row) for row in reversed(grid)]


def turn_cw(grid):
    height, width = len(grid), len(grid[0])
    return [[grid[height - 1 - x][y] for x in range(height)] for y in range(width)]


def turn_ccw(grid):
    return turn_cw(turn_cw(turn_cw(grid)))


def turn_180(grid):
    return flip_v(flip_h(grid))


def transpose(grid):
    return [[grid[y][x] for y in range(len(grid))] for x in range(len(grid[0]))]


SHOWN_FOR_ORIENTATION = {
    1: lambda g: [list(r) for r in g],
    2: flip_h,
    3: turn_180,
    4: flip_v,
    5: transpose,
    6: turn_cw,
    7: lambda g: turn_180(transpose(g)),
    8: turn_ccw,
}


def close(grid, wanted, slack):
    assert len(grid) == len(wanted) and len(grid[0]) == len(wanted[0])
    return all(abs(a - b) <= slack for row, want in zip(grid, wanted) for p, q in zip(row, want) for a, b in zip(p[:3], q[:3]))


def error_of(reply):
    return reply.status_code, reply.json()["error"]
