# formtools engine licensing matrix

Status: research snapshot, 2026-11-03. This is engineering research, not legal advice. Have counsel review before the first public release.

Scope: every candidate library for the formtools engine (Python FastAPI sidecar frozen with PyInstaller) and shell (Tauri 2, Rust). Rules applied: permissive (MIT, Apache-2.0, BSD, ISC, zlib) fine; MPL-2.0 fine if the MPL files stay unedited; LGPL only as a separable component (dynamic link or separate process); GPL banned in anything distributed; AGPL banned everywhere.

## How to read this

- License column: SPDX id as read from the project's own LICENSE/COPYING/README on its official repo, or from the official package registry metadata (PyPI, crates.io, npm). "(wheel)" means the license of the prebuilt binary wheel, which can differ from the source license.
- Platform column: M = macOS (arm64 and x64), W = Windows (x64 and arm64), L = Linux (x64 and arm64). "6/6" means all six of macOS arm64, macOS x64, Windows x64, Windows arm64, Linux x64, Linux arm64 have a published wheel (checked on PyPI file lists) or the crate is pure Rust and builds on every target. Gaps are named.
- Verdict: CLEARED, CLEARED-MPL (unedited files only), LGPL-SEP (allowed only as separable component), FLAG (needs a decision or more verification), BANNED.
- "unverified" means I could not confirm it from a primary source in this pass. Nothing marked unverified should be relied on.

