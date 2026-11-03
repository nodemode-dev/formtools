import os
import re
import threading
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, IptcImagePlugin

from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.routers.fs import absolute

SCAN_BYTES = 4 * 1024 * 1024
MAX_PATHS = 2000
PACKET_ID = "W5M0MpCehiHzreSzNTczkc9d"
IPTC_EXTENSIONS = frozenset(("jpg", "jpeg", "jpe", "jfif", "tif", "tiff"))
LOCK = threading.Lock()

RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#"
XMP = "http://ns.adobe.com/xap/1.0/"
DC = "http://purl.org/dc/elements/1.1/"
META = "adobe:ns:meta/"
NAMESPACES = {
    "x": META,
    "rdf": RDF,
    "xmp": XMP,
    "dc": DC,
    "xmpMM": "http://ns.adobe.com/xap/1.0/mm/",
    "xmpRights": "http://ns.adobe.com/xap/1.0/rights/",
    "photoshop": "http://ns.adobe.com/photoshop/1.0/",
    "tiff": "http://ns.adobe.com/tiff/1.0/",
    "exif": "http://ns.adobe.com/exif/1.0/",
    "aux": "http://ns.adobe.com/exif/1.0/aux/",
    "crs": "http://ns.adobe.com/camera-raw-settings/1.0/",
    "lr": "http://ns.adobe.com/lightroom/1.0/",
    "Iptc4xmpCore": "http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/",
    "stRef": "http://ns.adobe.com/xap/1.0/sType/ResourceRef#",
    "stEvt": "http://ns.adobe.com/xap/1.0/sType/ResourceEvent#",
}
for prefix, uri in NAMESPACES.items():
    ET.register_namespace(prefix, uri)

LABEL_NAMES = {
    "red": "red",
    "orange": "orange",
    "yellow": "yellow",
    "green": "green",
    "blue": "blue",
    "purple": "purple",
    "violet": "purple",
    "grey": "grey",
    "gray": "grey",
    "select": "red",
    "second": "yellow",
    "approved": "green",
    "review": "blue",
    "to do": "purple",
}
LABEL_TITLES = {"red": "Red", "orange": "Orange", "yellow": "Yellow", "green": "Green", "blue": "Blue", "purple": "Purple", "grey": "Grey"}

IPTC_FIELDS = (
    ((2, 105), "Headline"),
    ((2, 120), "Caption"),
    ((2, 80), "By-line"),
    ((2, 116), "Copyright"),
    ((2, 90), "City"),
    ((2, 101), "Country"),
)
IPTC_KEYWORDS = (2, 25)

PACKET_START = re.compile(rb"<(?:[A-Za-z_][\w.-]*:)?xmpmeta[\s>]")


def label_key(text) -> str | None:
    if not isinstance(text, str):
        return None
    return LABEL_NAMES.get(re.sub(r"\s+", " ", text).strip().casefold())


def rating_value(text) -> int | None:
    try:
        number = int(float(str(text).strip()))
    except (TypeError, ValueError, OverflowError):
        return None
    return max(0, min(5, number))


def sidecar_candidates(target: Path) -> list[Path]:
    return [target.with_name(target.name + ".xmp"), target.with_suffix(".xmp")]


def sidecar_path(target: Path) -> Path:
    return target.with_name(target.name + ".xmp")


def existing_sidecar(target: Path) -> Path | None:
    for candidate in sidecar_candidates(target):
        if candidate != target and candidate.is_file():
            return candidate
    return None


def local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def extract_packet(data: bytes) -> bytes | None:
    found = PACKET_START.search(data)
    if not found:
        return None
    opening = found.group(0)[1:-1].decode("ascii")
    prefix = opening[: opening.index("xmpmeta")]
    closing = f"</{prefix}xmpmeta>".encode("ascii")
    end = data.find(closing, found.start())
    if end < 0:
        return None
    return data[found.start() : end + len(closing)]


def parse_xml(data: bytes):
    if b"<!DOCTYPE" in data or b"<!ENTITY" in data:
        return None
    try:
        return ET.fromstring(data)
    except ET.ParseError:
        return None


