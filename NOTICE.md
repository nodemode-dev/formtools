# NOTICE

formtools
Copyright (C) 2026 NodeAgentc, Inc.

Licensed under the Apache License, Version 2.0 (see `LICENSE`).

## Third-party software

Every dependency gets a row here with its name, version, licence and where it ships, after it clears the licence policy in `docs/encyclopedia/engines/engine-licensing-matrix.md`. Rust crates resolve exactly through `src-tauri/Cargo.lock`, npm packages through `frontend/package-lock.json`.

| Component | Version | Licence | Ships in |
| --- | --- | --- | --- |
| formvis shared UI files (`themes.ts`, `icons.ts`, `dom.ts`, `caption-buttons.ts`, `tokens.css`, `fonts.css`, `scrollbars.css`, `light-mode.css`, the `index.html` theme boot, the splash and boot sequence, `native-menu.ts` pattern), Copyright (C) 2026 NodeAgentc, Inc. | 1.98.7 | Apache-2.0 | frontend, desktop shell |
| Tauri, tauri-build, tauri-plugin-shell, -dialog, -updater, -single-instance, -opener | 2.12.x (Cargo.lock) | Apache-2.0 OR MIT | desktop shell |
| objc2, objc2-app-kit, objc2-foundation | 0.6, 0.3 | MIT | desktop shell (macOS) |
| regex, serde, serde_json | 1.x (Cargo.lock) | MIT OR Apache-2.0 | desktop shell |
| tauri-plugin-global-shortcut, tauri-plugin-clipboard-manager | 2.4.1, 2.5.0 | Apache-2.0 OR MIT | desktop shell (desktop utilities) |
| image | 0.25 (Cargo.lock) | MIT OR Apache-2.0 | desktop shell |
| x11rb | 0.14 | MIT OR Apache-2.0 | desktop shell (Linux capture and always on top) |
| xcap | 0.9 | Apache-2.0 | desktop shell (macOS and Windows capture) |
| windows | 0.62 | MIT OR Apache-2.0 | desktop shell (Windows) |
| objc2-vision and the objc2 crates it needs | 0.3 | Zlib OR Apache-2.0 OR MIT | desktop shell (macOS text recognition) |
| ExifTool by Phil Harvey | 13.60 | GPL-1.0-or-later OR Artistic-1.0-Perl | not shipped in the app: an `exiftool` on PATH (or `FORMTOOLS_EXIFTOOL`) is used first; otherwise the engine fetches, on request, the npm packages exiftool-vendored.pl or exiftool-vendored.exe 13.60.0 (MIT packaging by Matthew McEachen), checks the registry's sha512 integrity, and keeps it in the per-person folder `formtools-binaries`; it runs as a separate process |
| Tesseract OCR | system copy, not shipped | Apache-2.0 | used on Linux when installed, run as a separate process |
| @tauri-apps/api | 2.12.4 | Apache-2.0 OR MIT | frontend |
| @tauri-apps/plugin-clipboard-manager | 2.5.0 | MIT OR Apache-2.0 | frontend (desktop utilities) |
| @fontsource/inter (Inter typeface) | 5.3.0 | OFL-1.1 | frontend |
| @fontsource/jetbrains-mono (JetBrains Mono typeface) | 5.3.0 | OFL-1.1 | frontend |
| three (three.js, with its `examples/jsm` loaders and OrbitControls) | 0.187.0 | MIT | frontend (3D viewer chunk, loaded on demand) |
| highlight.js | 11.12.0 | BSD-3-Clause | frontend (text viewer chunk) |
| markdown-it (with its bundled dependencies entities, linkify-it, mdurl, punycode.js, uc.micro) | 15.0.3 | MIT | frontend (Markdown chunk) |
| pdfjs-dist (pdf.js and its worker) | 6.5.438 | Apache-2.0 | frontend (PDF chunk) |
| xterm.js (@xterm/xterm) and its fit addon (@xterm/addon-fit) | 6.0.0, 0.11.0 | MIT | frontend (the terminal dock, View > Terminal) |
| FastAPI | 0.141.1 | MIT | engine |
| uvicorn[standard] | 0.53.0 | BSD-3-Clause | engine |
| Pillow | 12.3.0 | MIT-CMU | engine |
| NumPy | 2.5.3 | BSD-3-Clause (its wheels bundle further libraries, listed in the wheel's own licence file) | engine |
| rawpy with LibRaw | 0.27.1 | MIT; LibRaw used under its CDDL-1.0 option | engine (not on macOS x64, no wheel) |
| psd-tools | 1.23.0 | MIT | engine |
| OpenEXR | 3.5.2 | BSD-3-Clause | engine |
| trimesh | 5.2.0 | MIT | engine |
| fontTools | 4.68.0 | MIT | engine |
| Brotli (Python bindings with the brotli library) | 1.2.1 | MIT | engine (WOFF2 fonts) |
| blake3 (Python bindings and the BLAKE3 reference code) | 1.0.11 | CC0-1.0 OR Apache-2.0 | engine |
| xxhash (Python bindings with the xxHash library) | 4.0.2 | BSD-2-Clause | engine |
| zstandard (with the bundled zstd library) | 0.25.0 | BSD-3-Clause | engine |
| Send2Trash | 2.1.0 | BSD-3-Clause | engine |
| psutil | 7.2.2 | BSD-3-Clause | engine |
| libarchive-c | 5.3 | CC0-1.0 | engine; it loads the system libarchive (BSD-2-Clause) where one exists and is not bundled |
| FFmpeg and ffprobe (LGPL build with libvpx and libopus, configured `--disable-gpl --disable-nonfree --disable-version3`) | 7.1.5 (record 7.1.5-2) | LGPL-2.1-or-later | not shipped in the app: an `ffmpeg` on PATH is used first; otherwise the frozen engine downloads the family's pinned build from `nodemode-dev/formcut-binaries`, checks every file's SHA-256, and keeps it in the per-person folder `formcut-binaries/ffmpeg-7.1.5-2` shared with formcut and formvis; the binaries are run as separate processes. Source: the offer published with formcut-binaries |
| formvis `ffmpeg_fetch.py` and `ffmpeg_record.py`, ported to `backend/app/tools/media/fetch.py` and `record.py`, Copyright (C) 2026 NodeAgentc, Inc. | 1.98.7 | Apache-2.0 | engine |
| PyInstaller | 6.22.3 | GPL-2.0 with the bootloader exception | build tool only; the exception covers the frozen engine |
| TypeScript, Vite, @tauri-apps/cli | 7.0.2, 8.3.5, 2.12.4 | Apache-2.0, MIT, Apache-2.0 OR MIT | build tools only |

## Trademarks

Product names in `docs/encyclopedia/` and `docs/family-formats/` (XnView, XnConvert, PowerToys, Preview, VLC, OpenRaster and others) belong to their owners. They appear only to describe what those products do, as research for an independent implementation. formtools is not affiliated with or endorsed by any of them, and no code, text or artwork from them is copied into this repository.
