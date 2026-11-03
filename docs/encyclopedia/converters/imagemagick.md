# ImageMagick feature encyclopedia

Snapshot 2026-11-03. Latest stable shown on the official site: 7.1.2-35. Maintained by ImageMagick Studio LLC (non-profit).
License: the ImageMagick License (own text; wording resembles Apache-style terms, my read): free for personal, internal and commercial use; requires keeping the license text and attribution; source of modifications need not be released; stated as compatible with GPLv3.

## 1. Tools (IMv7 layout)
The primary entry point is `magick`. Legacy v6-style tools are available as sub-commands (`magick identify`, `magick mogrify`, and so on) or via symlinks if the install provides them.

| Tool | Purpose (paraphrased) |
|---|---|
| `magick` | Convert, resize, blur, crop, despeckle, dither, draw, flip, join, resample; one command builds a pipeline |
| `magick-script` | Scripting interpreter for command sequences |
| `convert` (v6) | Same job as `magick` in the old layout (not described on the v7 tools page; legacy) |
| `mogrify` | Batch edit that overwrites originals unless `-format` changes the suffix or `-path` redirects output |
| `montage` | Tile many images into one sheet, with labels, frames, borders |
| `identify` | Report format and characteristics; flags corrupt or incomplete files; `-verbose` gives statistics |
| `compare` | Visual and numeric difference between an image and its reconstruction |
| `composite` | Overlay one image on another |
| `conjure` | Run Magick Scripting Language (MSL) scripts |
| `animate`, `display`, `import` | X server only: show animations, view images, capture screen windows |
| `stream` | Stream raw pixels row by row for very large (tera-pixel) images |

formtools note: wrap only `magick` (single binary, v7 syntax) and parse `identify -format` output; avoid depending on X11 tools.

## 2. Command-line anatomy
A command is: input filenames, then settings (persistent, e.g. `-density -depth -quality -colorspace -background -font -size`), operators (immediate, e.g. `-resize -crop -rotate -blur -sharpen -trim -negate`), sequence operators (act on the whole image list, e.g. append, coalesce), parenthesized image stacks, and finally one output name. Order matters because settings apply to later reads and operators act on current images.
- Input conveniences: globbing, explicit format prefixes (`rgb:`), built-in images and patterns (`logo:`, `pattern:checkerboard`), stdin/stdout piping with `-`.
- Geometry strings (`800x600`, `800x600^`, `50%`, `+x+y` offsets) control size semantics; `^` fills, default fits inside.

formtools note: the operator-order dependence is a footgun; a GUI should build commands from an ordered list of steps and show the generated command.

## 3. Capability families (from the mogrify option summary)
Geometry (resize, adaptive-resize, crop, chop, extent, rotate, trim), color (colorspace, auto-level, auto-gamma, brightness-contrast, clahe, clut, channel ops), effects (blur family, sharpen, charcoal, canny edge detection, bilateral blur, threshold variants, connected components), annotation (annotate, caption, label), composition (append, border, composite, clip masks, alpha modes), metadata handling, auto-orient (EXIF rotation), stats and bench options. The option table is long; a UI should surface a curated subset (resize, crop, rotate, auto-orient, strip metadata, quality, format, watermark).

formtools note: auto-orient and strip-metadata should be on by default in any resize workflow, since they are the most common surprises.

## 4. montage specifics
Key options: `-geometry WxH+border`, `-tile`, `-label` (supports escapes such as the file name), `-frame`, background color. An `ashlar:` pseudo-format lays out images in irregular courses for quick contact sheets.

formtools note: contact-sheet generation is a small, popular feature; ship it as a dedicated tool.

## 5. identify specifics
Default line reports file name and frame, format, size, page geometry/offset, colorspace, timings; `-verbose` adds depth, channel statistics, rendering intent, gamma, chromaticity and more; `-format` templates extract fields (`%w`, `%h` and similar). Use `magick identify -list format` for the format table on the current build.

## 6. Formats
The official site lists a large format directory with read/write flags; actual support depends on delegates compiled into the build (libjpeg, libpng, libwebp, libheif, ghostscript and so on). `magick identify -list format` is the runtime truth.

## 7. Security policy (important for a user-facing app)
ImageMagick ships "open by default": everything allowed unless denied, and the last matching `policy.xml` rule wins. The docs recommend a tailored policy: restrict coders to web-safe formats (GIF, JPEG, PNG) for public-facing use, cap memory, disk, dimensions, frame counts and runtime, and constrain readable/writable paths. Untrusted input demands a restrictive policy; sandboxing (container) is the intended deployment.

formtools note: if formtools processes files from untrusted sources, bundle a restrictive policy.xml and set resource limits, or prefer libvips/native decoders for the hot path.

## 8. Performance posture
libvips' own published benchmark (a vendor-side comparison, so treat as indicative) shows `magick` 7.1.1 using about 1500 MB and roughly 7.7x slower than libvips on a crop/shrink/sharpen test; see libvips.md. ImageMagick's strength is breadth of operations and formats, not throughput.

## Sources

- https://imagemagick.org/command-line-tools/
- https://imagemagick.org/command-line-processing/
- https://imagemagick.org/mogrify/
- https://imagemagick.org/montage/
- https://imagemagick.org/identify/
- https://imagemagick.org/license/
- https://imagemagick.org/formats/
- https://imagemagick.org/security-policy/
- https://raw.githubusercontent.com/wiki/libvips/libvips/Speed-and-memory-use.md (benchmark, vendor of a competitor)