## 1. Images

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| libvips | LGPL-2.1-or-later (README) | C | pyvips (MIT, pure CFFI), pyvips-binary wheels, Rust bindings not evaluated | pyvips-binary wheels: macOS x64+arm64, Win x64+arm64, Linux x64+arm64 (manylinux_2_28 and musllinux): 6/6 | LGPL-SEP | pyvips-binary wheel metadata says LGPL-3.0-or-later (it bundles libheif LGPL-3.0, glib, pango, librsvg, fribidi, all LGPL, plus aom BSD-2). Its notices list shows no x265 or libde265. Ship as shared libs in a onedir bundle, never statically fused. See recommended-stack.md. |
| pyvips | MIT (PyPI, LICENSE.txt) | Python | CFFI | pure Python | CLEARED | Binding only, needs libvips. |
| Pillow | MIT-CMU (PyPI metadata; LICENSE file is the PIL/HPND text) | C+Python | wheels | 6/6 (macosx x64+arm64, win_amd64+win_arm64, manylinux aarch64+x86_64) | CLEARED | Permissive (HPND family). Upstream states its binaries ship without libimagequant because that library is GPLv3 (Pillow docs). Wheels bundle other C libs (libjpeg-turbo, libwebp, openjpeg, lcms2, freetype, harfbuzz); individual wheel third-party notices not enumerated here, so treat the bundled-lib list as unverified and collect notices at build time. |
| pillow-heif (source) | BSD-3-Clause (LICENSE.txt) | C+Python | wheels | macOS x64+arm64, Win x64+arm64, Linux x64+arm64 | n/a | Source license is permissive but see next row. |
| pillow-heif (binary wheels) | GPL-2.0 for the wheel (LICENSES_bundled.txt says the binary wheel license is GPLv2) | C+Python | PyPI wheels | 6/6 | BANNED | The wheel statically bundles x265 (GPLv2) alongside libheif (LGPL-3) and libde265 (LGPL-3). Do not use the PyPI wheels. Build your own libheif without x265, or use libvips/OS codecs. |
| libheif | LGPL-3.0 (COPYING; sample apps and Go/C++ wrappers MIT) | C++ | libheif-rs crate (MIT, wraps system lib), pyvips, Pillow via pillow-heif | builds everywhere | LGPL-SEP | Plugin codecs: libde265 (LGPL-3.0, HEVC decode), x265 (GPL-2.0 or commercial, HEVC encode, BANNED), kvazaar (BSD-style per libheif README, HEVC encode alternative, license text itself unverified), aom (BSD-2 plus AOMedia patent license), dav1d (BSD-2, AV1 decode), SVT-AV1 (BSD-3-Clause-Clear plus AOMedia patent license). HEVC patents apply, see codec-patents.md. |
| libde265 | LGPL-3.0 (COPYING; sample apps MIT) | C++ | via libheif | builds everywhere | LGPL-SEP | HEVC decode. Patent exposure regardless of copyright license. |
| x265 | GPL-2.0 (COPYING; commercial license offered by MulticoreWare, terms unverified) | C++ | via libheif, ffmpeg | n/a | BANNED | Never ship. |
| x264 | GPL-2.0 (COPYING) | C | via ffmpeg | n/a | BANNED | Never ship. |
| dav1d | BSD-2-Clause (COPYING) plus AOMedia patent license file (doc/PATENTS) | C | via ffmpeg, libheif, libavif | all | CLEARED | Fast AV1 decode. |
| libavif | BSD-2-Clause (LICENSE; README says BSD) | C | libavif crate (BSD-2-Clause), pillow-avif-plugin (MIT) | all | CLEARED | Needs an AV1 codec: aom or dav1d (both BSD-2). |
| pillow-avif-plugin | MIT (PyPI) | C+Python | wheels | macOS x64+arm64, Win x64 only (no win_arm64 seen), Linux x64+arm64 | FLAG | No Windows arm64 wheel in the file list. Bundled codec licenses not enumerated, unverified. Prefer libvips AVIF. |
| libjxl | BSD-3-Clause (LICENSE) plus Google patent grant (PATENTS file) | C++ | pillow-jxl-plugin wheels (license field empty on PyPI, unverified) | pillow-jxl-plugin: 6/6 | CLEARED (library) / FLAG (pillow-jxl-plugin) | Patent grant is defensive-termination style. Pillow plugin license unverified, avoid until read. |
| jxl-oxide | MIT OR Apache-2.0 (crates.io, repo LICENSE-MIT) | Rust | crate (decoder only) | pure Rust, all | CLEARED | Decode only, good for viewing. |
| image (image-rs) | MIT OR Apache-2.0 (crates.io) | Rust | crate | pure Rust, all | CLEARED | Codecs default to pure Rust decoders. |
| zune-image | MIT OR Apache-2.0 OR Zlib (crates.io) | Rust | crate | pure Rust, all | CLEARED | Younger project, fewer eyes. |
| ravif | BSD-3-Clause (crates.io) | Rust | crate (rav1e based AVIF encoder) | pure Rust, all | CLEARED | Encoder. |
| turbojpeg crate | Unlicense OR MIT (crates.io) | Rust | crate over libjpeg-turbo | all | CLEARED | libjpeg-turbo itself: IJG plus BSD-3-Clause (mozjpeg LICENSE.md describes both). |
| LibRaw | LGPL-2.1 OR CDDL-1.0 at your choice (COPYRIGHT file) | C++ | rawpy (MIT wrapper), libraw-rs (MIT/Apache wrapper, crate 0.0.4), rsraw (MIT, 0.1.1) | rawpy wheels: macOS arm64 only (no macOS x64 seen), Win x64+arm64, Linux x64+arm64 | CLEARED via CDDL election, or LGPL-SEP | Elect CDDL-1.0 (file-level copyleft, like MPL) to avoid LGPL relink duties; publish LibRaw source and keep its files unedited. rawpy wheels exclude the GPL demosaic packs (rawpy README). macOS x64 wheel gap: build from source. |
| rawloader / rawler (Rust RAW) | LGPL-2.1 (crates.io) | Rust | crates | all | BANNED for static use (FLAG) | Rust links statically by default, which defeats LGPL separability. Do not use unless isolated in a separate process. |
| OpenEXR | BSD-3-Clause (LICENSE.md) | C++ | OpenEXR PyPI wheels (license field empty on PyPI), exr crate | wheels 6/6 incl. macOS universal2 | CLEARED | Use repo LICENSE as the source of truth. exr crate: BSD-3-Clause (crates.io), pure Rust. |
| psd-tools | MIT (LICENSE, PyPI) | Python+C | wheels | 6/6 | CLEARED | Composite rendering is approximate; some layer effects unsupported (not license related). |
| psd crate | MIT/Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | Read-only, limited. |
| OpenImageIO | Apache-2.0 (LICENSE.md, PyPI 3.2.x) | C++ | openimageio wheels | macOS x64+arm64, Win x64 only, Linux x64+arm64 (no win_arm64) | CLEARED (FLAG for Win arm64) | Wheel-bundled third-party libs not enumerated, unverified. Heavy. |
| OpenColorIO | BSD-3-Clause (LICENSE) | C++ | opencolorio wheels | macOS x64+arm64, Win x64 only, Linux x64+arm64 | CLEARED | No win_arm64 wheel seen. |
| Little CMS (lcms2) | MIT (LICENSE) | C | lcms2 crate (MIT), Pillow ImageCms | all | CLEARED | Color management workhorse. |
| exiv2 | GPL-2.0 (COPYING, README says GPLv2) | C++ | rexiv2 crate (GPL-3.0-or-later) | n/a | BANNED | Do not link or ship. |
| pyexiv2 | GPL-3.0 (LICENSE, PyPI) | C++/Python | wheels | macOS x64+arm64, Win x64, Linux x64+arm64 | BANNED | Wraps exiv2. |
| ExifTool | "same terms as Perl itself" (exiftool.org), meaning Artistic or GPL at your choice | Perl | pyexiftool (GPLv3+/BSD, PyPI) | needs Perl runtime or packed binary | FLAG | Dual license lets you elect the Artistic License, but that is a judgment call plus a Perl runtime to ship. Safer: do not ship; read metadata with Rust/Python libs below. If shipped, as a separate-process sidecar with Artistic elected, after legal review. |
| kamadak-exif | BSD-2-Clause (LICENSE, crates.io) | Rust | crate | all | CLEARED | EXIF read only. |
| nom-exif | MIT (repo LICENSE; crates.io lists it as non-standard, so confirm in the crate tarball) | Rust | crate | all | CLEARED (confirm) | Reads image and video metadata (HEIC, MP4, MOV). |
| little_exif | MIT OR Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | EXIF read and write. |
| img-parts | MIT OR Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | Lossless chunk editing (ICC, EXIF). |
| piexif | MIT (PyPI) | Python | pure | all | CLEARED | EXIF for JPEG. |
| ExifRead | BSD-3-Clause family (PyPI license text, exact SPDX unverified) | Python | pure | all | FLAG (minor) | Confirm text. |
| resvg / usvg | Apache-2.0 OR MIT (crates.io 0.49, repo LICENSE-MIT) | Rust | crate | all | CLEARED | Older releases were MPL-2.0; current ones are dual permissive per the crate metadata. |
| libimagequant | GPL-3.0-or-later (crates.io 4.x; COPYRIGHT says GPLv3+ and commercial) | Rust/C | crate | all | BANNED | Version 4 is GPL. PyPI "imagequant" 1.1.5 lists BSD-3-Clause but what it bundles is unverified: do not use. |
| pngquant | GPL-3.0-or-later (COPYRIGHT) or commercial | C | pngquant-cli wheels (GPL-3.0-or-later) | partial | BANNED | Do not ship binary or library. |
| oxipng | MIT (LICENSE) | Rust | crate and CLI | all | CLEARED | Lossless PNG optimizer. |
| mozjpeg | IJG plus BSD-3-Clause (LICENSE.md describes both) | C | mozjpeg crate (IJG) | all | CLEARED | IJG needs the acknowledgment sentence in documentation. |
| libwebp | BSD-3-Clause (COPYING) plus Google patent grant | C | webp bindings, Pillow, libvips | all | CLEARED | |
| gifski | AGPL-3.0-or-later (LICENSE, crates.io); author offers commercial terms | Rust | crate and CLI | all | BANNED | AGPL everywhere banned. Alternatives: ffmpeg GIF encoder (LGPL build), Pillow GIF save, gif crate (not evaluated). |
| dssim | AGPL-3.0 (crates.io) | Rust | crate | all | BANNED | Use another perceptual metric if needed. |
| OpenJPH | BSD-2-Clause (LICENSE) | C++ | via libheif | all | CLEARED | HTJ2K. |
| imagecodecs | BSD-3-Clause (PyPI) | C+Python | wheels | macOS x64+arm64, Win x64+arm64, Linux x64+arm64 | FLAG | Wheel bundles many codecs; some third-party codec licenses not enumerated, unverified. |

