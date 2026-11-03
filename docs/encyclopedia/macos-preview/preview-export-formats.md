# Preview: Export, Export as, and format options

## Commands
- File > Export: single document, format pop-up. Option held reveals more formats.
- File > Export as PDF (shown for images and 3D) and Export Selected Images (separate files from sidebar selection; one PDF each in the PDF case, per TidBITS).
- Option + File menu turns Duplicate into Save As.
- Batch: open multiple images in one window, select in the sidebar, File > Export Selected Images (Apple says the batch dialog options are not specified).

formtools note: provide one export dialog with a batch mode driven by a selection list.

## Default format list (Apple, convert page)
HEIC, JPEG, JPEG-2000, OpenEXR, PDF, PNG, TIFF.

## Hidden formats (Option-click on Format)
Apple says only that specialized or older formats appear. Third-party sources name ICNS, KTX, Photoshop, PostScript (addictivetips) and say 19 formats total vs 6 by default on 2016 macOS (TidBITS). Re-fetched TidBITS: it confirms the 6-versus-19 count but does not tie names to the hidden set; it lists 14 "other image formats" in the article: ASTC, ICNS, JPEG-2000, KTX, Microsoft BMP, Microsoft Icon, OpenEXR, PBM/PGM/PPM, PVRTC, Photoshop, QuickTime Movie, SGI, TGA and PostScript. Apple's own guide still says only that Option reveals more; no vendor list exists. Not verified for macOS 27. Also commonly seen: BMP, GIF, ICO, TGA, SGI, JPEG 2000 variants; these were not confirmed by a fetched source this session. (single sources, unverified for macOS 27)

formtools note: target at least JPEG, PNG, TIFF, HEIC, GIF, BMP, WebP, AVIF, PDF; Apple's list lacks WebP/AVIF export, which is a gap to fill.

## Per-format options
- JPEG and JPEG-2000: quality slider.
- HEIC: Apple lists the format but not its options on the fetched pages; quality slider presence is likely, unverified.
- PNG: Alpha checkbox (without it, transparency renders white), pixel depth options not verified. (TidBITS)
- TIFF: compression None, LZW, Packbits. (TidBITS)
- GIF: single-frame export described; animation not covered.
- Common fields on image exports: Resolution (pixels per inch), file size estimate, Color profile ("Profile"), Alpha; exact field set per format not documented by Apple's fetched pages.
- PDF (from image): Quartz Filter pop-up and Encrypt; PDF from PDF adds permissions, linearized, image optimization.

## PDF export features
- Quartz filters: Reduce File Size, Black & White, Sepia (Apple); Blue Tone, Gray Tone, Lightness adjust, Create Generic PDFX-3 (TidBITS).
- Encrypt / permissions as in preview-pdf.md.
- Export as Image from PDF page: select page in thumbnails, File > Export, choose PNG etc.

## Quick Action Convert Image
Finder > Quick Actions > Convert Image: format and size choice (Apple example: HEIC to JPEG or PNG). Metadata-preserve toggle and size presets (small, medium, large, actual) are known from macOS dialogs but not confirmed by fetched Apple text.

formtools note: add a "preserve metadata" toggle and size presets to match this dialog.

## Sources
- https://support.apple.com/guide/preview/convert-image-file-types-prvw1012/mac
- https://support.apple.com/guide/preview/export-pdfs-and-images-prvw0e8da223/mac
- https://support.apple.com/guide/preview/reduce-the-size-of-a-pdf-prvw1509/mac
- https://support.apple.com/guide/preview/add-effects-to-a-pdf-prvw1510/mac
- https://support.apple.com/guide/mac-help/use-quick-actions-in-the-finder-mchl97ff9142/mac
- https://tidbits.com/2016/05/18/the-power-of-preview-converting-images-and-exporting-pdfs/
- https://www.addictivetips.com/mac-os/show-hidden-export-formats-in-preview-on-macos
- https://support.apple.com/guide/preview/prvw1012 (re-read for macOS 27)
