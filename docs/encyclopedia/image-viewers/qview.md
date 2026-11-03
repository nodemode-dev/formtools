# qView

Minimal Qt viewer by jurplel. GPL-3.0. Windows, macOS and Linux (packages on AUR and Homebrew). Latest stable on the releases page: 7.1. Distinguishing idea: minimalism, a lightweight window, and fast image switching.

## Features

- **Speed and how**: multi-threaded preloading of neighbouring images so switching feels instant; 6.0 added faster switching in large folders and faster network share access. A top-reacted issue asked about slow loading and switching (closed). formtools note: preload in the navigation direction and measure on 10k-file folders and network shares.
- **Philosophy**: designed around minimalism and usability, with many preferences available. formtools note: minimal default UI with a deep options page.
- **Window and zoom**: window can size to the image; open requests include option to open at 100% even when maximized (open), mouse wheel to navigate (open, multiple issues), show titlebar on hover (open). formtools note: make wheel behavior (zoom versus navigate) a clear option.
- **Formats**: BMP, GIF, JPG, PNG, TIFF, WebP; 5.0 added many including JXL and PSD; 6.0 added RAW, HEIF and AVIF through kimageformats; 7.0 added QOI, DDS, PFM, PXR, SCT. formtools note: lean on a maintained image-format plugin set instead of writing decoders.
- **Color management**: color profile support added in 6.0 (Qt 5.14+), with CMYK and ICC fixes in 7.0 and PNG embedded profile fixes in 6.1. formtools note: color profile on by default.
- **Metadata**: an info dialog; macOS metadata sidecar (._) files are ignored. formtools note: filter sidecar junk files from the folder list.
- **Trackpad and touch**: 7.1 added an option to force scroll or zoom on trackpads, native gesture support, better trackpad detection. formtools note: gestures need detection with manual override.
- **File actions**: Reload File, Delete Permanently (bypass trash), skip hidden files (7.0). DEL key support was a closed popular request. formtools note: Delete key to trash, with a separate permanent-delete action.
- **Animation, HDR, lossless rotate, batch, archive**: not described on pages fetched. A comic/manga reading function is an open request (5 reactions).

## Not verified

- Lossless JPEG rotate, HDR, animated WebP/AVIF support details, slideshow, plugin story (none noted). The qView features page failed to load.

## Sources

- https://github.com/jurplel/qView
- https://interversehq.com/qview/
- https://github.com/jurplel/qView/releases
- https://api.github.com/search/issues?q=repo:jurplel/qView+type:issue+sort:reactions-%2B1&per_page=15
