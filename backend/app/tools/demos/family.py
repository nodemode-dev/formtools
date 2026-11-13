import csv
import hashlib
import io
import json
import random
import sqlite3
import zipfile
from datetime import date, timedelta
from pathlib import Path

from PIL import Image, ImageDraw

from app.tools.demos import art, pixelfont

PEOPLE = ("Ada Brook", "Ravi Lune", "Mina Holt", "Theo Vance", "Iris Calder", "Jun Okafor", "Lena Marsh", "Oskar Fenn")
ITEMS = (("Field notebook", 6.5), ("Pencil set", 4.0), ("Canvas tote", 12.0), ("Enamel mug", 9.5), ("Poster print", 18.0), ("Sticker sheet", 3.0))
README = """# A shelf of Form files

Every file in this folder was made by the formtools demo generator on this computer. The names, orders and prices are invented.

- harbour-poster.fvd: a formvis project with three layers and a stored preview
- orders.csv, settings.json, notes.txt and resize.py: text, data and code
- inventory.sqlite: a small database with two tables
- invoice.pdf: two pages drawn by the generator
- Demo Pixel.ttf: a font the generator builds from its own pixel glyphs
- shelf.zip: an archive to browse and extract
- SHA256SUMS: checksums of the files above, to verify with Checksums
"""
NOTES = "Shelf notes\n\nCheck the poster layers in the Form projects viewer.\nVerify SHA256SUMS after copying the folder.\nOpen shelf.zip without extracting it first.\n"
CODE = '''from pathlib import Path


def sizes(folder: str) -> dict[str, int]:
    """Return the size of every file in a folder, largest first."""
    found = {p.name: p.stat().st_size for p in Path(folder).iterdir() if p.is_file()}
    return dict(sorted(found.items(), key=lambda item: item[1], reverse=True))


if __name__ == "__main__":
    for name, size in sizes(".").items():
        print(f"{size:>10}  {name}")
'''


