# gThumb

GNOME's image viewer, browser and organizer (GTK, Linux; also packaged via Flatpak). License GPL (family not confirmed on fetched pages). More of a browser and editor than a pure viewer.

## Features

- **Formats**: PNG, JPEG, WebP, SVG, JPEG XL, HEIF, AVIF, TIFF, GIF and RAW. The 3.12 release added opening AVIF, HEIF and JPEG XL and saving AVIF. formtools note: saving AVIF from the viewer is a modest but modern convenience. (single source: release announcement and README)
- **Speed**: 3.12 made folders with thousands of images faster and generated more thumbnails concurrently. formtools note: concurrent thumbnailing is a baseline.
- **Zoom**: smoother zoom that keeps the pixel under the pointer fixed (3.12). formtools note: cursor-anchored zoom everywhere.
- **Color**: reads color profiles in PNG (3.12); color picker supports percentage RGB and HSL. formtools note: color picker output formats matter to designers.
- **Metadata**: view and edit EXIF, IPTC and XMP; comments; catalogs and libraries, search saved as catalogs. formtools note: a basic metadata editor plus tags is the realistic target.
- **Lossless JPEG transforms**, resizing, format conversion, rotate, crop, contrast, brightness, saturation adjustments, set as desktop background. formtools note: lossless transform is listed in its feature summary; copy.
- **Batch and file management**: copy, move, rename, delete, run scripts on selected files; rename templates with a template editor and a button to reuse the last template (3.12); filters bindable to shortcuts. formtools note: rename templates with reuse-last are a cheap, loved batch feature.
- **Slideshow** and a built-in media viewer with keyboard shortcuts, skip and seek (3.12). formtools note: include basic video playback only if the scope allows.
- **Input**: back and forward mouse buttons for navigation (3.12). formtools note: map mouse side buttons.
- **Archive, compare, HDR, plugin (extensions)**: not covered in the sources fetched (the gThumb wiki feature page is excluded as a wiki, and GNOME GitLab pages failed to load).

## Not verified

- Current version and release date, exact license wording, HDR, animated-format handling, extension system.

## Sources

- https://raw.githubusercontent.com/GNOME/gthumb/master/README.md
- https://mail.gnome.org/archives/gnome-announce-list/2021-September/msg00014.html