## 2. Video and audio

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| FFmpeg (LGPL build) | LGPL-2.1-or-later when configured without --enable-gpl and without --enable-nonfree (LICENSE.md) | C | CLI sidecar (ffmpeg, ffprobe) | build per target | LGPL-SEP | Run only as a separate process. Optional --enable-version3 upgrades to LGPL-3.0 (needed for some libs). No x264, x265, libfdk-aac, openssl. Patents still apply, see codec-patents.md. |
| FFmpeg (GPL build) | GPL-2.0-or-later with --enable-gpl, GPL-3.0 with version3 | C | n/a | n/a | BANNED | Many third-party static builds (gyan.dev full, johnvansickle, evermeet) are GPL builds. Do not download a prebuilt binary without reading its configure line. |
| FFmpeg nonfree | unredistributable (LICENSE.md) | C | n/a | n/a | BANNED | libfdk-aac and OpenSSL combos. |
| PyAV | BSD-3-Clause (repo) | Cython | wheels with bundled FFmpeg | macOS x64+arm64, Win x64+arm64, Linux x64+arm64 | BANNED (wheel) | The pyav-ffmpeg builds include x264 and x265 (its README lists both), implying a GPL FFmpeg. Not usable. |
| imageio-ffmpeg | BSD-2-Clause wrapper (PyPI); bundled ffmpeg binary license unverified | Python | wheels with a static ffmpeg | 6/6 | FLAG | Binary's configure line not verified. Treat as GPL until proven otherwise. |
| libmpv (mpv) | GPL-2.0-or-later by default, LGPL-2.1-or-later with -Dgpl=false (README) | C | C API | build per target | LGPL-SEP (only if built with gpl=false) | Official/most distro builds are GPL. You must build yourself, and also link only to LGPL-clean FFmpeg. Not recommended in a Tauri webview app (embedding a native player view is hard). |
| libVLC / VLC | COPYING.LIB is LGPL-2.1; app COPYING is GPL-2 (VLC repo) | C | libvlc | build per target | FLAG | libVLC library LGPL, but the stock plugin set contains GPL modules; you must ship a curated plugin set. Heavy. Not recommended. |
| GStreamer | LGPL-2.1 core and plugins; GPL plugins live in separate "ugly"/"bad" packages (GStreamer licensing FAQ) | C | gstreamer-rs (MIT/Apache, unverified), others | all | LGPL-SEP | Plugin-based, complex to bundle. Not needed. |
| symphonia | MPL-2.0 (LICENSE, crates.io 0.6) | Rust | crate | all | CLEARED-MPL | File-level copyleft. Use unedited from crates.io; publish a pointer to the upstream source. Decodes MP3, AAC, FLAC, Vorbis, ALAC, WAV, etc. AAC/MP3 patent notes in codec-patents.md. |
| rodio | MIT OR Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | Playback. |
| cpal | Apache-2.0 (LICENSE) | Rust | crate | all | CLEARED | Low-level audio I/O. |
| mp4parse | MPL-2.0 (crates.io) | Rust | crate | all | CLEARED-MPL | Container parsing. |
| lofty / tinytag | tinytag MIT (PyPI); lofty not evaluated | Python | | | CLEARED (tinytag) | |
| mutagen | GPL-2.0-or-later (PyPI) | Python | | | BANNED | Common audio-tag library, but GPL. Use tinytag (read) or lofty (Rust, unverified). |