def orders(rng: random.Random) -> list[list]:
    rows = []
    day = date(2026, 3, 2)
    for number in range(1, 121):
        item, price = rng.choice(ITEMS)
        rows.append([f"A-{1000 + number}", (day + timedelta(days=number // 3)).isoformat(), rng.choice(PEOPLE), item, rng.randint(1, 5), f"{price:.2f}"])
    return rows


def poster_layers(width: int, height: int) -> list[tuple[str, Image.Image]]:
    sky = art.landscape(4100, width, height, "dusk", (0.5, 0.34)).convert("RGBA")
    hills = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(hills)
    draw.polygon([(0, height * 0.78), (width * 0.3, height * 0.7), (width * 0.62, height * 0.8), (width, height * 0.72), (width, height), (0, height)], fill=(20, 12, 30, 255))
    title = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(title)
    art.text(draw, (int(width * 0.1), int(height * 0.08)), "HARBOUR", width // 9, (255, 240, 220, 255))
    art.text(draw, (int(width * 0.1), int(height * 0.08) + width // 7), "LIGHTS", width // 9, (255, 196, 140, 255))
    art.text(draw, (int(width * 0.1), int(height * 0.88)), "FRIDAY 9 PM - PIER 4", width // 30, (255, 240, 220, 255))
    return [("Sky", sky), ("Hills", hills), ("Title", title)]


def write_fvd(path: Path) -> None:
    width, height = 900, 1200
    layers = poster_layers(width, height)
    composite = Image.new("RGBA", (width, height))
    for _, layer in layers:
        composite = Image.alpha_composite(composite, layer)
    manifest = {
        "format": "com.nodemode.formvis",
        "version": 1,
        "width": width,
        "height": height,
        "depth": 8,
        "mode": "rgb",
        "colorSpace": "sRGB",
        "layers": [{"name": name, "imageFile": f"{name.lower()}.png", "visible": True, "opacity": 1} for name, _ in layers],
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, indent=2))
        for name, layer in layers:
            buffer = io.BytesIO()
            layer.save(buffer, "PNG")
            archive.writestr(f"images/{name.lower()}.png", buffer.getvalue())
        buffer = io.BytesIO()
        composite.convert("RGB").resize((300, 400), Image.Resampling.LANCZOS).save(buffer, "PNG")
        archive.writestr("thumbnail.png", buffer.getvalue())


def write_sqlite(path: Path, rows: list[list]) -> None:
    db = sqlite3.connect(path)
    try:
        db.execute("CREATE TABLE items (name TEXT PRIMARY KEY, price REAL NOT NULL, stock INTEGER NOT NULL)")
        db.execute("CREATE TABLE orders (id TEXT PRIMARY KEY, day TEXT NOT NULL, customer TEXT NOT NULL, item TEXT NOT NULL REFERENCES items(name), qty INTEGER NOT NULL)")
        db.executemany("INSERT INTO items VALUES (?, ?, ?)", [(name, price, 40 + i * 7) for i, (name, price) in enumerate(ITEMS)])
        db.executemany("INSERT INTO orders VALUES (?, ?, ?, ?, ?)", [row[:5] for row in rows])
        db.commit()
    finally:
        db.close()


def write_pdf(path: Path, rows: list[list]) -> None:
    pages = []
    for page_number, chunk in enumerate((rows[:24], rows[24:48]), start=1):
        page = Image.new("RGB", (827, 1169), (255, 255, 255))
        draw = ImageDraw.Draw(page)
        draw.rectangle((0, 0, 827, 120), fill=(24, 22, 30))
        art.text(draw, (56, 40), "SHELF SUPPLY CO.", 30, (255, 255, 255))
        art.text(draw, (56, 84), f"INVOICE 2026-031 - PAGE {page_number} OF 2", 14, (249, 115, 22))
        y = 170
        for heading, x in (("ORDER", 56), ("DATE", 196), ("ITEM", 356), ("QTY", 620), ("PRICE", 700)):
            art.text(draw, (x, y), heading, 13, (110, 110, 120))
        draw.line((56, y + 26, 771, y + 26), fill=(200, 200, 205), width=2)
        y += 44
        for order_id, day, _, item, qty, price in chunk:
            for value, x in ((order_id, 56), (day, 196), (item, 356), (str(qty), 620), (price, 700)):
                art.text(draw, (x, y), value, 13, (30, 30, 36))
            y += 34
        total = sum(int(r[4]) * float(r[5]) for r in chunk)
        draw.line((56, y + 6, 771, y + 6), fill=(200, 200, 205), width=2)
        art.text(draw, (520, y + 22), f"TOTAL {total:.2f}", 18, (30, 30, 36))
        pages.append(page)
    pages[0].save(path, "PDF", resolution=100.0, save_all=True, append_images=pages[1:], title="Invoice 2026-031", author="formtools demo")


def build(folder: Path) -> list[str]:
    rng = random.Random(77)
    rows = orders(rng)
    with open(folder / "orders.csv", "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["order", "date", "customer", "item", "qty", "price"])
        writer.writerows(rows)
    (folder / "README.md").write_text(README, encoding="utf-8")
    (folder / "notes.txt").write_text(NOTES, encoding="utf-8")
    (folder / "resize.py").write_text(CODE, encoding="utf-8")
    settings = {"shop": "Shelf Supply Co.", "currency": "EUR", "tax": 0.2, "open": {"weekdays": "09:00-18:00", "saturday": "10:00-14:00"}, "shelves": [{"id": i, "label": f"Shelf {chr(65 + i)}", "items": rng.randint(8, 30)} for i in range(5)]}
    (folder / "settings.json").write_text(json.dumps(settings, indent=2) + "\n", encoding="utf-8")
    write_fvd(folder / "harbour-poster.fvd")
    write_sqlite(folder / "inventory.sqlite", rows)
    write_pdf(folder / "invoice.pdf", rows)
    pixelfont.build(folder / "Demo Pixel.ttf")
    with zipfile.ZipFile(folder / "shelf.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for name in ("orders.csv", "README.md", "notes.txt"):
            archive.write(folder / name, f"shelf/{name}")
        buffer = io.BytesIO()
        art.landscape(4200, 480, 320, "mist").save(buffer, "PNG")
        archive.writestr("shelf/pictures/mist.png", buffer.getvalue())
    lines = []
    for item in sorted(p for p in folder.iterdir() if p.is_file()):
        lines.append(f"{hashlib.sha256(item.read_bytes()).hexdigest()}  {item.name}")
    (folder / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return []


def cover(width: int, height: int) -> Image.Image:
    sheet = Image.new("RGB", (width, height), (22, 20, 28))
    draw = ImageDraw.Draw(sheet)
    draw.rectangle((0, int(height * 0.78), width, height), fill=(48, 36, 30))
    draw.rectangle((0, int(height * 0.76), width, int(height * 0.78)), fill=(90, 66, 52))
    labels = (("FVD", (249, 115, 22)), ("CSV", (62, 123, 250)), ("PDF", (229, 72, 77)), ("ZIP", (70, 167, 88)), ("TTF", (154, 92, 255)), ("SQL", (242, 192, 55)))
    card_w = (width - 40) // len(labels) - 12
    for index, (label, colour) in enumerate(labels):
        x = 26 + index * (card_w + 12)
        tall = int(height * (0.46 + 0.06 * (index % 3)))
        top = int(height * 0.76) - tall
        draw.rounded_rectangle((x, top, x + card_w, int(height * 0.76)), radius=10, fill=(236, 232, 226))
        draw.rectangle((x, top + 18, x + card_w, top + 52), fill=colour)
        art.text(draw, (x + card_w // 2 - 27, top + 25), label, 20, (255, 255, 255))
        for line in range(4):
            draw.rectangle((x + 12, top + 72 + line * 18, x + card_w - 12 - (line % 2) * 18, top + 80 + line * 18), fill=(190, 186, 180))
    return sheet