def first_text(element) -> str | None:
    if element is None:
        return None
    items = [item for item in element.iter(f"{{{RDF}}}li")]
    if items:
        for item in items:
            if item.text and item.text.strip():
                return item.text.strip()
        return None
    return element.text.strip() if element.text and element.text.strip() else None


def all_texts(element) -> list[str]:
    if element is None:
        return []
    return [item.text.strip() for item in element.iter(f"{{{RDF}}}li") if item.text and item.text.strip()]


def property_node(description, namespace: str, name: str):
    return description.find(f"{{{namespace}}}{name}")


def read_properties(root) -> dict:
    found = {}
    if root is None:
        return found
    for description in root.iter(f"{{{RDF}}}Description"):
        raw_rating = description.get(f"{{{XMP}}}Rating")
        if raw_rating is None:
            raw_rating = first_text(property_node(description, XMP, "Rating"))
        if raw_rating is not None and "rating" not in found:
            parsed = rating_value(raw_rating)
            if parsed is not None:
                found["rating"] = parsed
        raw_label = description.get(f"{{{XMP}}}Label")
        if raw_label is None:
            raw_label = first_text(property_node(description, XMP, "Label"))
        if raw_label is not None and "label" not in found:
            found["label"] = label_key(raw_label)
        for key, name in (("title", "title"), ("description", "description"), ("rights", "rights")):
            if key in found:
                continue
            value = description.get(f"{{{DC}}}{name}") or first_text(property_node(description, DC, name))
            if value:
                found[key] = value
        if "creator" not in found:
            value = description.get(f"{{{DC}}}creator") or first_text(property_node(description, DC, "creator"))
            if value:
                found["creator"] = value
        if "keywords" not in found:
            words = all_texts(property_node(description, DC, "subject"))
            if words:
                found["keywords"] = words
    return found


def read_sidecar(target: Path) -> dict:
    sidecar = existing_sidecar(target)
    if sidecar is None:
        return {}
    try:
        data = sidecar.read_bytes()[:SCAN_BYTES]
    except OSError:
        return {}
    packet = extract_packet(data) or data
    return read_properties(parse_xml(packet))


def read_embedded(target: Path) -> dict:
    try:
        with open(target, "rb") as handle:
            data = handle.read(SCAN_BYTES)
    except OSError:
        return {}
    packet = extract_packet(data)
    if packet is None:
        return {}
    return read_properties(parse_xml(packet))


def combined(target: Path) -> dict:
    sidecar = read_sidecar(target)
    if "rating" in sidecar and "label" in sidecar:
        return sidecar
    embedded = read_embedded(target)
    merged = dict(embedded)
    merged.update(sidecar)
    return merged


def effective(target: Path) -> dict:
    found = combined(target)
    return {"rating": found.get("rating", 0), "label": found.get("label")}


def decode_text(value) -> str:
    if isinstance(value, bytes):
        try:
            text = value.decode("utf-8")
        except UnicodeDecodeError:
            text = value.decode("latin-1")
    else:
        text = str(value)
    return text.replace("\x00", "").strip()


def read_iptc(target: Path) -> dict:
    if ext_of(target.name) not in IPTC_EXTENSIONS:
        return {}
    try:
        with Image.open(target) as image:
            raw = IptcImagePlugin.getiptcinfo(image)
    except Exception:
        return {}
    if not raw:
        return {}
    found = {}
    for key, name in IPTC_FIELDS:
        value = raw.get(key)
        if isinstance(value, list):
            value = value[0] if value else None
        if value is not None:
            text = decode_text(value)
            if text:
                found[name] = text[:2000]
    words = raw.get(IPTC_KEYWORDS)
    if words is not None:
        listed = words if isinstance(words, list) else [words]
        cleaned = [decode_text(item) for item in listed]
        cleaned = [item for item in cleaned if item]
        if cleaned:
            found["Keywords"] = cleaned
    return found


def attach(found: dict, target: Path) -> None:
    found["iptc"] = read_iptc(target)
    merged = combined(target)
    xmp = {"rating": merged.get("rating"), "label": merged.get("label")}
    for key in ("title", "description", "keywords", "creator", "rights"):
        if key in merged:
            xmp[key] = merged[key]
    found["xmp"] = xmp


