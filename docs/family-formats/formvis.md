# formvis project formats: reader spec for formtools

Source: formvis 1.98.7, Apache-2.0, read as untrusted data (grep, read and `git log` only; nothing was run). Paths are relative to the formvis repository root; `path:line` cites the version read. Where the source disagrees with the project's own wiki, the code is followed and the disagreement is noted.

## 1. Summary

| Item | Finding |
| --- | --- |
| Native project extension | `.fvd` since 1.87.0 (`CHANGELOG.md:1235`, `backend/app/routers/projects.py:17-19`) |
| Older native extensions, still read | `.fmv` (1.50.5 to 1.86.x), `.formvis` (before 0.90.0), and `.sny`, `.sonny` (before the 1.50.5 rename) (`CHANGELOG.md:5`, `backend/app/core/legacy.py:11`) |
| Container | Plain ZIP (not zstd, not binary): `manifest.json` plus an `images/` folder (`backend/app/services/project_format.py:231-245`) |
| Magic bytes | ZIP only: `50 4B 03 04` at offset 0; no formvis-specific magic or `mimetype` entry. First entry written is `manifest.json` (`project_format.py:238`) |
| Format id and version | manifest `format` = `com.nodemode.formvis`, `version` = integer `1` (`frontend/src/io/project-io.ts:24-25`); readers reject any other version (`project_format.py:50-52`) |
| Embedded preview | Yes: `thumbnail.png`, PNG, at most 512 px on the long side, since 1.87.0. No larger flattened composite is stored |
| Colour | manifest `colorSpace` plus optional `profile {name, icc}` with base64 ICC bytes (`project-io.ts:265`, `frontend/src/engine/types.ts:200-201`) |
| Other layered formats it handles | `.canvasor` and `.comp` (read only, same layout), `.ora` (read and write, third-party spec) |

The wiki page `.docs/wiki/Project-Format.md:3` still says projects are `.fmv`; it predates 1.87.0. The code and changelog win.

## 2. The native project: `.fvd` (and `.fmv`, `.formvis`)

### 2.1 Container layout

The three native extensions share one layout; only the extension differs. Written by `write_zip` (`project_format.py:231-245`):

| Zip entry | Compression | Content | Source |
| --- | --- | --- | --- |
| `manifest.json` | deflate | UTF-8 JSON, indented 2 spaces; limit 4 MiB | `project_format.py:238`, `backend/app/core/config.py:41` |
| `thumbnail.png` | stored | PNG, longest side at most 512 px, at most 4 MiB; written only if the supplied bytes start with the PNG signature | `project_format.py:15,239-240`, `frontend/src/app.ts:816-829` |
| `QuickLook/Thumbnail.png` | stored | Byte-identical copy of the thumbnail, for the macOS system preview | `project_format.py:16,241-242` |
| `QuickLook/Preview.png` | stored | Byte-identical copy of the thumbnail (so it is not larger) | `project_format.py:16,241-242` |
| `images/<name>` | stored | Every pixel asset, flat (no subfolders) | `project_format.py:243-244` |

A project may also arrive as a folder or have everything inside one root folder (`write_zip` takes a `root`). The reader accepts `manifest.json` at the archive root or exactly one folder down, ignores `__MACOSX` paths, and expects `images/` beside it (`project_format.py:107-141`). Asset names must match `[A-Za-z0-9][A-Za-z0-9._-]{0,199}` with no `..` (`project_format.py:14,38-39`). Each asset is capped at 512 MiB (`config.py:42`).

### 2.2 Version and history of the format

| Fact | Evidence |
| --- | --- |
| The manifest `version` has always been 1; later features were added as optional keys, and old readers ignore keys they do not know. No migration code exists for the manifest | `project-io.ts:25`, `project_format.py:13`, `.docs/wiki/Project-Format.md:42-44` |
| Accepted ids: `com.nodemode.formvis`, the former `com.nodemode.sonny` (legacy.py), and `com.nodemode.canvasor`, each at version 1 only | `project_format.py:9-13`, `backend/app/core/legacy.py:13` |
| Rename to formvis, projects become `.fmv` | commit a42fcb2c, 1.50.5 |
| `.fvd` introduced with thumbnails inside; `.fmv` and `.formvis` still open; saving an old file writes a `.fvd` in its place | commit 05b1dd2c, 1.87.0 (`CHANGELOG.md:1231-1235`) |
| Stand-in thumbnail for projects saved before thumbnails | 1.87.1, `project_format.py:207-223` |
| Format validation and writing rewritten from behaviour specs | commit c78e4d01, 1.67.7 |
| `.comp` version support widened to 1 to 15 | commit cb7e2547 (`project_format.py:25`) |
| Additive manifest keys by release: alphas 1.65.1, patterns 1.65.2, link ids 1.65.3, fill layers 1.66.0, giant tiled layers 1.62.8, 16-bit and 32-bit layer data 1.53.6 and 1.53.9, ICC profile 1.53.5, colour modes 1.50.2 | `CHANGELOG.md` (headings at lines 2177, 2077, 2337, 3132, 3163, 3173, 3476) |

