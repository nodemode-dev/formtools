# Changelog

## 0.4.0 · 2026-11-03

- 3D viewer: glTF and GLB, OBJ with MTL, STL, PLY, FBX, 3MF, DAE and USDZ open in the viewer; OFF and XYZ open through the engine. Orbit, fit, lit, wireframe, normals and matcap modes, a neutral built-in environment, grid and axes, a two-click measure, animation playback, a scene panel, triangle and vertex counts, a PNG screenshot, and conversion to GLB, OBJ, STL, PLY or OFF.
- Documents and data: text and code with highlighting, find and line numbers; Markdown rendered or as source; CSV and TSV grids that sort; JSON as a tree; SQLite tables, read-only; PDF pages with thumbnails and zoom; fonts with a waterfall, a glyph grid, variable axes and Install; a hex view for any file.
- Archives: browse ZIP, TAR (gz, bz2, xz, zst) and, where the system has libarchive, 7z, RAR and ISO; preview a member; extract all or a selection. Extraction refuses parent and absolute paths, never follows or creates links that leave the folder, never overwrites, and stops on archives that expand past a safe ratio.
- Checksums: MD5, SHA-1, SHA-256, SHA-512, SHA3-256, BLAKE3, XXH64 and CRC32 for many files, a compare field for a published value, a sums file to save, and verification of SHA256SUMS, .md5, .sfv and BSD style files.
- Duplicates: identical files (size, then a quick hash of each end, then BLAKE3) or similar pictures, with thumbnails, quick selection rules, and Move to trash after a confirm.
- Disk usage: a squarified treemap and a size list that you click into, with breadcrumbs.
- Clean up: empty folders and broken pictures or media files, moved to the trash after a confirm. New from template, from a templates folder you can edit. Who has this file open.
- Engine: three new tools (model, files, utilities) with 14 MCP tools between them, 31 in all; nothing is ever deleted permanently, only moved to the system trash. The frozen engine collects the new libraries' runtime imports.
- Fixes: a second crop or resize of the same picture now saves as "name edited (2)" instead of failing; a new archive gets its format's extension; the browser hides XMP sidecars beside their files; toasts no longer move when a longer message arrives.

## 0.3.0 · 2026-11-02

- Browser: a folder tree that follows the open folder, multi-select (Shift and Mod), star ratings (0 to 5) and colour labels (6 to 9) written to XMP sidecars and shown on each tile, video thumbnails.
- Viewer: crop with aspect presets, resize, save as JPEG, PNG, WebP, AVIF or TIFF (never over the original unless asked), a pixel inspector that copies the colour, ratings and labels in the information panel, IPTC and XMP in the information panel. Actual pixels moved to A.
- Batch convert: 19 actions in an ordered list with a live before and after preview, presets, naming tokens, a plan that shows name conflicts, and progress in the status bar.
- Resize: by longest side, shortest side, width, height, box, percent or megapixels, with size presets.
- Rename: find and replace (with regular expressions), case, insert, remove, numbers, dates, tidy and extension rules, a live preview, and undo.
- Player: every video and audio file; MKV and other containers play through a lossless remux; speed, A-B loop, frame steps, subtitles (embedded and beside the file), snapshots, lossless clips and audio extraction; a waveform for audio; streams, codecs, HDR, chapters and tags in the information panel.
- Engine: a shared job queue, the batch and media tools, MCP tools for both, and `./formtools cli convert | resize | rename`.
- Desktop: the engine ships as a folder on every OS; `./formtools desktop build` runs from the repository root; the Tauri packages follow the 2.12 crates.

## 0.2.0 · 2026-11-02

- The window: Home with every tool grouped (ready and planned), a title bar and in-window menus (the system menu bar on macOS in the desktop app), a command palette, Preferences with 28 themes and an accent colour, a status bar with the engine's state.
- Browser: places, a typed path bar, a thumbnail grid and a list, sort, reverse, filter, thumbnail size, keyboard navigation, Space for a quick look.
- Viewer: fit, fill, 1:1, zoom at the pointer, pan, lock zoom, neighbour prefetch, compare two images, slideshow, full screen, an information panel with a histogram and EXIF, lossless JPEG rotate and flip, video and audio the system can play.
- Engine: RAW (LibRaw), PSD, EXR and HDR with tone mapping, AVIF, TIFF and more, ICC to sRGB, cached thumbnails, a Host-checked local API, MCP over HTTP and through `./formtools mcp`.
- Form family: formvis projects (`.fvd`, `.fmv`, `.formvis`) preview without formvis, with their size, layer count and layer names.
- Desktop shell: the family's splash and boot sequence, window state, file dialogs, drag and drop of files and folders, one instance at a time.
- Research: a gap pass over the encyclopedia, and the formvis project format spec in `docs/family-formats/`.

## 0.1.0 · 2026-11-02

- Repository created: Apache-2.0 licence headed Copyright (C) 2026 NodeAgentc, Inc., notice, git settings and agent rules.
- Research encyclopedia: 130 sourced pages on the XnSoft suite, Microsoft PowerToys, Apple Preview and Quick Look, image viewers, media players, converters, 3D viewers and converters, file utilities, and engine licensing, with an index and a gap register.
- No code yet: the development plan waits for the owner's approval.
