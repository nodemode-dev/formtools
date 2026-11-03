# Recommended cleared stack for formtools

Status: research snapshot, 2026-11-03. Engineering recommendation, not legal advice. Policy applied: permissive fine; MPL-2.0 fine unedited; LGPL only separable (dynamic link or separate process); GPL and AGPL banned. Companion files: engine-licensing-matrix.md, codec-patents.md.

## Packaging rules that apply to everything below

1. Freeze the Python engine with PyInstaller in onedir mode, not onefile, so every LGPL or CDDL native library is a visible, replaceable shared library file in the bundle. PyInstaller is GPL-2.0-or-later with a bootloader exception; its docs say apps built with it may use any license, subject to the licenses of what you freeze.
2. LGPL code runs either as a shared library loaded dynamically (libvips, libheif, LibRaw if LGPL) or as a separate executable launched by the engine (FFmpeg, 7-Zip). Do not fuse it into a single static binary, do not patch it silently.
3. Ship a THIRD-PARTY-NOTICES file generated at build time, an LGPL notice with a written source offer or link for each LGPL component, and a statement that users may swap the library file.
4. Pin and record the exact build configuration for FFmpeg and libheif.
5. CI gate: fail the build if any bundled file's license metadata contains GPL or AGPL (excluding LGPL), using a license scan of the frozen bundle.

## Per capability

### Images, general (view, convert, resize)
- Primary: Pillow (MIT-CMU) for common formats, lcms2 via Pillow ImageCms (MIT) for color.
- Large images and speed: libvips through pyvips (MIT binding) with pyvips-binary wheels (LGPL-3.0-or-later). LGPL separability: shared libraries in the onedir bundle, user-replaceable, notice shipped. The libvips notices list showed no x265 or libde265, so HEIC decode through that wheel is not assumed.
- Rust side (Tauri shell, thumbnails): image crate (MIT OR Apache-2.0), fast_image_resize (MIT OR Apache-2.0), mozjpeg crate (IJG), oxipng (MIT).

### HEIC / HEIF
- AVIF: libavif with dav1d or aom (BSD-2), or libvips' libheif build. Cleared.
- HEIC decode: prefer the OS (ImageIO on macOS, WIC on Windows). If Linux needs it, a user-opt-in libheif build with libde265 (LGPL-3.0) loaded dynamically; HEVC patents apply (codec-patents.md).
- Do NOT use pillow-heif PyPI wheels: their license file says the binary wheels are GPLv2 because x265 is bundled. Do not use x265 anywhere.
- HEIC encode: omit by default (the only open encoders are x265 GPL, or kvazaar listed as BSD in the libheif README but not independently verified).

### JPEG XL
- libjxl (BSD-3-Clause plus patent grant) or jxl-oxide (MIT OR Apache-2.0) for decode in Rust. Avoid pillow-jxl-plugin until its license is read (PyPI field blank).

### RAW
- LibRaw with the CDDL-1.0 option elected (COPYRIGHT offers LGPL-2.1 or CDDL-1.0 at your choice), through rawpy (MIT; its wheels exclude the GPL demosaic packs). rawpy wheels exist for macOS arm64, Win x64+arm64, Linux x64+arm64; build macOS x64 from source (no wheel seen). CDDL is file-level copyleft: keep LibRaw files unedited and publish source. If you prefer LGPL: shared library only.
- Do not use rawloader/rawler crates (LGPL-2.1, static link in Rust).

### PSD, EXR, HDR
- psd-tools (MIT) for PSD. OpenEXR wheels (BSD-3-Clause source) or exr crate (BSD-3-Clause) for EXR. OpenImageIO (Apache-2.0) optional for exotic formats; note no Windows arm64 wheel.

### SVG
- resvg / usvg (Apache-2.0 OR MIT).

### Metadata (EXIF, XMP, ICC)
- kamadak-exif (BSD-2-Clause), nom-exif (MIT, confirm), little_exif and img-parts (MIT OR Apache-2.0), piexif (MIT) in Python.
- BANNED: exiv2, pyexiv2, rexiv2 (GPL). FLAG: ExifTool (Perl terms, elect Artistic only after review; recommended not to ship).

### Optimization and quantization
- oxipng (MIT), mozjpeg (IJG plus BSD), libwebp (BSD-3). 
- BANNED: libimagequant 4.x, pngquant (GPL-3.0-or-later), gifski and dssim (AGPL). GIF output: Pillow or FFmpeg's GIF encoder.

