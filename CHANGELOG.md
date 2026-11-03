# Changelog

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
