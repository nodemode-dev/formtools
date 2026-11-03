import codecs
from pathlib import Path

from app.core.errors import ApiError
from app.core.filetypes import ext_of
from app.routers.fs import absolute

DEFAULT_MAX = 2097152
CEILING = 64 * 1024 * 1024
BOMS = (
    (b"\xff\xfe\x00\x00", "utf-32le"),
    (b"\x00\x00\xfe\xff", "utf-32be"),
    (b"\xef\xbb\xbf", "utf-8"),
    (b"\xff\xfe", "utf-16le"),
    (b"\xfe\xff", "utf-16be"),
)
STREAM_CODEC = {"utf-16le": "utf-16", "utf-16be": "utf-16", "utf-32le": "utf-32", "utf-32be": "utf-32", "utf-8": "utf-8-sig"}
LANGUAGES = {
    "py": "python",
    "pyw": "python",
    "js": "javascript",
    "mjs": "javascript",
    "cjs": "javascript",
    "jsx": "javascript",
    "ts": "typescript",
    "tsx": "typescript",
    "json": "json",
    "jsonl": "json",
    "yaml": "yaml",
    "yml": "yaml",
    "toml": "ini",
    "ini": "ini",
    "cfg": "ini",
    "conf": "ini",
    "xml": "xml",
    "html": "xml",
    "htm": "xml",
    "svg": "xml",
    "svelte": "xml",
    "vue": "xml",
    "css": "css",
    "scss": "scss",
    "md": "markdown",
    "markdown": "markdown",
    "sh": "bash",
    "bash": "bash",
    "zsh": "bash",
    "bat": "dos",
    "cmd": "dos",
    "ps1": "powershell",
    "c": "c",
    "h": "c",
    "cpp": "cpp",
    "hpp": "cpp",
    "cc": "cpp",
    "cs": "csharp",
    "java": "java",
    "kt": "kotlin",
    "rs": "rust",
    "go": "go",
    "sql": "sql",
    "rb": "ruby",
    "php": "php",
    "swift": "swift",
    "lua": "lua",
    "tex": "latex",
    "diff": "diff",
    "patch": "diff",
    "tf": "hcl",
    "r": "r",
    "pl": "perl",
}
NAMED = {"dockerfile": "dockerfile", "makefile": "makefile", "cmakelists.txt": "cmake"}


def language_of(name: str) -> str | None:
    named = NAMED.get(name.lower())
    if named:
        return named
    return LANGUAGES.get(ext_of(name))


def looks_utf16(sample: bytes) -> str | None:
    if len(sample) < 4:
        return None
    even = sample[0::2]
    odd = sample[1::2]
    zero_even = even.count(0) / max(1, len(even))
    zero_odd = odd.count(0) / max(1, len(odd))
    if zero_odd > 0.3 and zero_even < 0.05:
        return "utf-16le"
    if zero_even > 0.3 and zero_odd < 0.05:
        return "utf-16be"
    return None


def detect(sample: bytes, truncated: bool) -> tuple[str, bool, int]:
    for mark, label in BOMS:
        if sample.startswith(mark):
            return label, True, len(mark)
    try:
        codecs.getincrementaldecoder("utf-8")().decode(sample, final=not truncated)
    except UnicodeDecodeError:
        guess = looks_utf16(sample)
        return (guess or "cp1252"), False, 0
    if b"\x00" in sample:
        guess = looks_utf16(sample)
        if guess:
            return guess, False, 0
    return "utf-8", False, 0


def decode(sample: bytes, label: str, skip: int, truncated: bool) -> str:
    decoder = codecs.getincrementaldecoder(label)(errors="replace")
    return decoder.decode(sample[skip:], final=not truncated)


def line_breaks(text: str) -> tuple[str, int]:
    crlf = text.count("\r\n")
    lf = text.count("\n") - crlf
    cr = text.count("\r") - crlf
    kinds = [kind for kind, count in (("crlf", crlf), ("lf", lf), ("cr", cr)) if count]
    eol = "lf" if not kinds else kinds[0] if len(kinds) == 1 else "mixed"
    breaks = crlf + lf + cr
    lines = breaks + (1 if text and not text.endswith(("\n", "\r")) else 0)
    return eol, lines


def check_max(raw: int) -> int:
    if raw < 1:
        raise ApiError(400, "max must be at least 1 byte")
    return min(raw, CEILING)


def readable(raw: str) -> Path:
    path = absolute(raw)
    if not path.exists():
        raise ApiError(404, "that file does not exist")
    if not path.is_file():
        raise ApiError(400, "that path is not a file")
    return path


def read_text(raw: str, limit: int = DEFAULT_MAX) -> dict:
    path = readable(raw)
    limit = check_max(limit)
    try:
        with open(path, "rb") as handle:
            data = handle.read(limit + 1)
    except OSError:
        raise ApiError(400, "formtools is not allowed to read that file")
    truncated = len(data) > limit
    sample = data[:limit]
    label, bom, skip = detect(sample, truncated)
    text = decode(sample, label, skip, truncated)
    encoded = text.encode("utf-8", "replace")
    if len(encoded) > limit:
        text = encoded[:limit].decode("utf-8", "ignore")
        truncated = True
    eol, lines = line_breaks(text)
    return {
        "encoding": label,
        "bom": bom,
        "eol": eol,
        "lines": lines,
        "text": text,
        "truncated": truncated,
        "language": language_of(path.name),
    }


def stream_codec(path: Path) -> str:
    with open(path, "rb") as handle:
        sample = handle.read(65536)
    label, bom, _ = detect(sample, True)
    if bom:
        return STREAM_CODEC.get(label, label)
    return label