### Video and audio conversion
- FFmpeg as a separate-process sidecar (ffmpeg and ffprobe), built by us as an LGPL configuration: no --enable-gpl, no --enable-nonfree, no x264, x265, fdk-aac. Encoders to use: platform hardware encoders (VideoToolbox, Media Foundation), libvpx, libaom or SVT-AV1, libopus, libvorbis, libmp3lame, FLAC. Record the configure line.
- Never use: PyAV wheels, imageio-ffmpeg binaries, or third-party prebuilt FFmpeg without verifying (PyAV's FFmpeg bundles x264 and x265).
- Patent handling per codec-patents.md; H.264, HEVC and AAC go through the OS or are omitted.

### Playback
- Video and audio in the Tauri webview via HTML5 media where the platform webview supports it; fall back to FFmpeg transcode-to-temp for unsupported containers. 
- Native audio fallback in Rust: symphonia (MPL-2.0 unedited) plus cpal (Apache-2.0) and rodio (MIT OR Apache-2.0).
- libmpv/libVLC not recommended: libmpv is GPL unless built with gpl=false, and embedding a native view inside a webview app is hard. libVLC would need a curated plugin set.

### 3D viewing and conversion
- Viewer: three.js (MIT) in the webview. glTF-Transform (MIT), Draco (Apache-2.0), meshoptimizer (MIT) for glTF optimization. trimesh (MIT) and pygltflib (MIT) in Python.
- Import of many formats: assimp (BSD-3-Clause; keep its notices) through assimp-py wheels (license field blank on PyPI, verify at build) or russimp-sys in Rust. tinyobjloader (MIT) as light OBJ path.
- USD: usd-core wheels (TOST-1.0, Apache-like) optional.
- CAD (STEP/IGES) optional later: Open CASCADE via cadquery-ocp as a separate process or dynamically loaded libs (LGPL-2.1 plus exception). manifold3d (Apache-2.0) for booleans.

### PDF, documents
- Viewing: pdf.js (Apache-2.0) in the webview.
- Engine rendering and text: pypdfium2 / PDFium (BSD-3-Clause, Apache-2.0) and pypdf (BSD-3-Clause), pdfminer.six (MIT); qpdf (Apache-2.0) via pikepdf (MPL-2.0, unedited) for repair/linearize, mindful of the macOS x64 wheel gap.
- BANNED: MuPDF, PyMuPDF (AGPL), poppler and its CLI tools (GPL).

### Archives, hashing
- libarchive (BSD-2-Clause) via libarchive-c (CC0). Rust: zip (MIT), sevenz-rust2 (Apache-2.0), zstd (BSD-3-Clause). Optional: official 7-Zip CLI as a sidecar (LGPL with the unRAR restriction; reproduce license text).
- Hashes: blake3 (CC0-1.0 OR Apache-2.0), xxhash library (BSD-2-Clause, library only; never the GPL CLI).
- RAR: libarchive read-only. unrar source is freeware with conditions (flag, counsel review) if libarchive coverage is not enough.
- FLAG: py7zr (pure Python LGPL, not separable inside a frozen bundle). BANNED: PyPI unrar package (GPL-3).

### OCR
- Primary: OS engines, Apple Vision on macOS and Windows.Media.Ocr on Windows (both are OS APIs; no third-party license). 
- Cross-platform and Linux: Tesseract (Apache-2.0) plus tessdata (Apache-2.0), run as a sidecar process. Optional higher quality: RapidOCR with ONNX Runtime (MIT) and PaddleOCR-family models (Apache-2.0 code; check each model file). Note the ONNX Runtime macOS x64 wheel gap in the matrix.

### Fonts, text, hex
- fontTools (MIT), HarfBuzz (MIT) via uharfbuzz or rustybuzz (MIT), ttf-parser (MIT OR Apache-2.0).
- Code highlighting: tree-sitter (MIT) or highlight.js (BSD-3-Clause) or shiki (MIT), with a grammar/theme license audit.
- Audio tags: tinytag (MIT). BANNED: mutagen (GPL-2.0-or-later).

### Shell
- Tauri 2 (Apache-2.0 OR MIT).

## Decision log: banned or flagged items

- BANNED: x264, x265, GPL FFmpeg builds, PyAV wheels (bundled GPL codecs), pillow-heif binary wheels (GPLv2), exiv2, pyexiv2, rexiv2, libimagequant 4.x, pngquant, gifski, dssim, MuPDF, PyMuPDF, poppler, mutagen, PyPI unrar, rawloader and rawler (static LGPL in Rust).
- FLAG: ExifTool (Perl terms), libVLC (curated plugins), libmpv (needs gpl=false build), imageio-ffmpeg (binary unverified), py7zr (LGPL, not separable), RARLAB unrar source (custom terms), pillow-avif-plugin and pillow-jxl-plugin (unverified metadata), imagecodecs and OpenImageIO wheels (bundled notices not enumerated), PaddleOCR runtime (wheel gaps), HEVC/H.264/AAC (patent pools, codec-patents.md).

## Wheel gaps to plan for (from PyPI file lists)

- rawpy: no macOS x64 wheel seen. ONNX Runtime: no macOS x64 seen. pikepdf: no macOS x64 seen.
- OpenImageIO, OpenColorIO, usd-core, pillow-avif-plugin, uharfbuzz (partly): no Windows arm64 wheel seen.
- PaddlePaddle: only macOS arm64, Windows x64, Linux x64 seen.
Full coverage therefore needs a few from-source builds in CI.

## Sources

- All upstream license files and registry pages listed in engine-licensing-matrix.md.
- https://pyinstaller.org/en/stable/license.html ; https://raw.githubusercontent.com/pyinstaller/pyinstaller/develop/COPYING.txt
- https://raw.githubusercontent.com/bigcat88/pillow_heif/master/LICENSES_bundled.txt
- https://raw.githubusercontent.com/LibRaw/LibRaw/master/COPYRIGHT
- https://raw.githubusercontent.com/letmaik/rawpy/main/README.md
- https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- https://raw.githubusercontent.com/PyAV-Org/pyav-ffmpeg/main/README.md
- https://raw.githubusercontent.com/kleisauke/libvips-packaging/main/THIRD-PARTY-NOTICES.md
- https://www.openh264.org/faq.html ; https://www.via-la.com/licensing-2/avc-h-264/ ; https://www.via-la.com/licensing-2/aac/
