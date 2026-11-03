from app.core import filetypes

ORDER = (
    "images",
    "raw",
    "video",
    "audio",
    "documents",
    "code",
    "data",
    "archives",
    "3d",
    "fonts",
    "apps",
    "system",
    "other",
)

LABELS = {
    "images": "Images",
    "raw": "Raw photos",
    "video": "Video",
    "audio": "Audio",
    "documents": "Documents",
    "code": "Code",
    "data": "Data",
    "archives": "Archives",
    "3d": "3D models",
    "fonts": "Fonts",
    "apps": "Apps and binaries",
    "system": "System and caches",
    "other": "Other",
}

GROUPS = {
    "images": filetypes.IMAGE - filetypes.RAW,
    "raw": filetypes.RAW,
    "video": filetypes.VIDEO,
    "audio": filetypes.AUDIO,
    "3d": filetypes.MODEL,
    "fonts": filetypes.FONT,
    "archives": filetypes.ARCHIVE,
    "documents": frozenset(
        (
            "pdf doc docx dot dotx odt ott rtf txt text md markdown rst adoc tex pages wpd xls xlsx xlsm xlsb ods "
            "ppt pptx pps ppsx odp key numbers epub mobi azw azw3 djvu xps oxps eml msg mbox log srt vtt ass"
        ).split()
    ),
    "code": frozenset(
        (
            "py pyi pyw js mjs cjs ts tsx jsx html htm xhtml css scss sass less rs go java kt kts scala groovy c h cc cpp cxx "
            "hpp hh hxx cs fs vb sh bash zsh fish bat cmd ps1 psm1 rb php pl pm r swift m mm lua dart vue svelte astro "
            "asm s cmake gradle mk makefile dockerfile ex exs erl hs ml clj zig nim jl sol glsl hlsl wgsl vert frag "
            "tf proto graphql gql ipynb"
        ).split()
    ),
    "data": frozenset(
        (
            "csv tsv json jsonl ndjson json5 xml yaml yml toml ini cfg conf properties plist sqlite sqlite3 db db3 mdb accdb "
            "parquet feather arrow orc avro npy npz pkl pickle h5 hdf5 mat sav rds rdata sql bson ldb dat lock env "
            "gitignore gitattributes editorconfig"
        ).split()
    ),
    "apps": frozenset(
        (
            "exe dll so dylib sys drv ocx msi msix appx pkg dmg deb rpm apk aab ipa appimage snap flatpak app bin elf "
            "o a lib obj ko pyc pyo class wasm node com scr"
        ).split()
    ),
}

EXT: dict[str, str] = {}
for _category in ORDER:
    for _ext in GROUPS.get(_category, ()):
        EXT[_ext] = _category
for _ext in ("jar", "war", "ear"):
    EXT[_ext] = "archives"
for _ext in ("pkg", "dmg", "deb", "rpm", "apk", "ipa", "appimage", "snap", "flatpak", "msi", "msix", "appx"):
    EXT[_ext] = "apps"
EXT["svg"] = "images"
EXT["obj"] = "3d"

NAMES = {
    "makefile": "code",
    "dockerfile": "code",
    "cmakelists.txt": "code",
    "rakefile": "code",
    "gemfile": "code",
    "license": "documents",
    "readme": "documents",
    "copying": "documents",
    "changelog": "documents",
    "authors": "documents",
}

SYSTEM_DIRS = frozenset(
    (
        ".cache caches cache node_modules __pycache__ target .git .gradle .npm .yarn .pnpm-store .tox .mypy_cache "
        ".pytest_cache .ruff_cache .next .nuxt .parcel-cache .nuget temp tmp $recycle.bin .trash .trashes .spotlight-v100 "
        ".fseventsd"
    ).split()
)

APP_SUFFIXES = (".app", ".framework", ".bundle", ".xpc", ".appex", ".plugin", ".kext")


def folder_category(name: str, inherited: str | None) -> str | None:
    if inherited is not None:
        return inherited
    low = name.lower()
    if low in SYSTEM_DIRS:
        return "system"
    if low.endswith(APP_SUFFIXES):
        return "apps"
    return None


def fix_ext(name: str, ext: str) -> str:
    if len(ext) > 12:
        return ""
    if ext.isdigit() and ".so." in name:
        return "so"
    return ext


def of_file(name: str, ext: str, executable: bool, forced: str | None) -> str:
    if forced is not None:
        return forced
    found = EXT.get(ext)
    if found is not None:
        return found
    if not ext:
        named = NAMES.get(name.lower())
        if named is not None:
            return named
        if executable:
            return "apps"
    return "other"