## 3. 3D

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| three.js | MIT (LICENSE) | JS | npm | any (WebView) | CLEARED | Viewer. |
| assimp | BSD-3-Clause (LICENSE; bundled Poly2Tri and other third-party notices inside) | C++ | russimp / russimp-sys (assimp license in repo, crates.io lists non-standard), assimp-py wheels (license field empty, unverified), pyassimp (ISC) | assimp-py: 6/6 including universal2 | CLEARED | Keep the LICENSE file's third-party block with the binary. Bundled third-party licenses inside the assimp tree should be reviewed per format enabled. |
| glTF-Transform | MIT (LICENSE.md, npm @gltf-transform/core 4.5) | TS | npm | any | CLEARED | Node/browser. |
| Draco | Apache-2.0 (LICENSE) | C++ | npm WASM decoder, draco3d | all | CLEARED | |
| meshoptimizer | MIT (LICENSE.md) | C++ | npm WASM, Rust crates | all | CLEARED | |
| OpenUSD | Tomorrow Open Source Technology License 1.0 (LICENSE.txt: Apache-2.0 text, trademark section differs); PyPI usd-core lists LicenseRef-TOST-1.0 | C++ | usd-core wheels | macOS universal2, Win x64, Linux x64+arm64 (no win_arm64) | CLEARED (note) | Permissive and Apache-like, but not an OSI-listed id; keep the notice. Large. |
| tinyobjloader | MIT (LICENSE) | C++ | | all | CLEARED | |
| trimesh | MIT (PyPI) | Python | pure | all | CLEARED | Optional extras may pull other licenses; check each extra. |
| pygltflib | MIT (PyPI) | Python | pure | all | CLEARED | |
| Open CASCADE (OCCT) | LGPL-2.1 with the Open CASCADE exception (LICENSE_LGPL_21.txt plus OCCT_LGPL_EXCEPTION.txt) | C++ | cadquery-ocp wheels (Apache-2.0 binding metadata), OCP 0.1.9 (LGPL-2.1+) | cadquery-ocp: macOS x64+arm64, Win x64, Linux x64+arm64 | LGPL-SEP | The exception relaxes header use, not the library. Dynamic libs only, or a separate process. STEP/IGES import is a niche need: optional, later. |
| manifold | Apache-2.0 (LICENSE) | C++ | manifold3d wheels (Apache), npm WASM | 6/6 | CLEARED | Mesh booleans. |

