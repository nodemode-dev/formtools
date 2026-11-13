from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

FAMILY = "Demo Pixel"
UNIT = 100
WIDTH = 6
ASCENT = 8
GLYPHS = {
    "A": ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    "B": "####.|#...#|#...#|####.|#...#|#...#|####.",
    "C": ".###.|#...#|#....|#....|#....|#...#|.###.",
    "D": "####.|#...#|#...#|#...#|#...#|#...#|####.",
    "E": "#####|#....|#....|####.|#....|#....|#####",
    "F": "#####|#....|#....|####.|#....|#....|#....",
    "G": ".###.|#...#|#....|#.###|#...#|#...#|.####",
    "H": "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    "I": ".###.|..#..|..#..|..#..|..#..|..#..|.###.",
    "J": "..###|...#.|...#.|...#.|#..#.|#..#.|.##..",
    "K": "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    "L": "#....|#....|#....|#....|#....|#....|#####",
    "M": "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
    "N": "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    "O": ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    "P": "####.|#...#|#...#|####.|#....|#....|#....",
    "Q": ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    "R": "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    "S": ".####|#....|#....|.###.|....#|....#|####.",
    "T": "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    "U": "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    "V": "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    "W": "#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.",
    "X": "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    "Y": "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    "Z": "#####|....#|...#.|..#..|.#...|#....|#####",
    "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
    "3": "#####|...#.|..#..|...#.|....#|#...#|.###.",
    "4": "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    "5": "#####|#....|####.|....#|....#|#...#|.###.",
    "6": "..##.|.#...|#....|####.|#...#|#...#|.###.",
    "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
    "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    "9": ".###.|#...#|#...#|.####|....#|...#.|.##..",
    ".": ".....|.....|.....|.....|.....|.##..|.##..",
    ",": ".....|.....|.....|.....|.##..|..#..|.#...",
    ":": ".....|.##..|.##..|.....|.##..|.##..|.....",
    "-": ".....|.....|.....|#####|.....|.....|.....",
    "+": ".....|..#..|..#..|#####|..#..|..#..|.....",
    "/": "....#|....#|...#.|..#..|.#...|#....|#....",
    "#": ".#.#.|.#.#.|#####|.#.#.|#####|.#.#.|.#.#.",
    "%": "##..#|##..#|...#.|..#..|.#...|#..##|#..##",
    "(": "...#.|..#..|.#...|.#...|.#...|..#..|...#.",
    ")": ".#...|..#..|...#.|...#.|...#.|..#..|.#...",
    "'": "..#..|..#..|.#...|.....|.....|.....|.....",
    "&": ".##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#",
    "=": ".....|.....|#####|.....|#####|.....|.....",
}
NAMES = {".": "period", ",": "comma", ":": "colon", "-": "hyphen", "+": "plus", "/": "slash", "#": "numbersign", "%": "percent", "(": "parenleft", ")": "parenright", "'": "quotesingle", "&": "ampersand", "=": "equal"}


def glyph_name(ch: str) -> str:
    if ch.isdigit():
        return ("zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine")[int(ch)]
    return NAMES.get(ch, ch)


def draw(rows: str):
    pen = TTGlyphPen(None)
    for row_index, row in enumerate(rows.split("|")):
        top = (6 - row_index) * UNIT
        col = 0
        while col < len(row):
            if row[col] != "#":
                col += 1
                continue
            start = col
            while col < len(row) and row[col] == "#":
                col += 1
            x0, x1 = (start + 0.5) * UNIT, (col + 0.5) * UNIT
            pen.moveTo((x0, top))
            pen.lineTo((x0, top + UNIT))
            pen.lineTo((x1, top + UNIT))
            pen.lineTo((x1, top))
            pen.closePath()
    return pen.glyph()


def build(path: Path) -> None:
    order = [".notdef", "space"] + [glyph_name(ch) for ch in GLYPHS]
    builder = FontBuilder(UNIT * 10, isTTF=True)
    builder.setupGlyphOrder(order)
    cmap = {ord(" "): "space"}
    for ch in GLYPHS:
        cmap[ord(ch)] = glyph_name(ch)
        if ch.isalpha():
            cmap[ord(ch.lower())] = glyph_name(ch)
    builder.setupCharacterMap(cmap)
    notdef = TTGlyphPen(None)
    notdef.moveTo((UNIT, 0))
    notdef.lineTo((UNIT, ASCENT * UNIT))
    notdef.lineTo((WIDTH * UNIT - UNIT, ASCENT * UNIT))
    notdef.lineTo((WIDTH * UNIT - UNIT, 0))
    notdef.closePath()
    glyphs = {".notdef": notdef.glyph(), "space": TTGlyphPen(None).glyph()}
    for ch, rows in GLYPHS.items():
        glyphs[glyph_name(ch)] = draw(rows)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (WIDTH * UNIT, 0) for name in order})
    builder.setupHorizontalHeader(ascent=ASCENT * UNIT + UNIT, descent=-2 * UNIT)
    builder.setupNameTable({"familyName": FAMILY, "styleName": "Regular", "uniqueFontIdentifier": "formtools: Demo Pixel", "fullName": f"{FAMILY} Regular", "psName": "DemoPixel-Regular", "version": "Version 1.000", "copyright": "Made by the formtools demo generator", "licenseDescription": "Apache-2.0"})
    builder.setupOS2(sTypoAscender=ASCENT * UNIT + UNIT, sTypoDescender=-2 * UNIT, usWinAscent=ASCENT * UNIT + UNIT, usWinDescent=2 * UNIT)
    builder.setupPost()
    builder.save(str(path))
