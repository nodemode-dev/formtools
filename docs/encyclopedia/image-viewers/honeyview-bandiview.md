# Honeyview and BandiView (archive and comic viewing)

Bandisoft's viewers for Windows. Honeyview 5.53 (2024-06-21) is freeware, receives no new features or security updates, and is pointed to BandiView as its successor. BandiView 8.03 (2026-10-14) requires 64-bit Windows 10 or 11 (x64 and ARM64 installers) and has a free (shareware) edition and a paid Professional edition. Closed source.

## Features

- **Archive reading**: Honeyview shows images inside ZIP, RAR, 7Z, LZH, TAR, CBR and CBZ without extracting. BandiView adds more archive types (ALZ, EGG, CAB, ISO, ZSTD among them). 8.02 improved load speed for images inside archives and for DNG. formtools note: read archives by streaming entries, never extract to disk first. (single source)
- **Comic and book modes (BandiView)**: smart double-page mode, left-to-right or right-to-left (keys 7 and 6, 2 to switch direction), a separate cover page option (Shift+S), and webtoon mode (key 5) where Page Down scrolls continuously and Shift+Page Down jumps image. Webtoon mode is Professional only. formtools note: double-page with RTL and a cover offset, plus a continuous vertical mode, is the complete comic feature set.
- **Navigation**: Home/End first and last; Page Down/Up, Backspace for next and previous; Ctrl+Page for jumps of ten; Ctrl+Alt+Page for random image; brackets for next or previous folder or archive; a bookmark manager (8.0). formtools note: next archive in folder with one key is essential for comic libraries.
- **Zoom**: plus and minus, Ctrl+wheel; Shift for 1% steps; 0 for 100%; 9 then 1 for fit window; 8 for fit width; Ctrl+K locks zoom. formtools note: single-key zoom modes are fast for power users.
- **Speed**: Honeyview is called fast and lightweight with quick startup. BandiView claims conversion up to 10x faster than competitors in the Professional edition (vendor chart, no figures). formtools note: treat vendor multiples as marketing; benchmark ourselves.
- **Formats**: BMP, JPG, GIF, PNG, PSD, WebP, TIFF, JXR, J2K, TGA, many RAW (DNG, CR2, NEF, ORF, RAF), animated GIF, WebP, BPG, PNG; BandiView adds AVIF, JXL, EXR, QOI, ICO, SVG, animated AVIF; Professional adds HEIC/HEIF and Clip Studio. Honeyview caps at 23,170 by 23,170 pixels; BandiView has no stated limit. formtools note: avoid arbitrary resolution caps.
- **HDR**: BandiView Professional outputs HDR (the free edition shows HDR images in SDR). 8.0 added Ultra HDR HEIC; 8.02 added Adobe HDR JPEG, adaptive HDR tone mapping, and following Windows 11 HDR calibration. formtools note: follow the OS HDR calibration, offer adaptive tone mapping.
- **Color management**: ICM color management for multiple monitors (edition mapping unclear on the page). formtools note: per-monitor profile when the window moves.
- **Batch conversion**: format and size conversion; Professional is the faster edition, notably for HEIC, Clip to any, and any to AVIF. Honeyview batch is labeled slow. formtools note: parallelize conversion and include AVIF encode.
- **Other**: dark UI (8.0), Ctrl+Alt+S to save the viewed image unchanged, EXIF for PSD, Stable Diffusion prompt viewing, HiDPI. Shortcuts philosophy: single keys and modifiers with consistent meaning (Ctrl for file operations, Alt for animation and menus, Shift for finer steps), and each action has a command-line name. formtools note: expose a named-action table so shortcuts, CLI and toolbar share one registry.

## Not verified

- Which edition owns each feature in the comparison table (the extraction was ambiguous for some rows), plugin system (none seen), lossless rotate, prefetch details.

## Sources

- https://www.bandisoft.com/honeyview/
- https://www.bandisoft.com/bandiview/
- https://en.bandisoft.com/bandiview/help/edition-comparison/
- https://en.bandisoft.com/bandiview/history/
- https://en.bandisoft.com/bandiview/help/shortcut/