## 4. Documents

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| pdf.js | Apache-2.0 (LICENSE) | JS | npm | any | CLEARED | Primary PDF viewer in the WebView. |
| PDFium | BSD-3-Clause (LICENSE on pdfium.googlesource.com); some third-party parts under Apache-2.0 | C++ | pypdfium2 (BSD-3-Clause, Apache-2.0 per PyPI), pdfium-render crate (MIT OR Apache-2.0) | pypdfium2: macOS x64+arm64, Linux x64+arm64, Windows wheels present (win arm64 not confirmed in my list) | CLEARED | Best choice for rasterizing PDF pages and text extraction in the engine. |
| MuPDF / PyMuPDF | AGPL-3.0 (COPYING; PyMuPDF dual AGPL or Artifex commercial) | C / Python | | | BANNED | Never. |
| pypdf | BSD-3-Clause (LICENSE) | Python | pure | all | CLEARED | Merge/split/metadata. |
| qpdf | Apache-2.0 (LICENSE.txt, README) | C++ | pikepdf wheels (MPL-2.0 binding) | pikepdf: macOS arm64 only seen in the wheel list (no macOS x64), Win x64+arm64, Linux x64+arm64 | CLEARED / CLEARED-MPL | pikepdf is MPL-2.0: use unedited. macOS x64 wheel gap seen in the file list, so check before relying on it. |
| pdfminer.six | MIT (PyPI) | Python | pure | all | CLEARED | Text layout extraction. |
| lopdf | MIT (crates.io) | Rust | crate | all | CLEARED | |
| poppler | GPL-2.0 or GPL-3.0 (COPYING, README: GPL not LGPL) | C++ | | | BANNED | Do not use poppler-utils (pdftoppm etc.) either. |

## 5. Archives, hashing, compression

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| libarchive | BSD-2-Clause main license, some files public domain or CC0/OpenSSL/Apache-2.0 choice (COPYING) | C | libarchive-c (CC0, PyPI), compress-tools crate (MIT OR Apache-2.0) | all | CLEARED | Reads zip, tar, 7z, rar (read only via its own implementation). |
| 7-Zip / 7z.dll | GNU LGPL, parts with the "unRAR license restriction", parts BSD-2/BSD-3 (7-zip.org license.txt) | C++ | CLI sidecar | all | LGPL-SEP | The unRAR restriction: the unRAR-derived code may not be used to rebuild RAR compression. Using as a separate extractor sidecar is fine; reproduce its license text in notices. p7zip is a fork: use 7-Zip's official Linux/macOS CLI. |
| py7zr | LGPL-2.1-or-later (PyPI) | Python | pure | all | FLAG | Pure Python LGPL inside a PyInstaller bundle cannot be relinked by the user in a straightforward way. Prefer libarchive or 7-Zip sidecar. |
| unrar (RARLAB source) | proprietary freeware: source may be used to handle RAR, not to create RAR-compatible compressors; modified redistribution must carry the license paragraph (license.txt) | C++ | unrar crate (MIT OR Apache-2.0 wrapper, bundles unrar source), rarfile (ISC, shells out to unrar/bsdtar) | all | FLAG | Not OSI open source, but redistribution is permitted if the paragraph travels with it. Prefer libarchive for RAR reading; only add unrar if needed, with counsel sign-off. |
| unrar PyPI package | GPL-3 (PyPI) | Python | | | BANNED | |
| sevenz-rust / sevenz-rust2 | Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | 7z read/write in Rust. |
| zip crate | MIT (LICENSE, crates.io 9.x) | Rust | crate | all | CLEARED | |
| zstd (Facebook) | BSD-3-Clause (LICENSE; also GPL-2.0 dual, choose BSD) | C | zstd crate (BSD-3-Clause), zstandard / pyzstd | zstandard wheels 6/6 | CLEARED | |
| xxHash | BSD-2-Clause for the library (LICENSE); CLI is GPL-2.0 | C | xxhash PyPI (BSD-2-Clause), xxhash-rust (BSL-1.0) | wheels 6/6 | CLEARED | Use the library only, never the xxhsum CLI. BSL-1.0 is permissive. |
| BLAKE3 | CC0-1.0 OR Apache-2.0 (crates.io, repo LICENSE_CC0) | Rust/C | blake3 crate and PyPI wheel | wheels incl. win_arm64 | CLEARED | |