def read_many(paths: list[str]) -> dict:
    if not isinstance(paths, list):
        raise ApiError(400, "paths must be a list")
    if len(paths) > MAX_PATHS:
        raise ApiError(400, f"at most {MAX_PATHS} paths can be read at once")
    items = {}
    for raw in paths:
        item = {"rating": 0, "label": None}
        try:
            target = absolute(raw)
            if target.is_file():
                item = effective(target)
        except (ApiError, OSError, ValueError):
            pass
        items[raw] = item
    return {"items": items}


def build_tree(seed: bytes | None):
    if seed is None:
        meta = ET.Element(f"{{{META}}}xmpmeta")
        meta.set(f"{{{META}}}xmptk", "formtools")
        rdf = ET.SubElement(meta, f"{{{RDF}}}RDF")
        return meta, rdf
    packet = extract_packet(seed) or seed
    root = parse_xml(packet)
    if root is None:
        raise ApiError(400, "the existing XMP sidecar cannot be read, so formtools left it alone")
    if root.tag == f"{{{RDF}}}RDF":
        meta = ET.Element(f"{{{META}}}xmpmeta")
        meta.set(f"{{{META}}}xmptk", "formtools")
        meta.append(root)
        return meta, root
    if local(root.tag) != "xmpmeta":
        raise ApiError(400, "the existing XMP sidecar is not an XMP packet, so formtools left it alone")
    rdf = root.find(f"{{{RDF}}}RDF")
    if rdf is None:
        rdf = ET.SubElement(root, f"{{{RDF}}}RDF")
    return root, rdf


def set_property(description, name: str, value: str | None) -> None:
    key = f"{{{XMP}}}{name}"
    description.attrib.pop(key, None)
    for child in list(description.findall(key)):
        description.remove(child)
    if value is not None:
        description.set(key, value)


def serialise(meta) -> bytes:
    ET.indent(meta, space="  ")
    body = ET.tostring(meta, encoding="utf-8")
    head = f'<?xpacket begin="﻿" id="{PACKET_ID}"?>\n'.encode("utf-8")
    return head + body + b'\n<?xpacket end="w"?>\n'


def write_atomic(path: Path, data: bytes) -> None:
    temporary = path.with_name(f".{path.name}.formtools-{os.getpid()}.tmp")
    try:
        temporary.write_bytes(data)
        os.replace(temporary, path)
    finally:
        if temporary.exists():
            temporary.unlink(missing_ok=True)


def write(raw: str, rating, label, has_rating: bool, has_label: bool) -> dict:
    from app.tools.image.service import existing_file

    target = existing_file(raw)
    if has_rating and (not isinstance(rating, int) or isinstance(rating, bool) or not 0 <= rating <= 5):
        raise ApiError(400, "rating must be a whole number from 0 to 5")
    key = None
    if has_label and label is not None:
        key = label_key(label)
        if key is None:
            raise ApiError(400, "label must be red, orange, yellow, green, blue, purple, grey or null")
    if not has_rating and not has_label:
        return effective(target)
    destination = sidecar_path(target)
    with LOCK:
        source = existing_sidecar(target)
        try:
            seed = source.read_bytes() if source else None
        except OSError:
            raise ApiError(400, "formtools is not allowed to read that sidecar")
        current = effective(target)
        if seed is None and (not has_rating or rating == current["rating"]) and (not has_label or key == current["label"]):
            return current
        meta, rdf = build_tree(seed)
        description = rdf.find(f"{{{RDF}}}Description")
        if description is None:
            description = ET.SubElement(rdf, f"{{{RDF}}}Description")
            description.set(f"{{{RDF}}}about", "")
        if has_rating:
            set_property(description, "Rating", str(rating))
        if has_label:
            set_property(description, "Label", LABEL_TITLES[key] if key else "")
        try:
            write_atomic(destination, serialise(meta))
        except PermissionError:
            raise ApiError(400, "formtools is not allowed to write beside that file")
        except OSError as exc:
            raise ApiError(400, f"the sidecar could not be written ({exc.strerror or 'error'})")
    return effective(target)
