from PIL import Image

T = Image.Transpose

ORIENTATION_TRANSPOSE = {
    2: T.FLIP_LEFT_RIGHT,
    3: T.ROTATE_180,
    4: T.FLIP_TOP_BOTTOM,
    5: T.TRANSPOSE,
    6: T.ROTATE_270,
    7: T.TRANSVERSE,
    8: T.ROTATE_90,
}

OPERATION_TRANSPOSE = {
    "rotate-cw": T.ROTATE_270,
    "rotate-ccw": T.ROTATE_90,
    "rotate-180": T.ROTATE_180,
    "flip-h": T.FLIP_LEFT_RIGHT,
    "flip-v": T.FLIP_TOP_BOTTOM,
}

OPERATIONS = tuple(OPERATION_TRANSPOSE)

PROBE_SIZE = (3, 2)


def valid(orientation) -> int:
    return orientation if isinstance(orientation, int) and 1 <= orientation <= 8 else 1


def apply(image: Image.Image, orientation) -> Image.Image:
    method = ORIENTATION_TRANSPOSE.get(valid(orientation))
    return image.transpose(method) if method is not None else image


def swaps_axes(orientation) -> bool:
    return valid(orientation) >= 5


def probe() -> Image.Image:
    image = Image.new("L", PROBE_SIZE)
    image.putdata(list(range(1, PROBE_SIZE[0] * PROBE_SIZE[1] + 1)))
    return image


def compose(current, operation: str) -> int:
    stored = probe()
    wanted = apply(stored, current).transpose(OPERATION_TRANSPOSE[operation])
    for candidate in range(1, 9):
        shown = apply(stored, candidate)
        if shown.size == wanted.size and list(shown.getdata()) == list(wanted.getdata()):
            return candidate
    return 1