## 6. OCR

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| Tesseract | Apache-2.0 (LICENSE) | C++ | pytesseract (Apache-2.0, shells out), tesseract-rs not evaluated | build per target | CLEARED | You must ship binaries per OS; its dependencies (leptonica: BSD-2-Clause-like, unverified in this pass) need checking. |
| tessdata models | Apache-2.0 (tessdata repo LICENSE) | data | | all | CLEARED | |
| PaddleOCR | Apache-2.0 (LICENSE, PyPI) | Python | | via paddlepaddle: macOS arm64, Win x64, Linux x64 only | FLAG | Paddle runtime wheel gaps (no Linux arm64 or macOS x64 or Win arm64 seen). Heavy. |
| RapidOCR (onnxruntime) | Apache-2.0 (PyPI) | Python | | pure Python plus ORT | CLEARED | Runs PaddleOCR-family models via ONNX Runtime. Model file licenses should be checked per model, unverified. |
| ONNX Runtime | MIT (LICENSE) | C++ | onnxruntime wheels | macOS arm64 only (no macOS x64 in list), Win x64+arm64, Linux x64+arm64 | CLEARED | macOS x64 wheel gap. |
| Apple Vision | OS API, no third-party license; redistribution terms n/a (Apple developer terms apply, unverified here) | Swift/ObjC | via a small native helper | macOS only | CLEARED (OS API) | On-device text recognition; Apple's page I fetched lacked details, so supported OS versions are unverified. |
| Windows.Media.Ocr | OS API; Microsoft's page has no licensing note | WinRT | via windows crate | Windows 10+ | CLEARED (OS API) | Languages depend on installed language packs (the API reports the available ones). |

## 7. Fonts and text

| Component | License (SPDX) | Lang | Bindings | Platforms | Verdict | Notes |
|---|---|---|---|---|---|---|
| fontTools | MIT (LICENSE, PyPI) | Python | pure plus optional C | 6/6 | CLEARED | |
| HarfBuzz | MIT ("Old MIT" in COPYING) | C++ | uharfbuzz (Apache-2.0 wheels), rustybuzz (MIT) | uharfbuzz: no win_arm64 seen | CLEARED | |
| ttf-parser | MIT OR Apache-2.0 (crates.io) | Rust | crate | all | CLEARED | |
| tree-sitter | MIT (LICENSE) | C/Rust | crates, PyPI wheels (MIT classifier), npm WASM | wheels: no musllinux aarch64 seen | CLEARED | Individual grammars have their own licenses: check each. |
| highlight.js | BSD-3-Clause (LICENSE) | JS | npm | any | CLEARED | |
| shiki | MIT (LICENSE) | TS | npm | any | CLEARED | Bundled TextMate grammars and themes carry their own licenses: audit. |
| syntect | MIT (crates.io) | Rust | crate | all | CLEARED | Bundled syntaxes from Sublime packages may differ: audit. |

## 8. Platform, packaging

