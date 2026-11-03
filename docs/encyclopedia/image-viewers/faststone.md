# FastStone Image Viewer (and MaxView)

Windows-only viewer, browser, converter and light editor. Version 8.5 released 2026-06-24. Distinguishing idea: a full-screen viewer with hidden edge panels and a compare view, plus a batch converter, in a free-for-personal-use package.

## Facts

- License: free for personal and educational use per the product page; a paid lifetime license exists for commercial users (listed at 34.95 USD for one user, with volume discounts). Closed source.
- Platforms: Windows (page lists Windows 11 down to XP). A portable package is offered. No macOS or Linux (single source: the product pages do not mention them).
- Companion product: MaxView 3.5 (2026-01-23), a small paid viewer that opens ZIP, RAR and 7-Zip including password-protected ones, and reads CBR, CBZ and CB7.

## Features

- **Formats and RAW**: JPEG, PNG, GIF, WebP, JXL, HEIC (HEIC relies on Windows codecs), TIFF, PDF, PSD, EPS, SVG, ICO, TGA, and many camera RAW formats (CR2, CR3, NEF, ARW, RAF, ORF, RW2, DNG). formtools note: rely on the OS codec for HEIC where licensing is murky, but say so in the UI.
- **Zoom and fit**: best fit versus actual size in one click, fit width, fit height, reset to 100% with Ctrl+0, and selectable zoom filters. formtools note: always provide both fit-width and fit-height, not just fit-window.
- **Compare**: side-by-side comparison of up to four images, extended to PDF in 8.4. formtools note: four-up compare with synced zoom is a good target; see matrix.
- **Slideshow**: more than 150 transition effects, background music (MP3, WMA, WAV), videos in slideshow. formtools note: transitions are low priority, music and video-in-slideshow are rarely matched elsewhere.
- **Color management**: embedded ICC profiles and monitor profiles, configured in a CMS tab in settings. formtools note: expose "use monitor profile" as an explicit toggle.
- **Batch**: batch convert and rename, multiple images processed at once, PDF output supported. formtools note: PDF output from a batch is a cheap, valued feature.
- **Basic edits and metadata**: red-eye removal, resizing, cropping, color adjustments. MaxView adds lossless JPEG rotate and crop and EXIF display. The main product page names these editing features but not lossless transforms for the full viewer (not verified). formtools note: ship lossless rotate at launch.
- **Speed**: the pages use fast and lightweight wording only, no benchmarks and no stated mechanism (prefetch or GPU is not documented). formtools note: publish our own reproducible benchmark instead of adjectives.
- **Animated formats, HDR, archive reading in the main product**: not stated on pages fetched.

## Not verified

- Lossless JPEG in the full viewer, HDR, animated WebP/APNG handling, plugin system (none documented), full changelog (history page failed to load).

## Sources

- https://www.faststone.org/
- https://www.faststone.org/FSViewerDetail.htm
- https://www.faststone.org/FSViewerDownload.htm
- https://www.faststone.org/FSIVPricing.htm
- https://www.faststone.org/FSMaxViewDetail.htm
