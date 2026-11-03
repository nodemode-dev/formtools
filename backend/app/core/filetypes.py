import mimetypes

FAMILY = frozenset("fvd fmv formvis fc fmw fsc fequeue fldb".split())

RAW = frozenset(
    "3fr ari arw bay cr2 cr3 crw dcr dng erf fff iiq k25 kdc mef mos mrw nef nrw orf pef raf raw rw2 rwl sr2 srf srw x3f".split()
)

IMAGE = frozenset(
    (
        "jpg jpeg jpe jfif png apng gif webp avif avifs bmp dib ico cur icns tif tiff heic heif heics heifs jxl "
        "jp2 j2k jpf jpx tga qoi dds pcx ppm pgm pbm pnm pfm svg psd psb exr hdr"
    ).split()
) | RAW

VIDEO = frozenset("mp4 m4v mov mkv webm avi wmv flv mpg mpeg mts m2ts 3gp 3g2 ogv vob mxf".split())

AUDIO = frozenset("mp3 wav flac aac m4a ogg oga opus wma aiff aif aifc mka caf amr".split())

MODEL = frozenset("glb gltf obj fbx stl ply 3mf dae usd usda usdc usdz step stp iges igs blend off 3ds".split())

TEXT = frozenset(
    (
        "txt md markdown json jsonl yaml yml toml xml html htm css scss js mjs cjs ts tsx jsx py rs go java kt c h cpp hpp "
        "cs sh bash zsh bat cmd ps1 ini cfg conf log csv tsv sql rb php swift lua srt vtt tex rtf env gitignore "
        "svelte vue lock"
    ).split()
)

ARCHIVE = frozenset("zip tar gz tgz bz2 tbz2 xz txz 7z rar zst lz4 cab iso dmg jar".split())

FONT = frozenset("ttf otf ttc woff woff2 eot".split())

EXTRA_MIME = {
    "webp": "image/webp",
    "avif": "image/avif",
    "heic": "image/heic",
    "heif": "image/heif",
    "jxl": "image/jxl",
    "svg": "image/svg+xml",
    "ico": "image/x-icon",
    "exr": "image/x-exr",
    "hdr": "image/vnd.radiance",
    "psd": "image/vnd.adobe.photoshop",
    "tif": "image/tiff",
    "tiff": "image/tiff",
    "mkv": "video/x-matroska",
    "webm": "video/webm",
    "mp4": "video/mp4",
    "m4v": "video/mp4",
    "mov": "video/quicktime",
    "m4a": "audio/mp4",
    "flac": "audio/flac",
    "opus": "audio/ogg",
    "ogg": "audio/ogg",
    "wav": "audio/wav",
    "mp3": "audio/mpeg",
    "glb": "model/gltf-binary",
    "gltf": "model/gltf+json",
    "json": "application/json",
    "pdf": "application/pdf",
    "woff": "font/woff",
    "woff2": "font/woff2",
    "ttf": "font/ttf",
    "otf": "font/otf",
    "md": "text/markdown; charset=utf-8",
    "csv": "text/csv; charset=utf-8",
}


def ext_of(name: str) -> str:
    base = name.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if "." not in base[1:]:
        return ""
    return base.rsplit(".", 1)[-1].lower()


def classify(ext: str) -> str:
    if ext in FAMILY:
        return "family"
    if ext in IMAGE:
        return "image"
    if ext in VIDEO:
        return "video"
    if ext in AUDIO:
        return "audio"
    if ext in MODEL:
        return "model"
    if ext == "pdf":
        return "pdf"
    if ext in FONT:
        return "font"
    if ext in ARCHIVE:
        return "archive"
    if ext in TEXT:
        return "text"
    return "other"


def content_type(name: str) -> str:
    ext = ext_of(name)
    if ext in EXTRA_MIME:
        return EXTRA_MIME[ext]
    guessed, _ = mimetypes.guess_type(name)
    if guessed:
        return guessed
    if ext in TEXT:
        return "text/plain; charset=utf-8"
    return "application/octet-stream"
