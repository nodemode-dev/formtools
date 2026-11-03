# XnResize

Free, cross-platform, resize-focused sibling of XnConvert. Version 1.11 on product page (Windows installer and zip, macOS DMG). Platforms per product page: Windows 7 to 10, macOS 10.5+, Linux 64-bit listed but marked "Available soon"; a separate guide states Windows 8+, macOS 10.12+, Linux (the two pages disagree; could not reconcile). 20+ translations. License: freeware for private, educational, non-profit use; donations welcomed. Reads 500+ formats, writes about 70 (same engine as XnConvert).

## Workflow (four tabs)

1. Select Photos: Add Files, Add Folders, or drag and drop. Thumbnails show name, resolution, size; adjustable thumbnail size; sort by name, size, dates; remove selected or all.
2. Action (sizes and presets): quick size presets or custom width and height in pixels, percent, inches, cm, mm. Modes: Fit, Fill, Longest side, Shortest side, Megapixels, Width, Height. Keep-aspect toggle. Resample method (Bilinear, Lanczos, Mitchell and others). Optional rotate 90 cw, 90 ccw, 180. Gamma correction and orientation fix options. No crop.
3. Output: folder; filename template (keep name, add suffix such as "_result" or the target dimensions); case change for name and extension; format with per-format settings (quality, subsampling, etc.); overwrite policy; keep folder structure; keep original date/time; keep metadata (EXIF, IPTC, XMP) and colour profile.
4. Status: progress and errors.

## Presets

- Built-in size presets exist. In classic XnView they were hard-coded in the executable (not editable). XnView MP lets users add presets but not delete defaults. For XnResize, custom preset storage format not verified.
- Whole-job presets/scripts: not confirmed for XnResize.

Formtools note: a "resize-only" simple mode should be a thin skin on the same job model: file list, one size action with modes/units/resampler, output panel with template, format, overwrite, metadata; keep presets as JSON with user-editable list.

## Differences from XnConvert

| Aspect | XnResize | XnConvert |
|---|---|---|
| Actions | resize and rotate only | 80+ chained |
| Hot folders, NConvert export | not documented | yes |
| Complexity | 4 tabs, simple | action stack + preview |

## Not verified

Whether XnResize shares hot folders, scripts, or settings files; Linux release status; actual 1.11 release date; current maintenance status (the XnConvert product is the actively updated one).

## Sources

- https://www.xnview.com/en/xnresize/
- https://www.xnview.com/en/how-to-resize-images/
- https://www.ghacks.net/?p=161080
- https://newsgroup.xnview.com/viewtopic.php?p=99975