The git history reached by `git log` has about 14 commits touching `project_format.py`, from the 0.1.0 backend onward.

### 2.3 Manifest schema

Top-level keys (writer: `project-io.ts:265-267`; reader: `project-io.ts:406-619`). Keys marked optional are omitted when empty or default.

| Key | Meaning | Default when absent |
| --- | --- | --- |
| `format`, `version` | Identity | required |
| `width`, `height` | Document size in pixels, integers 1 to 30000 (up to 300000 when a layer is tiled) | required (`project_format.py:53-57`, `config.py:13`) |
| `resolution` | Pixels per inch | 72 |
| `documentID` | Document id | none |
| `colorSpace` | Profile name, or `sRGB` | `sRGB` |
| `profile` | `{name, icc}`: ICC bytes as base64 text (counts against the 4 MiB manifest cap) | none means sRGB |
| `depth` | Bits per channel: 8, 16 or 32 | 8 (written only when set) |
| `mode` | `grayscale`, `bitmap`, `indexed`, `cmyk`, `lab`, `duotone`, `multichannel`; RGB is not written | RGB (`project-io.ts:552`) |
| `palette` | Indexed colours, up to 256 triples `[r,g,b]` | none |
| `duotone`, `multichannel` | Duotone ink data; multichannel channel records `{name,color,solidity,file}` with files `mchan_<i>.png` | none |
| `layers` | Bottom-to-top array of layer records (limit 10000) | required |
| `activeLayerID`, `collapsedFolders` | Panel state | none |
| `guides`, `slices`, `notes`, `boxes`, `counts`, `countGroups`, `measureScale`, `measurements`, `pixelAspect`, `globalLight` | Document-level annotations | none |
| `comps`, `activeComp` | Layer comps | none |
| `stylePresets`, `characterStyles`, `paragraphStyles` | Style libraries | none |
| `variables`, `dataSets`, `activeDataSet` | Variables for data-driven graphics | none |
| `meta` | File Info (title, keywords, camera and so on) | none |
| `alphas` | Alpha channels: `{id,name,file,color?,opacity?,indicates?,spot?}`, file is `alpha-<n>.png`, a grayscale PNG the canvas size | none |
| `patterns` | Non-built-in patterns used by styles: `{id,name,file}`, file `pattern-<n>.png` | none |
| `depthMap` | `{file: depth-map.bin, width, height, key}`, raw bytes | none |
| `selection` | `{file: selection.png}` live selection | none |
| `paths`, `activePath`, `timeline`, `glb`, `fonts` | Vector paths, video timeline, kept 3D models, font families used | none |
| `history` | `{file: history.json, steps, bytes}`; undo states kept in the zip | none |

Layer record keys (`project-io.ts:149-255`):

