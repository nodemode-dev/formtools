# Screenshot, Capture and Clipboard Tools

Research date: 2026-11-03.

## ShareX (Windows)

- Capture: fullscreen, active window, active monitor, region, last region, custom region, scrolling capture, auto capture, screen recording, GIF recording.
- Annotate: shapes, arrows, freehand, text, speech balloons, step numbers, highlight, blur, pixelate, magnify, spotlight; cropping, cut-out and background editing.
- OCR: text extraction from captures; also standalone.
- Workflow engine: hotkey triggers a capture; chained after-capture tasks (save, copy, edit, upload, OCR, QR scan); after-upload tasks (copy or shorten URL, QR code); external-program actions.
- Upload: many built-in services plus custom uploaders; guides for S3, Google Cloud Storage, Cloudflare R2.
- GPL-3.0, no ads or account. Windows only; distributed via website, GitHub, Microsoft Store, Steam.
- formtools note: model capture as "source, then ordered task list" so the same pipeline serves save, copy, OCR, and share.

## Flameshot

- Cross-platform (Linux, Windows, macOS), GPLv3+. In-capture editor with pencil, line, arrow, rectangle, circle, marker, text, pixelate, selection, undo and redo, color picker; DBus interface; Imgur upload with Return.
- CLI: `gui` (editor, with save path and delay), `full`, `screen` (with clipboard and raw PNG output), `config`.
- Logo under Free Art License, icons Apache-2.0.
- formtools note: a scriptable CLI with delay and clipboard flags is the minimum automation surface.

## CleanShot X (macOS)

- Scrolling capture across apps, on-device text recognition and QR reading, screen recording with audio, webcam, click and key display, MP4 or GIF output, Studio Mode editor, annotation with redaction and numbered steps, cloud sharing with comments, team plans. macOS only, paid, price not shown on the page. (single source)
- formtools note: on-device OCR plus redaction in the same capture pass is a privacy-friendly pairing.

## macOS Screenshot

- Shift-Command-3 full screen, 4 region (Space toggles window), 5 opens the panel, 6 Touch Bar; adding Control copies to clipboard. Panel offers capture or record for screen, window, portion; timer; destination; microphone; pointer; remember last selection; HDR or SDR. Saves PNG screenshots and MOV recordings with date-stamped names. Floating thumbnail allows markup, trim, drag, or swipe to save.
- formtools note: the floating-thumbnail-then-act pattern avoids modal dialogs.

## OCR engines

- PowerToys Text Extractor: Win+Shift+T overlay, drag over text, copies to clipboard; uses installed Windows OCR language packs.
- Tesseract: Apache-2.0 (uses Leptonica, BSD 2-clause style); 100+ languages; outputs text, hOCR, PDF, TSV, ALTO, PAGE; input PNG, JPEG, TIFF; version 5 line.
- formtools note: Tesseract is the portable fallback; use platform OCR where it exists.

## Clipboard managers

| Tool | Platforms | License | Notes |
|---|---|---|---|
| Windows clipboard history | Windows | built in | Win+V; 25 entries, 4 MB per item, text/HTML/bitmap; pin; cleared on restart except pins; optional cross-device sync via account |
| CopyQ | Linux, Windows, macOS 13+ | GPL-3.0 | tabs, tags, notes, text/HTML/images, scripting, CLI (`add`, `read`, `copy`) while app runs |
| Ditto | Windows | GPL-3.0 | local-first, no cloud or telemetry, text/images/HTML/custom formats, hotkey popup |
| Maccy | macOS 14+ | MIT | keyboard-first, lightweight, free |

- formtools note: for a clipboard module copy CopyQ's tabs, tags and CLI, and Windows' pin and size limits as defaults; make sensitive-content exclusion explicit.

## Sources

- https://github.com/ShareX/ShareX
- https://github.com/flameshot-org/flameshot
- https://cleanshot.com/
- https://support.apple.com/guide/mac-help/take-a-screenshot-mh26782/mac
- https://learn.microsoft.com/en-us/windows/powertoys/text-extractor
- https://github.com/tesseract-ocr/tesseract
- https://support.microsoft.com/en-us/windows/clipboard-in-windows-c436501e-985d-1c8d-97ea-fe46ddf338c6
- https://github.com/hluk/CopyQ
- https://github.com/p0deje/Maccy
- https://github.com/sabrogden/Ditto
