# Loupe (GNOME Image Viewer)

GNOME's default viewer since GNOME 45, written in Rust with GTK 4. Listed version 51.rc (2026-09-01) on apps.gnome.org. License GPL-3.0-or-later. Linux (distributed via Flathub). Distinguishing idea: security-first decoding through a sandboxed loader library, glycin.

## Features

- **Sandboxed decoding**: glycin runs each image decode in its own sandboxed process with no write or network access, talks over D-Bus on a UNIX socket, and returns pixels in a sealed memfd. A crash or exploit in a decoder should not take down the viewer. The author says the sandbox hardening is still maturing. Glycin is Linux only. formtools note: process-isolated decoders are the most defensible design for an app that opens untrusted files; consider it for the Rust or native core. (single source)
- **Speed and how**: GPU rendering keeps UI, animation and touch gestures smooth on high-resolution and high-refresh displays; SVGs are rendered in tiles for only the visible area; images over 256 megapixels load reliably on limited video memory (GNOME 47). Trade-off: tiled SVG can blur while pinch-zooming, and animations can lag on huge images or old hardware. formtools note: tile rendering for very large images and vectors is the right approach, with a software-render fallback.
- **Zoom**: at 100% images match physical screen pixels. GNOME 48 work planned zoom presets (such as 100%) plus arbitrary values. formtools note: honor device pixel ratio for true 1:1.
- **Transparency**: background color chosen from the image content. formtools note: adaptive checker or flat color keeps transparent images legible.
- **Color management**: ICC support via decoder crates; July 2026 update shows color-management details (an ICC profile description or CICP values) in the image properties; later CMYK display fixed and the color model shown. HDR was not mentioned in the sources fetched. formtools note: show profile description and CICP in the info panel.
- **Formats**: new decoders mostly in Rust; some rarely-used format features that the older viewer opened may fail (author names TIFF fax encoding as a possible gap). JPEG XL moved to jxl-rs. A first RAW loader was merged in the glycin GNOME 47 cycle. formtools note: document known-unsupported sub-features per format.
- **Lossless rotate**: rotating a JPEG rewrites only the one-byte EXIF orientation tag, with no re-encode. glycin's first editing support is JPEG orientation. formtools note: prefer an orientation-tag rotate when the file allows, with an explicit pixel rotate option.
- **Basic edits**: rotation shipped; crop interface was planned for 48; the app page lists crop, rotate and flip, plus metadata viewing. formtools note: matches the minimal edit set.
- **Printing**: prints with correct physical dimensions via an intermediate PDF (2026). formtools note: print at true size. (single source)
- **Metadata**: image properties panel on the app page. formtools note: see matrix.
- **Slideshow, compare, archive, batch, plugins**: none documented in the sources fetched.

## Not verified

- Shortcut list, HDR support, animated-format coverage, RAW coverage today, and the Loupe repo README (GNOME GitLab pages failed to load).

## Sources

- https://apps.gnome.org/Loupe/
- https://blogs.gnome.org/sophieh/2023/08/30/viewing-images-in-gnome-loupe-and-glycin/
- https://blogs.gnome.org/sophieh/2024/09/20/image-viewing-and-editing-in-gnome-47-and-beyond/
- https://blogs.gnome.org/sophieh/2026/10/30/gnome-fellowship-october-2026/
- https://blogs.gnome.org/sophieh/2025/06/13/making-gnomes-gdkpixbuf-image-loading-safer/
- https://discourse.gnome.org/t/259-color-management/37190
- https://thisweek.gnome.org/posts/2024/06/twig-153/