| Component | License (SPDX) | Verdict | Notes |
|---|---|---|---|
| Tauri 2 | Apache-2.0 OR MIT (crates.io tauri 2.12 and tauri-build; repo has LICENSE_APACHE and LICENSE_MIT) | CLEARED | |
| PyInstaller | GPL-2.0-or-later with a bootloader exception; run-time hooks under Apache-2.0 (COPYING.txt, PyPI 6.22) | CLEARED | Per its docs, apps you build can be released under any license; the GPL covers changes to PyInstaller itself. The bundle must still honor the licenses of everything frozen inside it. |

## Open items (unverified)

- Full third-party notice list of each prebuilt wheel (Pillow, imagecodecs, OpenImageIO, pyvips-binary beyond the grep I ran).
- kvazaar license file text, SVT-AV1 patent file, leptonica license.
- Exact FFmpeg configure lines of imageio-ffmpeg wheels and of any third-party prebuilt ffmpeg.
- HEVC Advance and Via LA HEVC pool scope for software-only distributors (page fetch failed).
- Sisvel AV1 pool (page fetch failed).

## Sources

All fetched 2026-11-03 from primary pages.

- https://raw.githubusercontent.com/libvips/libvips/master/README.md and /LICENSE
- https://raw.githubusercontent.com/libvips/pyvips/master/LICENSE.txt
- https://pypi.org/pypi/pyvips-binary/json ; https://raw.githubusercontent.com/kleisauke/libvips-packaging/main/THIRD-PARTY-NOTICES.md
- https://raw.githubusercontent.com/python-pillow/Pillow/main/LICENSE and /docs/installation/building-from-source.rst ; https://pypi.org/pypi/Pillow/json
- https://raw.githubusercontent.com/bigcat88/pillow_heif/master/LICENSES_bundled.txt , /LICENSE.txt , /libheif/build_libs.py
- https://raw.githubusercontent.com/strukturag/libheif/master/COPYING and /README.md ; https://raw.githubusercontent.com/strukturag/libde265/master/COPYING
- https://raw.githubusercontent.com/videolan/x265/master/COPYING ; https://raw.githubusercontent.com/mirror/x264/master/COPYING
- https://raw.githubusercontent.com/videolan/dav1d/master/COPYING and /doc/PATENTS
- https://raw.githubusercontent.com/AOMediaCodec/libavif/main/LICENSE and /README.md
- https://raw.githubusercontent.com/AOMediaCodec/SVT-AV1/master/LICENSE.md
- https://raw.githubusercontent.com/libjxl/libjxl/main/LICENSE and /PATENTS ; https://raw.githubusercontent.com/tirr-c/jxl-oxide/main/LICENSE-MIT
- https://crates.io/api/v1/crates/{image,jxl-oxide,zune-image,resvg,usvg,kamadak-exif,nom-exif,little_exif,img-parts,oxipng,mozjpeg,libwebp-sys,symphonia,rodio,cpal,russimp,sevenz-rust,sevenz-rust2,zip,blake3,xxhash-rust,zstd,libheif-rs,libavif,rawloader,rawler,imagequant,gifski,dssim,rexiv2,pdfium-render,lopdf,tree-sitter,tauri,tauri-build,exr,psd,ravif,turbojpeg,lcms2,rsraw,libraw-rs,unrar,mp4parse,libarchive3-sys,compress-tools,ttf-parser,rustybuzz,syntect}
- https://raw.githubusercontent.com/LibRaw/LibRaw/master/COPYRIGHT ; https://raw.githubusercontent.com/letmaik/rawpy/main/README.md and /LICENSE
- https://raw.githubusercontent.com/AcademySoftwareFoundation/openexr/main/LICENSE.md ; /OpenImageIO/main/LICENSE.md ; /OpenColorIO/main/LICENSE
- https://raw.githubusercontent.com/psd-tools/psd-tools/main/LICENSE
- https://raw.githubusercontent.com/mm2/Little-CMS/master/LICENSE
- https://raw.githubusercontent.com/Exiv2/exiv2/main/COPYING and /README.md ; https://raw.githubusercontent.com/LeoHsiao1/pyexiv2/master/LICENSE
- https://exiftool.org/index.html
- https://raw.githubusercontent.com/ImageOptim/libimagequant/main/COPYRIGHT ; https://raw.githubusercontent.com/kornelski/pngquant/main/COPYRIGHT ; https://raw.githubusercontent.com/ImageOptim/gifski/main/LICENSE
- https://raw.githubusercontent.com/mozilla/mozjpeg/master/LICENSE.md ; https://raw.githubusercontent.com/webmproject/libwebp/main/COPYING
- https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- https://raw.githubusercontent.com/PyAV-Org/pyav-ffmpeg/main/README.md ; https://raw.githubusercontent.com/PyAV-Org/PyAV/main/README.md
- https://raw.githubusercontent.com/mpv-player/mpv/master/README.md ; https://raw.githubusercontent.com/videolan/vlc/master/COPYING.LIB
- https://gstreamer.freedesktop.org/documentation/frequently-asked-questions/licensing.html
- https://raw.githubusercontent.com/pdeljanov/Symphonia/master/LICENSE ; https://raw.githubusercontent.com/RustAudio/cpal/master/LICENSE
- https://raw.githubusercontent.com/mrdoob/three.js/dev/LICENSE ; https://raw.githubusercontent.com/assimp/assimp/master/LICENSE ; https://registry.npmjs.org/@gltf-transform/core/latest ; https://raw.githubusercontent.com/google/draco/main/LICENSE ; https://raw.githubusercontent.com/zeux/meshoptimizer/master/LICENSE.md ; https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt ; https://raw.githubusercontent.com/tinyobjloader/tinyobjloader/release/LICENSE ; https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt ; https://raw.githubusercontent.com/elalish/manifold/master/LICENSE
- https://raw.githubusercontent.com/mozilla/pdf.js/master/LICENSE ; https://pdfium.googlesource.com/pdfium/+/refs/heads/main/LICENSE ; https://raw.githubusercontent.com/ArtifexSoftware/mupdf/master/COPYING ; https://raw.githubusercontent.com/py-pdf/pypdf/main/LICENSE ; https://raw.githubusercontent.com/qpdf/qpdf/main/README.md ; https://gitlab.freedesktop.org/poppler/poppler/-/raw/master/README.md
- https://raw.githubusercontent.com/libarchive/libarchive/master/COPYING ; https://www.7-zip.org/license.txt ; https://raw.githubusercontent.com/pmachapman/unrar/master/license.txt (mirror of RARLAB unrar license text) ; https://raw.githubusercontent.com/facebook/zstd/dev/LICENSE ; https://raw.githubusercontent.com/Cyan4973/xxHash/dev/LICENSE ; https://raw.githubusercontent.com/BLAKE3-team/BLAKE3/master/LICENSE_CC0 ; https://raw.githubusercontent.com/zip-rs/zip2/master/LICENSE
- https://raw.githubusercontent.com/tesseract-ocr/tesseract/main/LICENSE ; https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/LICENSE ; https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE ; https://raw.githubusercontent.com/microsoft/onnxruntime/main/LICENSE
- https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine ; https://developer.apple.com/documentation/vision/recognizing-text-in-images
- https://raw.githubusercontent.com/fonttools/fonttools/main/LICENSE ; https://raw.githubusercontent.com/harfbuzz/harfbuzz/main/COPYING ; https://raw.githubusercontent.com/tree-sitter/tree-sitter/master/LICENSE ; https://raw.githubusercontent.com/highlightjs/highlight.js/main/LICENSE ; https://raw.githubusercontent.com/shikijs/shiki/main/LICENSE
- https://raw.githubusercontent.com/pyinstaller/pyinstaller/develop/COPYING.txt ; https://pyinstaller.org/en/stable/license.html
- https://pypi.org/pypi/{pyvips,Pillow,pillow-heif,pillow-jxl-plugin,rawpy,OpenEXR,psd-tools,openimageio,opencolorio,pyexiv2,pngquant-cli,imagequant,pillow-avif-plugin,pypdf,pypdfium2,PyMuPDF,pikepdf,zstandard,xxhash,blake3,py7zr,libarchive-c,rarfile,unrar,fonttools,uharfbuzz,tree-sitter,pytesseract,rapidocr-onnxruntime,onnxruntime,paddleocr,paddlepaddle,av,imageio-ffmpeg,PyInstaller,trimesh,pygltflib,assimp-py,pyassimp,manifold3d,cadquery-ocp,OCP,usd-core,pyexiftool,mutagen,tinytag,imagecodecs}/json
