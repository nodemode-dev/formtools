# libvips feature encyclopedia

Snapshot 2026-11-03. Docs show library version 8.18 (8.18.x patch series; changelog head is 8.19.0 "date-tbd", i.e. in development). License: LGPL-2.1-or-later. Roughly 300 operations. Official GUIs: nip4 (spreadsheet-meets-editor) and vipsdisp (viewer). Used as the engine by sharp (Node), imgproxy, Mastodon, Rails and others.

## 1. Why it is fast (mechanisms documented by the project)
1. Demand-driven evaluation: images are streamed through the machine as small regions; only pixels currently needed sit in RAM. Operations build a pipeline of "partial images" (a start/generate/stop function triple) and nothing runs until a sink pulls pixels.
2. Horizontal threading: threading lives in the image I/O layer; each worker thread gets a lightweight private copy of the whole pipeline, so locking is nearly absent (about one mutex on file read, one on file write) and CPU caches are used well.
3. Overlapped I/O: load, process and save run in parallel, including a write-behind thread, even when the codec library is single-threaded.
4. Almost tile-less: overlapping rectangular regions instead of fixed tiles reduce housekeeping and synchronisation.
5. SIMD: the Highway library with runtime dispatch, typically 3 to 4 times faster on supported operations.
6. Shrink-on-load and true streaming: loaders can decode at reduced scale (for JPEG, WebP, etc.), and since 8.9 sources/targets allow decoding from a pipe and encoding to a pipe without full buffering.
7. Operations are side-effect free and mostly pointer-adjusting, so large images avoid copies; once a pipeline is set up it runs without allocating memory.

Benchmark (project's own, crop 100 px per edge, 10 percent shrink, sharpen, TIFF in/out, 16-core Threadripper): vips C program about 0.57 s and 94 MB; vips CLI about 1.25 s; Pillow-SIMD about 1.51 s; ffmpeg about 2.06 s; `magick`/`convert` about 4.4 s and 1.5 GB; ImageMagick via Imagick about 10.5 s. This is the vendor's benchmark on its own test; treat as directional.

formtools note: use libvips for thumbnails, batch resizes and big images (scans, maps); the memory profile is the main user-visible win.

## 2. CLI
- `vips <operation> args... [--option value]`; no args prints usage for the operation; `vips -l` lists operations; `vips -l foreign` lists formats.
- Output format is chosen by file suffix; loader/saver options go in square brackets, e.g. `out.jpg[Q=90,strip]`.
- Each CLI call is a separate process, so there is no in-process chaining: intermediate files are needed (or use bindings). `stdin` and a suffix-only output name stream through pipes.
- Shortcuts include `vipsthumbnail`, `vipsheader`, `vipsedit` and `vipsprofile` (named in project docs; not each verified here).

formtools note: use the bindings (pyvips, sharp or libvips C API) from a sidecar for chains; CLI is best for one-shot jobs.

## 3. Formats and scope
JPEG, JPEG 2000, JPEG XL, TIFF, PNG, WebP, HEIC, AVIF, FITS, Matlab, OpenEXR, PDF, SVG, HDR, PPM/PGM/PFM, CSV, GIF, Analyze, NIfTI, DeepZoom, OpenSlide; others (e.g. DICOM) through ImageMagick/GraphicsMagick loaders. Numeric types from 8-bit int up to 128-bit complex; any number of bands. Operation families: arithmetic, histograms, convolution, morphology, frequency filtering, colour, resampling, statistics, smart cropping and thumbnailing. Newer changelog entries mention CICP color metadata for HDR images and Ultra HDR JPEG save in the 8.19 development line.

## 4. Bindings
C, C++, CLI officially; full bindings for Ruby, Python (pyvips), PHP, .NET (NetVips), Go (vipsgen), Lua, Crystal, Elixir, Java, Nim; Rust exists (vips-rs); a WebAssembly build covers JPEG, PNG, WebP, TIFF.

## 5. Trade-offs
(Analysis, not from sources.) Smaller operation vocabulary for artistic effects than ImageMagick; no animation authoring beyond GIF/WebP/AVIF paging; operations are functional (new image each time), so the programming style differs from mogrify-style in-place editing.

## Sources

- https://www.libvips.org/
- https://www.libvips.org/API/current/how-it-works.html
- https://www.libvips.org/API/current/using-the-cli.html
- https://www.libvips.org/2019/11/29/True-streaming-for-libvips.html
- https://raw.githubusercontent.com/wiki/libvips/libvips/Why-is-libvips-quick.md
- https://raw.githubusercontent.com/wiki/libvips/libvips/Speed-and-memory-use.md
- https://raw.githubusercontent.com/libvips/libvips/master/README.md
- https://raw.githubusercontent.com/libvips/libvips/master/ChangeLog