| Area | Keys |
| --- | --- |
| Identity | `id` (unique string), `name`, `isVisible`, `parentID` (must name a group), `isGroup`, `isolate`, `artboard {x,y,w,h,background}` on top-level groups, `label`, `role`, `reference`, `locks`, `linkID`, `generation` (AI prompt data), `frame` |
| Geometry | `transform {origin:[x,y], size:[w,h], rotation, flipX, flipY, sampling}` where sampling is `Nearest`, `Smooth` or `High quality`. The layer's PNG keeps its own pixel size; `size` is the displayed size |
| Pixels | `imageFile` (`images/<id>.png`), absent for folders and adjustment layers; a group may not carry one (`project_format.py:77-78`) |
| Opacity and blend | `opacity` 0 to 1 (omitted when 1), `fill`, `blendMode` (label, omitted when Normal), `blendIf`, `knockout`, `blendChannels`, `blendClipped`, `transparencyShapes`, `blendInterior`, `layerMaskHides` |
| Masks | `maskFile` (`<id>.mask.png`, grayscale, white shows; alpha in the formvis raster is the grey value), `maskEnabled`, `maskLinked` (written only when false), `maskPlacement` (a transform), `maskDensity`, `maskFeather`; `vectorMask {enabled,linked,inverted,subpaths,density?,feather?}`; `maskSourceID` (clipping to another layer, never a group) |
| Effects | `effects`: `dropShadow`, `outerGlow`, `stroke`, `innerShadow`, `innerGlow`, `colorOverlay`, `gradientOverlay`, `patternOverlay`, `satin`, `bevel`, with `extra` for further instances (`engine/types.ts:326-331`) |
| Text | `text` object: `content`, `family`, `size`, `color {r,g,b}`, `align`, `bold`, `italic`, `box`, `direction`, `antialias`, runs and paragraph data (`engine/types.ts:463-481`, `engine/text.ts:868-880`). The text is already rasterised into `imageFile`; `rendered` is stripped on save (`project-io.ts:238`) |
| Adjustment | `adjustment`: free-form object with `kind` (`Hue/Saturation`, `Levels`, `Curves`, `Exposure`, `Gradient Map`, `Grain`, `Filter`, plus parametric kinds). No pixels; `maskFile` may exist (`project-io.ts:28,252`) |
| Shape | `shape` (kept verbatim), `vector {fill,stroke,gradient,pattern,live,origin,subpaths}`, `extrude3d`; pixels are in `imageFile` |
| Fill layers | `fillContent {kind: solid or gradient or pattern, ...}` with pixels in `imageFile` |
| Smart objects | `smartSourceFile` (`<id>.source.png`, the flattened source), `smartOriginal {file,name,mime}` (original bytes as `<id>.original.<ext>`), `smartStack {mode,files}`, `smart {filters,warp,warpAt,deform,filterMaskEnabled,link}`, `smartFilterMaskFile`, and `smartNested`: a complete nested manifest whose assets are stored with the prefix `<id>.n.` (`project-io.ts:184-213`) |
| Video layers | `video {name, frames[], originals[], interpret?}` with PNG frames `<id>.vframe<i>.png` |
| Deep pixels | `deepFile` (`<id>.deep16`: little-endian uint16 RGBA; `<id>.deep32`: float32 RGBA, straight alpha) with `deepWidth`, `deepHeight`; `inkFile` (`<id>.cmyk32` five floats per pixel, `<id>.lab32` four floats) with `inkWidth`, `inkHeight`; `precision` (`project-io.ts:161-165`, `437-440`, `561-565`). The 8-bit `imageFile` PNG is still present as the display rendition |
| Giant layers | `tiled {width,height,base}`: `imageFile` is one huge PNG written band by band; only the formvis engine can decode it past 268 megapixels (`project-io.ts:153-158,431`) |

Layer types are therefore not an enum: classify by presence of keys. Group (`isGroup`), adjustment (`adjustment`), text (`text`), shape or vector (`shape` or `vector`), fill (`fillContent`), smart object (`smartSourceFile`), video (`video`), otherwise pixel layer.

### 2.4 Blend modes

`blendMode` holds a display label, matched exactly (`engine/types.ts:46-47`). The 27 labels of `BLEND_MODES` are: Normal, Dissolve, Darken, Multiply, Color Burn, Linear Burn, Darker Color, Lighten, Screen, Color Dodge, Linear Dodge (Add), Lighter Color, Overlay, Soft Light, Hard Light, Vivid Light, Linear Light, Pin Light, Hard Mix, Difference, Exclusion, Subtract, Divide, Hue, Saturation, Color, Luminosity (`engine/types.ts:25-33`). Four formvis-only labels follow: Negation, Reflect, Glow, Xor (`types.ts:36-39`). An unknown label reads as Normal.

### 2.5 Pixel data

| Asset | Encoding |
| --- | --- |
| Layer, mask, alpha, selection, pattern, smart source, video frame | PNG produced by the browser canvas (`toBlob`), 8-bit RGBA, straight (non-premultiplied) alpha as canvas PNG; masks and alphas are grayscale-looking PNGs |
| `*.deep16`, `*.deep32`, `*.cmyk32`, `*.lab32`, `depth-map.bin` | Raw little-endian typed arrays with no header |
| `history.json` | JSON `{names, states}`; the states are nested manifests with their own `.`-named assets (`project-io.ts:316`) |

