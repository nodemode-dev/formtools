import pytest
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTCollection, TTFont

from app.tools.files import fonts


def build_font(path, family="Form Test", style="Regular", codes=(65, 66, 0x4E2D, 0x20AC), license_text="Free to use"):
    names = [".notdef"] + [f"g{c:x}" for c in codes]
    builder = FontBuilder(1000, isTTF=True)
    builder.setupGlyphOrder(names)
    builder.setupCharacterMap({c: f"g{c:x}" for c in codes})
    empty = TTGlyphPen(None).glyph()
    builder.setupGlyf({n: empty for n in names})
    builder.setupHorizontalMetrics({n: (500, 0) for n in names})
    builder.setupHorizontalHeader(ascent=800, descent=-200)
    builder.setupNameTable({"familyName": family, "styleName": style, "licenseDescription": license_text, "psName": f"{family.replace(' ', '')}-{style}", "fullName": f"{family} {style}", "uniqueFontIdentifier": f"{family}-{style}"})
    builder.setupOS2(sTypoAscender=800, usWinAscent=800, usWinDescent=200)
    builder.setupPost()
    builder.save(str(path))
    return path


@pytest.fixture
def user_folder(tmp_path, monkeypatch):
    folder = tmp_path / "userfonts"
    monkeypatch.setattr(fonts, "user_dir", lambda: folder)
    monkeypatch.setattr(fonts, "font_dirs", lambda: [folder])
    monkeypatch.setattr(fonts.shutil, "which", lambda name: None)
    return folder


def test_font_info_reports_the_names_glyph_count_and_format_written_into_the_font(client, tmp_path, user_folder):
    path = build_font(tmp_path / "t.ttf", family="Form Sans", style="Bold")
    info = client.get("/api/font/info", params={"path": str(path)}).json()
    assert info["family"] == "Form Sans"
    assert info["subfamily"] == "Bold"
    assert info["full_name"] == "Form Sans Bold"
    assert info["postscript"] == "FormSans-Bold"
    assert info["license"] == "Free to use"
    assert info["glyphs"] == 5
    assert (info["format"], info["faces"]) == ("TrueType", 1)
    assert info["installed"] is False


def test_font_coverage_counts_characters_per_unicode_block(client, tmp_path, user_folder):
    path = build_font(tmp_path / "t.ttf", codes=(65, 66, 67, 0x4E2D, 0x4E2E, 0x20AC))
    info = client.get("/api/font/info", params={"path": str(path)}).json()
    assert {c["block"]: c["count"] for c in info["coverage"]} == {"Basic Latin": 3, "CJK Unified Ideographs": 2, "Currency Symbols": 1}
    assert info["coverage"][0] == {"block": "Basic Latin", "count": 3}


def test_a_font_converted_to_woff_is_reported_as_woff_with_the_same_names(client, tmp_path, user_folder):
    path = build_font(tmp_path / "t.ttf", family="Web Face")
    font = TTFont(str(path))
    font.flavor = "woff"
    woff = tmp_path / "t.woff"
    font.save(str(woff))
    info = client.get("/api/font/info", params={"path": str(woff)}).json()
    assert (info["format"], info["family"], info["glyphs"]) == ("WOFF", "Web Face", 5)


def test_a_collection_reports_its_face_count_and_the_first_face(client, tmp_path, user_folder):
    one = build_font(tmp_path / "one.ttf", family="First Face")
    two = build_font(tmp_path / "two.ttf", family="Second Face")
    collection = TTCollection()
    collection.fonts = [TTFont(str(one)), TTFont(str(two))]
    ttc = tmp_path / "pair.ttc"
    collection.save(str(ttc))
    info = client.get("/api/font/info", params={"path": str(ttc)}).json()
    assert (info["format"], info["faces"], info["family"]) == ("collection", 2, "First Face")


def test_a_file_that_is_not_a_font_is_refused(client, tmp_path):
    bad = tmp_path / "bad.ttf"
    bad.write_bytes(b"this is definitely not a font file" * 10)
    reply = client.get("/api/font/info", params={"path": str(bad)})
    assert (reply.status_code, reply.json()["error"]) == (415, "that file is not a font formtools can read")


def test_installing_a_font_copies_it_into_the_user_font_folder_byte_for_byte(client, tmp_path, user_folder):
    path = build_font(tmp_path / "inst.ttf")
    reply = client.post("/api/font/install", json={"path": str(path)})
    assert reply.status_code == 200 and reply.json() == {"ok": True, "path": str(user_folder / "inst.ttf")}
    assert (user_folder / "inst.ttf").read_bytes() == path.read_bytes()
    assert [p.name for p in user_folder.iterdir()] == ["inst.ttf"]


def test_after_installing_the_font_info_says_it_is_installed(client, tmp_path, user_folder):
    path = build_font(tmp_path / "inst.ttf")
    client.post("/api/font/install", json={"path": str(path)})
    assert client.get("/api/font/info", params={"path": str(path)}).json()["installed"] is True


def test_installing_the_same_font_twice_is_accepted_and_changes_nothing(client, tmp_path, user_folder):
    path = build_font(tmp_path / "inst.ttf")
    client.post("/api/font/install", json={"path": str(path)})
    again = client.post("/api/font/install", json={"path": str(path)})
    assert again.status_code == 200
    assert [p.name for p in user_folder.iterdir()] == ["inst.ttf"]


def test_installing_a_different_font_with_an_installed_name_is_refused_and_keeps_the_first(client, tmp_path, user_folder):
    (tmp_path / "a").mkdir()
    first = build_font(tmp_path / "a" / "same.ttf")
    second_dir = tmp_path / "b"
    second_dir.mkdir()
    second = build_font(second_dir / "same.ttf", family="Another")
    client.post("/api/font/install", json={"path": str(first)})
    reply = client.post("/api/font/install", json={"path": str(second)})
    assert (reply.status_code, reply.json()["error"]) == (400, "a different font file with that name is already installed")
    assert (user_folder / "same.ttf").read_bytes() == first.read_bytes()


def test_web_font_extensions_cannot_be_installed(client, tmp_path, user_folder):
    woff = tmp_path / "w.woff"
    woff.write_bytes(b"wOFF" + bytes(40))
    reply = client.post("/api/font/install", json={"path": str(woff)})
    assert (reply.status_code, reply.json()["error"]) == (415, "only TrueType and OpenType fonts (ttf, otf, ttc, otc) can be installed; web fonts cannot")
    assert not user_folder.exists()


def test_a_broken_file_named_ttf_is_not_installed(client, tmp_path, user_folder):
    bad = tmp_path / "bad.ttf"
    bad.write_bytes(b"nope" * 100)
    reply = client.post("/api/font/install", json={"path": str(bad)})
    assert reply.status_code == 415
    assert not (user_folder / "bad.ttf").exists()
