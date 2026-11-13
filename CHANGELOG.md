# Changelog

## 0.7.0 · 2026-11-13

FormTools joins the Form family standard for Home, agents and demos, in formlit's look.

- Home: the side panel looks and behaves like formlit's: the formtools mark with "by nodemode.ai", then Agents, Recent, Demos and the tool groups as sections. It resizes, and a drag or the edge tab hides it. The icon rail is gone.
- Terminal dock: Ctrl or Cmd+J opens a dock with shell tabs, Claude Code tabs that have formtools' tools attached, and a Chat with Claude tab; tabs survive a reload, and two title bar buttons light with it. Claude Code is your own install; formtools does not bundle it.
- Agents: `run_command` now runs commands in the open window, agents see the window's command list, and `./formtools agents install` connects Claude Code, Codex and Cursor in one step. The MCP server has 35 tools.
- Demos: three demo folders (a photo shoot, a shelf of Form files, a 3D and media bench) are generated on this computer the first time you open them, from Home, the side panel, Help > Demos or a command each.
- Icons: `./formtools sparkle` fails if a sparkle icon is ever added; the app has none.

## 0.6.4 · 2026-11-13

The second pass of fixes from the full review; nothing new.

- Pictures and video: JPEGs saved as MPO by phones and cameras can be turned; remuxing an MP4 with mov_text subtitles to MKV works; a snapshot of a video named with `%d` no longer overwrites another file; batch names and previews use a RAW picture's real size.
- Rename and checksums: renaming a folder together with items inside it is refused with a clear message; Verify reads the B3SUMS, SHA3-256SUMS and XXH64SUMS files formtools saves, and saved sums files list files by their path from the shared folder.
- 3D: OBJ models with relative face indices show and convert with all their geometry; hidden groups drop out of the counts and measuring.
- Hosts: saving after another program changed the file is refused and the table reloads; scoped IPv6 entries no longer block Save.
- Duplicates and Clean up: Duplicates opened from dropped files scans their folders; a folder chosen with a folder inside it is scanned once; bulk selection picks only what is shown; more than 5000 files can go to the trash at once.
- Viewer: a file that fails to open no longer shows the previous file's content; the slideshow and busy spinner carry on past videos and documents; old Mac line endings show one line per row; Shift+Arrow extends the archive selection; long lists no longer jitter.
- Window: Light or Dark switches between your chosen themes; a damaged stored preference no longer blanks the window; a job lost to an engine restart is marked failed; the save dialog no longer saves on Enter from Cancel or twice.
- Agents and the desktop app: the MCP bridge and the desktop extension reach the desktop app's engine and handle non-ASCII paths on Windows; the MCP endpoint accepts only JSON; an engine left behind on Windows exits; the app reports a failed start after a minute instead of waiting for ever.
- Windows: scans skip junctions and count hard links once; font install works after an environment save; a variable edited to hold `%VAR%` is saved as expandable.
- Docs: the README rename example renames the pictures, and it gives the right tool count and 3D formats.

## 0.6.3 · 2026-11-12

Fixes from a full review; nothing new.

- Safety: a web page on another site can no longer drive the engine's tools; only this computer's own window, and agents that send no Origin, are answered.
- Files kept whole: rotating or flipping a multi-page TIFF is refused instead of dropping its pages; renaming a link onto the file it points at no longer destroys the file; Duplicates no longer lists a file reached through two folders as a duplicate of itself.
- Viewer: Mod+C copies selected text instead of the file path; the PDF page box takes typed digits and page jumps land on the page; fonts whose path holds brackets or an apostrophe preview; the metadata panel no longer shows another file's tags after stepping back.
- Tools: rows a tool hides (Resize sizes, Output quality, Rename sub-folders) stay hidden.
- Linux: the deb's thumbnailer points at the FormTools engine folder, so thumbnails work again.

## 0.6.2 · 2026-11-03

- The README follows the Form family template, with screenshots in `docs/images/`. Nothing in the app changed.

## 0.6.1 · 2026-11-03

- The app icon is the Form family's unified icon on the desktop, in the splash and in the browser tab, and the compiled app is named FormTools. The repo now has a CODEOWNERS file. Nothing else in the app changed.

## 0.6.0 · 2026-11-03

- Desktop builds: `./build_app` (macOS and Linux) and `build_app.bat` (Windows) build the app start to finish in the family's pattern, passing formcompiler's `--config` through. Linux makes deb, rpm and an AppImage; the AppImage now bundles with the frozen engine's own libraries.
- The family: formtools is registered in formcompiler and listed in formskills, formMCP and FormPortal.
- All metadata: every file's tags through ExifTool, grouped by source, filterable and copyable, in the viewer's information panel; ExifTool is fetched on request when the computer does not have it, and agents read it through `exif_read`.
- Preferences follows formvis: rail with scroll spy and the connector wire, foldable cards, sliders with number boxes, interface font size, following the system theme, keyboard shortcuts, privacy and data, engine status and reset.
- Home: the whole main area takes dropped files and suggests the tools for them; everything fits without scrolling; the left panel resizes and collapses to a minirail, and the tool groups fold like formvis's toolbar.
- Disk usage: a heatmap of every file coloured by type, a type and extension breakdown, allocated against apparent size, and the largest files.

## 0.5.0 · 2026-11-03

- Desktop utilities, each with its own global shortcut set in Preferences: a colour picker with a loupe and twelve formats (HEX, RGB, HSL, HSV, HWB, CMYK, CIE Lab and LCh, OKLab, OKLCH, decimal, float) and a history; a screen ruler (bounds, spacing by colour tolerance, horizontal, vertical); a text extractor recognised on this computer (Vision on macOS, Windows OCR, Tesseract on Linux); zoom and draw with shapes, arrows, text, boards and copy as PNG; a break timer; Awake; Always on top for another app's window; a hosts file editor with checks and a backup; environment variables per scope. Utilities that cannot work on a system or session are hidden there.
- OS integration: formtools registers as a viewer (never the default) for pictures, RAW, PSD, EXR, 3D models, fonts, archives and formvis projects; `formtools --tool convert|resize|rename|hash|dupes|disk|view files...` opens a tool with files, from a second launch too; opt-in file manager menu entries for Nautilus, Dolphin and Nemo, macOS Quick Actions and the Windows menu; a Linux thumbnailer for formats the desktop cannot preview.
- Agents and release: `./formtools agents sync` and `agents check` keep the agent skills mirrored and within the format rules, `./formtools mcpb check` and `mcpb build` make the Claude Desktop extension, and CI runs both checks. The formcompiler entry, the FormPortal row and the formMCP and formskills steps are drafted for the owner.
- Fonts in WOFF2 open (Brotli).

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