### 2.6 Read and write code paths

| Path | Role |
| --- | --- |
| `frontend/src/io/project-io.ts:135-320` (`serialize`) | Builds the manifest and the file list |
| `frontend/src/io/project-io.ts:406-619` (`deserialize`) | Reads a manifest back, tolerant of missing keys |
| `frontend/src/io/api.ts:748-799` | Frontend calls: save, saveTo, thumbnail, package (multipart upload of manifest, files, thumbnail) |
| `frontend/src/app.ts:816-829` (`thumbnailOf`), `1388-1537` | Makes the thumbnail and invokes save, Save As, package (`${name}.fvd`) |
| `backend/app/routers/projects.py` | Library routes, `save_to` (line 153), `thumbnail` (186), `package` (296), `import_project` (329); `SUFFIXES` at line 20 |
| `backend/app/services/project_format.py` | Validation, zip read and write, thumbnail read |
| `backend/app/core/legacy.py`, `frontend/src/io/legacy.ts` | The only places the former name `sonny` and its `.sny`/`.sonny` extensions remain |

The backend validates before anything is trusted: layer ids unique, asset names safe and present (`imageFile`, `maskFile`, `smartSourceFile`), parents are groups, no folder or clipping cycles, depth at most 64 and clip chain at most 256 (`project_format.py:42-104`, `config.py:38-40`).

### 2.7 Thumbnail details

| Question | Answer |
| --- | --- |
| Name and format | `thumbnail.png` at the archive root, PNG |
| Size | Scaled so the longest side is at most 512 px and never upscaled; aspect kept (`app.ts:821-822`) |
| What it shows | The flattened document composite as formvis draws it (`engine.flattenedOf`), including adjustments, masks and styles |
| Optional | Yes. Absent in projects saved before 1.87.0, or when drawing it failed (`app.ts:829`) |
| Reader limit | formvis ignores a `thumbnail.png` larger than 4 MiB (`project_format.py:200`) |
| Fallback | For old projects formvis shrinks the first `imageFile` in manifest order (the bottom picture layer) to 512 px (`project_format.py:207-223`); this ignores transform, masks and blending, so it is only a stand-in |
| Colour profile of the thumbnail | Not verified in the source read; treat it as sRGB-like display pixels |

## 3. Read-only siblings

| Format | Extension | Notes |
| --- | --- | --- |
| NodeMode canvasor | `.canvasor` (zip) | Same manifest and `images/` layout, `format` = `com.nodemode.canvasor`, version 1 (`project_format.py:12-13`). Saved to `.fvd` on resave. The separate `*.canvasor.json` is not read (`.docs/wiki/Project-Format.md:3`) |
| `.comp` | `.comp`, `.comp.zip`, or the package folder | Recognised by a reverse-DNS `format` ending in `.project` at versions 1 to 15; layers may be OpenEXR `<id>.exr`; formvis never writes it (`project_format.py:17-25,144-177`) |
| Pre-rename | `.sny`, `.sonny` | `format` = `com.nodemode.sonny` (`legacy.py:9-13`) |

These carry no `thumbnail.png` guarantee. Treat them like `.fvd` without the thumbnail fast path.

## 4. OpenRaster `.ora` (interchange, third-party spec)

formvis reads and writes OpenRaster (`frontend/src/io/ora.ts:5-9`; added in 1.51.7). It is a third-party interchange format, not formvis's own. Written layout (`ora.ts:52-56`):

| Entry | Content |
| --- | --- |
| `mimetype` | First entry, uncompressed, text `image/openraster` |
| `stack.xml` | `<image version="0.0.5" w h xres yres>` with a `<stack isolation="isolate">`; layers topmost first, groups as nested `<stack>`; attributes `name`, `opacity`, `visibility`, `composite-op`, `x`, `y`, `src`, `edit-locked`, `alpha-locked` |
| `data/layer<n>.png` | One PNG per layer; non-plain layers (text, shapes, smart objects, masked or styled, rotated) are pre-rendered at document size |
| `mergedimage.png` | Full-size flattened composite |
| `Thumbnails/thumbnail.png` | Composite scaled to at most 256 px |

