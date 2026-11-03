# IrfanView

Windows-only freeware viewer with a very long history. Current version on the homepage is 4.76. Distinguishing idea: a tiny single-executable core, with everything else (extra formats, effects, OCR, video) pushed out to optional plugins and a very deep batch and thumbnails toolset.

## Facts

- License: freeware for private non-commercial use, free for educational and charitable organizations, paid license for business use. Closed source.
- Platforms: Windows XP through 11, with 32-bit, 64-bit and ARM64 builds. No macOS or Linux build.
- Portability: every build can be run portable (copy the folder, or use the ZIP). The Microsoft Store variant cannot load plugins.

## Features

- **Speed and size**: the project describes itself as fast and compact, and ships as one EXE with no DLLs and no unprompted registry changes. No benchmarks are published, so the speed claim is design-based (small binary, few dependencies), not measured. The FAQ names what slows it down: sorting by EXIF date on first folder load, color management or "Quant-Smooth" on JPG load, and full-size RAW decode (the RAW plugin has a fast preview or half-size mode). formtools note: expose "fast preview first, full decode later" for RAW and large files, and tell users which options cost load time.
- **Zoom and fit**: 4.76 added a Ctrl+click jump to 100% in the zoom magnifier and a changed initial magnifier zoom. Fit modes are standard. formtools note: a magnifier loupe separate from the main zoom is cheap and well liked.
- **Navigation and thumbnails**: a separate Thumbnails window with adjustable sizes, sort by EXIF date, an option to use the embedded EXIF thumbnail for JPGs (turning it off fixes blurry thumbs), up to 15 favorite folders (4.76), and typing a path into the folder box. Selected thumbnails can become a contact sheet or be printed. Very large folders can crash this window, per the FAQ. formtools note: virtualize the thumbnail grid so folder size never matters, and offer favorites plus a typed-path box.
- **Lossless JPEG**: rotate and crop without recompression, change EXIF dates (also in batch), edit IPTC and comments without recompression. Auto-rotate depends on a correct EXIF orientation tag. formtools note: implement transforms at the MCU/transform level and fall back to an explicit "recompress" prompt when edges are not block aligned.
- **Batch conversion**: the batch dialog supports output-folder placeholders (for example, a token for each file's original folder and date tokens to sort into date-taken folders) and rename patterns. Conversions are multithreaded per the product description. A shell extension adds batch convert and slideshow to the Explorer context menu. Command line supports convert, thumbnails, file lists and per-monitor wallpaper (4.76). formtools note: placeholder-based output paths and rename patterns with a dry-run preview should be the model for formtools batch.
- **Plugins**: plugins are native DLLs dropped into a PlugIns folder, bitness must match the host. Categories: image formats (camera RAW, AVIF, WebP, JPEG XL, JPEG 2000, PDF, DjVu, DICOM, EXR, CAD, many legacy), effects and paint, Photoshop 8BF filter hosting, media playback, utilities (OCR needing Tesseract, Postscript needing Ghostscript, email, FTP, LCMS color management, slideshow export to MP4). A new SVG plugin and better AVIF color profile handling arrived in plugin set 4.76.1. formtools note: keep the core small and let heavy decoders (RAW, PDF, OCR) be optional packages with clear dependency prompts.
- **Animated formats**: 4.76 added animated AVIF. GIF and WebP animation are handled by core and plugins. formtools note: treat animated AVIF as first class, not an afterthought.
- **Color management**: optional, off the fast path (LCMS plugin and settings), and flagged as a possible JPG load slowdown. HDR is not documented on the pages fetched. formtools note: color management should be on by default but cached per image so it does not tax browsing.
- **Basic edits**: drawing tools, crop, straighten, text or image watermark, multipage TIF editing, multiple undo, effects via plugins. formtools note: keep editing shallow and route heavy work to filters or external editors.
- **Slideshow**: transition effects, metadata overlay, export as MP4, EXE or screensaver, burn to disc. formtools note: slideshow export to a video file is a differentiator worth matching.
- **Archive and comic**: not a core feature on the pages fetched (single source on its absence). formtools note: see honeyview-bandiview.md.
- **Shortcuts and customization**: remappable hotkeys, customizable toolbars, toolbar position left or right (4.76), settings in an INI file that can be relocated, with Admin_ keys to lock features in managed environments. formtools note: a plain, relocatable settings file plus lockable keys suits power users and IT.
- **Scanning, capture, wallpaper, email, media player**: bundled utilities beyond viewing (screen capture, icon extraction, scan). formtools note: only add these as separate modules.

## Not verified

- Supported-format list (the formats page was not fetched), HDR display support, and whether the 64-bit build uses GPU rendering.

## Sources

- https://www.irfanview.com/
- https://www.irfanview.com/plugins.htm
- https://www.irfanview.com/main_history.htm
- https://www.irfanview.com/faq.htm
- https://www.irfanview.com/main_what_is_engl.htm
