# nomacs

Qt-based open-source viewer for Windows, Linux, macOS, FreeBSD, Haiku and OS/2. Latest stable per releases page: 3.22.4 (October), with 3.23.x betas. License: GPL-3.0. Distinguishing idea: synchronized viewers for comparison and an optional plugin set.

## Features

- **Project health**: no active maintainer was declared in the status issue (the last remaining maintainer said he could no longer do releases), though releases continued through 2026 via contributors. This is a risk signal. formtools note: do not build on nomacs code; treat it as a feature reference.
- **Synchronized viewing**: viewer instances can be linked so pan and zoom apply to several windows at once for comparison. LAN-wide sync was not confirmed on the pages fetched. formtools note: implement sync as a first-class compare mode across windows or panes.
- **Formats**: common formats plus RAW (through LibRaw, a build option needing OpenCV) and PSD. Through Qt and KImageFormats plugins: AVIF, HEIF, JPEG XL, OpenEXR, DDS, QOI, EPS, TGA, WebP and others (many read-only). Multi-page TIFF and reading images straight from ZIP archives are build options. APNG was requested and remains open. formtools note: publish a read/write capability table per format.
- **Color management**: 3.22.0 (first non-beta release in a long time) added color management, CMYK support and proper HiDPI rendering. A tracker issue says color management still needs improvement (open). formtools note: test with wide-gamut and CMYK files.
- **Speed**: 3.22.0 advertises faster thumbnails; 3.23.1 beta added high-quality thumbnails and slideshow fade improvements. No mechanism documented. formtools note: thumbnail quality and thumbnail speed both matter; offer a quality setting.
- **Metadata**: uses Exiv2 for metadata, shows a metadata panel, has comments and ratings improvements in 3.22.0. A tracker issue reports that auto-save or rotation can change file timestamps and metadata (closed, forked fix). formtools note: never touch mtime or metadata unless the user saved.
- **Basic edits**: crop, resize, rotate, color adjustments. A crop feature added in 3.17 drew criticism in the status thread. formtools note: keep crop non-destructive and cancelable.
- **Plugins**: separate nomacs-plugins project (paint on image, composite, affine transform, fake miniatures, page extraction) that require OpenCV. The 3.23.2 beta removed the option to download external DLL plug-ins. formtools note: avoid binary plugin download inside the app; ship vetted plugins.
- **Single instance**: new in the 3.23.4 beta (KDSingleApplication on Windows and macOS, D-Bus on Linux). formtools note: single instance with window-reuse is expected behaviour. (single source)
- **Archive reading**: ZIP support improved in 3.22.0. formtools note: see honeyview-bandiview.md.
- **Most requested open items**: always-on-top in frameless mode (13), recursive folder scan problems (11), filter by star rating (6), keep zoom and position (6). formtools note: add a pinned frameless mode and rating filters.

## Not verified

- HDR display, lossless JPEG rotation, the exact synchronization options (LAN), the default shortcut scheme.

## Sources

- https://github.com/nomacs/nomacs
- https://nomacs.org/
- https://nomacs.org/docs/documentation/features/
- https://github.com/nomacs/nomacs/releases
- https://github.com/nomacs/nomacs/issues/612
- https://api.github.com/search/issues?q=repo:nomacs/nomacs+type:issue+sort:reactions-%2B1&per_page=15