The writer stores everything uncompressed (`frontend/src/io/zip.ts:1-27`). Blend mapping written: `svg:src-over`, `svg:multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `color`, `luminosity`, `hue`, `saturation`, and `svg:plus` for Linear Dodge; other modes are written as Normal (`ora.ts:11-16,35`). Adjustment layers are baked into pictures (`ora.ts:33-34`). Reading accepts more operators (`ora.ts:18`) and rejects sizes above 30000 px (`ora.ts:67`). Magic: ZIP signature then `mimetype` at offset 30 (the packaged shared-mime rule, `packaging/linux/ai.nodemode.formvis.xml:13-16`).

## 5. Cheapest correct extraction (no formvis)

| Need | `.fvd`, `.fmv`, `.formvis` | `.canvasor`, `.comp` | `.ora` |
| --- | --- | --- | --- |
| Thumbnail | Read `thumbnail.png` from the zip central directory and return it (at most 512 px). If absent, the fallback below | No embedded thumbnail promised: use the layer fallback | `Thumbnails/thumbnail.png` (at most 256 px), else downscale `mergedimage.png` |
| Full flattened preview | Not stored. Larger than 512 px needs real compositing (see 5.1) | Same | `mergedimage.png`, no compositing |
| Metadata (size, layer count, names, colour mode) | Read `manifest.json` only: `width`, `height`, `layers[]` (count and `name`; `isGroup` marks folders), `mode`, `depth`, `colorSpace`, `resolution` | Same keys | `stack.xml`: `w`, `h`, `xres`, count `<layer>`, `name` attributes; mode is always RGB 8-bit |

### 5.1 If a full preview from a project is required

Prefer the 512 px thumbnail and upscale only for display. If a true full-size flatten is needed, composite in this order, bottom to top over the `layers` array:

1. Skip layers with `isVisible` false and everything inside a hidden folder.
2. Draw each layer's `imageFile` PNG at `transform.origin` with `transform.size`, applying rotation about the box and `flipX`/`flipY`.
3. Multiply by the layer mask (`maskFile` grey as alpha; `maskEnabled` false means no mask), then `opacity` and `fill`.
4. Apply `blendMode` using the PSD-style formulas for the 27 labels plus formvis's four extras; layer styles (`effects`) and `blendIf` also change the result, and are expensive to reproduce.
5. Folders: composite their children first; honour `isolate`.
6. Adjustment layers (no pixels) change everything below them: a reader without the filter code cannot match formvis. Fall back to the thumbnail.
7. Only 8-bit PNG is needed for sRGB display. 16-bit or 32-bit, CMYK, Lab and tiled layers also carry the PNG rendition, but its exactness is not guaranteed.

Exact parity needs the engine's CPU blend and effects code, so a preview-only reader should not attempt it.

## 6. Reader algorithm

1. Identify the file by extension (`.fvd`, `.fmv`, `.formvis`, `.canvasor`, `.comp`, `.ora`) and confirm the first four bytes are `50 4B 03 04`. For `.ora`, also confirm the first entry is `mimetype` containing `image/openraster`.
2. Open the ZIP from its central directory (end-of-central-directory record, at most the last 65557 bytes). Support stored and deflate entries only; formvis writes nothing else. Skip any path containing `__MACOSX`.
3. For a native or sibling project, find `manifest.json` at the root or one folder down (that folder is the root for the other paths).
4. Refuse a manifest above 4 MiB. Parse it as JSON.
5. Check `format` and `version`: accept `com.nodemode.formvis`, `com.nodemode.sonny` or `com.nodemode.canvasor` at version 1, or a reverse-DNS id ending in `.project` at versions 1 to 15. Otherwise report an unsupported version and show no preview rather than guessing.
6. Read metadata directly from the manifest: `width`, `height`, `resolution`, `mode` (default RGB), `depth` (default 8), `colorSpace`, and `layers`. Count all records for the layer total; count non-`isGroup` records if only content layers are wanted. Preserve the array order (bottom to top) and show it reversed for a panel.
7. For a thumbnail, look for `thumbnail.png` at the same root; accept it only if it starts with the PNG signature and is at most 4 MiB. Return it as is.
8. If no thumbnail exists, try `QuickLook/Preview.png`, then the fallback: take the first layer with an `imageFile` and a present asset, decode it and downscale to at most 512 px, and mark the result as approximate.
9. For `.ora`, read `Thumbnails/thumbnail.png` for a thumbnail and `mergedimage.png` for the preview; read `stack.xml` for metadata.
10. Never extract assets by their zip name alone: accept only names matching the safe pattern, with no subfolders, and cap any single entry at 512 MiB before inflating.
11. Treat every field as optional and ignore unknown keys; never write to the file.

## 7. OS registrations by formvis (avoid conflicts)

| Platform | Registration | Source |
| --- | --- | --- |
| Tauri bundle id | `ai.nodemode.formvis` | `src-tauri/tauri.conf.json:5` |
| All platforms (Tauri `fileAssociations`) | Extensions `fvd`, `fmv`, `formvis`; name "formvis Project"; role Editor; mimeType `application/x-formvis` | `tauri.conf.json:46` |
| All platforms | A second association "Picture" (role Editor, no MIME) for `psd`, `psb`, `png`, `jpg`, `jpeg`, `tif`, `tiff`, `webp`, `exr`, `ora` | `tauri.conf.json:47` |
| Linux shared-mime | `application/x-formvis` with globs `*.fvd`, `*.fmv`, `*.formvis`; also `image/openraster` (glob `*.ora`, priority-60 magic), `image/x-psb`, `image/x-exr` | `packaging/linux/ai.nodemode.formvis.xml:3-33` |
| Linux desktop entry | `MimeType=application/x-formvis;image/vnd.adobe.photoshop;image/x-psd;image/x-psb;image/openraster;image/png;image/jpeg;image/tiff;image/webp;image/x-exr;` | `packaging/linux/ai.nodemode.formvis.desktop:13` |
| Windows MSIX | `FileTypeAssociation Name="formvisproject"` for `.fvd`, `.fmv`, `.formvis` | `packaging/msix/AppxManifest.xml:26-34` |
| macOS | No Info.plist, UTI or exported type declaration in the repository; Tauri generates the document types from the `fileAssociations` above at bundle time. The resulting UTI was not inspected (no built app) | grep of `src-tauri`, `packaging` found none |

Advice for formtools: do not claim `fvd`, `fmv`, `formvis`, or the MIME `application/x-formvis`. Register thumbnailer and preview handlers (not open-with defaults) for those extensions, and avoid taking over `.ora`, `.psd`, `.psb` and the generic image types. formtools should use its own MIME and bundle ids, and register as an alternate viewer only. The `.canvasor` and `.comp` extensions are not registered by formvis (they are only opened from within it).

## 8. Licence implications

| Item | Note |
| --- | --- |
| formvis | Apache-2.0 (`LICENSE`, `README.md:151`), copyright 2026 NodeAgentc, Inc. per the README; `src-tauri/tauri.conf.json` says nodemode-ai |
| Reading the format | The format is documented publicly (`.docs/wiki/Project-Format.md`) and described by the code. Implementing an independent reader from this spec is permitted. Do not copy formvis source into formtools unless its Apache-2.0 notice, a copy of the licence and change notices are carried over (`NOTICE.md`) |
| OpenRaster | Third-party public specification (`ora.ts:5-9` says it is written and read from the public specification). Licence terms of that specification were not verified from this repository; check openraster.org before citing it. Pure container reading is low risk |
| Other third-party parts | PNG, ZIP and ICC are open standards. formvis's own ZIP reader and writer are small and original (`zip.ts`). Its `.af` reader is MIT and from other authors (`NOTICE.md`), and not relevant to the Form formats |
| Trademarks | `NOTICE.md` disclaims affiliation with Adobe; the same caution applies to PSD names |

## 9. Sources

Files read, relative to the formvis repository root:

- `backend/app/services/project_format.py`
- `backend/app/core/legacy.py`, `backend/app/core/config.py`
- `backend/app/routers/projects.py`, `backend/app/routers/io.py`
- `frontend/src/io/project-io.ts`, `frontend/src/io/ora.ts`, `frontend/src/io/zip.ts`, `frontend/src/io/legacy.ts`, `frontend/src/io/api.ts`
- `frontend/src/app.ts`, `frontend/src/ui/home-files.ts`
- `frontend/src/engine/types.ts`, `frontend/src/engine/text.ts`
- `.docs/wiki/Project-Format.md`
- `CHANGELOG.md`, `README.md`, `NOTICE.md`, `LICENSE`
- `src-tauri/tauri.conf.json`, `src-tauri/tauri.macos.conf.json`
- `packaging/linux/ai.nodemode.formvis.xml`, `packaging/linux/ai.nodemode.formvis.desktop`, `packaging/msix/AppxManifest.xml`
- `git log` (read-only) for `backend/app/services/project_format.py`, `.docs/wiki/Project-Format.md`, and the repository head
