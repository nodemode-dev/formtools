# GIF tools: gifski, and FFmpeg's GIF path

## gifski

Snapshot 2026-11-03. Crate version on main: 1.35.0 (Cargo manifest); the README still links a 1.14.4 Windows MSI, so release pages and README are out of sync. Author: Kornel Lesinski (pngquant author). Mac GUI by Sindre Sorhus (App Store and direct download); a Windows GUI exists.
License: AGPL-3.0-or-later; the author sells commercial licenses for closed-source use (single source for the pricing model: gif.ski and README).

### Why its GIFs look better
- Uses pngquant's palette machinery: a palette per frame with cross-frame palette sharing and temporal dithering, so frames can use thousands of colors overall while each GIF frame stays at 256.
- Offers lossy LZW compression, temporal smoothing and denoising.

### Interface
- CLI first; also a C library (`gifski.h`, usable from C#, Swift, Rust, C, C++) and WebAssembly build.
- Inputs: PNG frame sequences (glob), a y4m stream on stdin (ffmpeg piped with `-f yuv4mpegpipe`), or optional built-in video decoding (disabled by default; depends on a specific older FFmpeg major and libclang).
- Key options named in README and site: `--fps`, `--width`, `--height`, `--quality`, `--lossy-quality`, `--motion-quality`, `-o`. Size-reduction guidance: shrink dimensions first, then lower quality; hitting a target file size needs trial runs (the estimate shown while encoding is imprecise).
- Guidance: if frames came from a lossy video, halve their size to hide compression artifacts and chroma subsampling.
- It may auto-downsize very large input; `--width` overrides.

formtools note: ship GIF export as "video to GIF" with fps, width and quality sliders and a live size estimate; call gifski as an external process (AGPL) rather than linking it, or use FFmpeg's palette filters as the permissive fallback.

## FFmpeg's GIF path (for comparison)

- Two-step palette flow with `palettegen` then `paletteuse` filters yields far better GIFs than the default one-pass palette; `fps` and `scale` filters set size and rate. (Filters confirmed in the FFmpeg filter reference; recipe is standard practice.)
- Typically larger or lower quality than gifski for the same size, but no extra dependency.

formtools note: offer FFmpeg palette GIF by default (no license friction) and gifski as the "best quality" engine when installed.

## Sources

- https://gif.ski/
- https://raw.githubusercontent.com/ImageOptim/gifski/main/README.md
- https://raw.githubusercontent.com/ImageOptim/gifski/main/Cargo.toml
- https://ffmpeg.org/ffmpeg-filters.html (palettegen, paletteuse, fps, scale entries)
