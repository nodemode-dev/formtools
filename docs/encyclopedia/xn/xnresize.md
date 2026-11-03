# XnResize

Free, cross-platform, resize-focused sibling of XnConvert. Version 1.11 on product page (Windows installer and zip, macOS DMG). Platforms per product page: Windows 7 to 10, macOS 10.5+, Linux 64-bit is named in the page title and platform sentence but the Linux download block says "Available soon" and has no link. Linux status (gap pass 2026-11-03): CLOSED as "no Linux build exists". The vendor's own download archive for XnResize lists only Windows x64 zip and setup plus a macOS dmg (versions 1.00, 1.10, 1.11.0), no Linux file, and guessed Linux file names on the download host return 404. The product page's changelog lists only 1.0 dated 2019-11-21. A separate guide states Windows 8+, macOS 10.12+, Linux; that guide's Linux claim is therefore unsupported by any download. Use XnConvert (which does ship Linux builds) for Linux resizing. 20+ translations. License: freeware for private, educational, non-profit use; donations welcomed. Reads 500+ formats, writes about 70 (same engine as XnConvert).

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

Whether XnResize shares hot folders, scripts, or settings files; current maintenance status (the XnConvert product is the actively updated one). Release dates now known from the vendor archive: 1.00 on 2019-12-20 (Windows), 1.10 on 2020-12-14 (Mac) and 2021-06-14 (Windows), 1.11.0 on 2023-10-25 (Mac) and 2023-11-24 (Windows); the vendor forum announcement for 1.11 is dated 2023-10-25 and says XnResize is freeware, including for company use, which differs from the product page's private and educational wording (two vendor statements disagree).

## Sources

- https://www.xnview.com/en/xnresize/
- https://www.xnview.com/en/how-to-resize-images/
- https://www.ghacks.net/?p=161080
- https://newsgroup.xnview.com/viewtopic.php?p=99975
- https://download.xnview.com/versions/XnResize/ (vendor archive listing with dates, no Linux file)
- https://newsgroup.xnview.com/viewtopic.php?t=46327 (vendor announcement of 1.11, 2023-10-25)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to forum, wiki gone)
