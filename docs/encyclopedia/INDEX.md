# formtools encyclopedia

How the media and file utilities formtools stands beside actually work: every feature, how it behaves, which formats it handles, and what a clean-room reimplementation needs. This is research for an independent build. Nothing here is copied vendor text: every page is paraphrased, and every page ends with the sources it was written from.

Research stage: v0.1.0, 2026-11-02. 130 pages in 9 sections. Open gaps are listed in `GAPS.md`.

## How to read a page

- Each feature entry says what the feature does, how it works (the UI flow, options and behaviour), and ends with a one-line **formtools note** naming what formtools needs to match or beat it.
- Claims backed by only one source are marked "(single source)". Anything the researcher could not verify is said plainly, never guessed.
- Sources follow the sourcing rules: official docs, vendor sites, official repositories, changelogs and established journalism. Open-edit wikis, AI summaries, forums and content farms are excluded. The one exception: VideoLAN's own documentation pages are used as that vendor's official docs.

## Sections

| Section | Pages | Covers |
| --- | --- | --- |
| [xn/](xn/) | 21 | XnView MP (browser, viewer, editing, batch, metadata, formats, settings), XnConvert, NConvert, XnResize, XnView Classic, XnShell, XnRetro, XnSketch, mobile apps, the GFL SDK, the full XnSoft product line |
| [powertoys/](powertoys/) | 39 | All 31 current Microsoft PowerToys utilities (v0.102.3001.0), the seven mouse utilities as separate pages, and retired ones, plus the index |
| [macos-preview/](macos-preview/) | 8 | Apple Preview (images, Markup, PDF, export formats, shortcuts), Quick Look and its extension architecture, Finder Quick Actions |
| [image-viewers/](image-viewers/) | 15 | IrfanView, FastStone, ImageGlass, nomacs, qView, Windows Photos, Apple Photos, gThumb, Eye of GNOME, Loupe, Gwenview, digiKam, Honeyview and BandiView, a feature matrix, viewer best practices |
| [media-players/](media-players/) | 11 | VLC in depth (playback, sync, filters, convert and stream, interfaces), mpv, IINA, MPC-HC and MPC-BE, PotPlayer, QuickTime Player and Windows Media Player, a feature matrix |
| [converters/](converters/) | 10 | HandBrake and HandBrakeCLI, Shutter Encoder, FFmpeg as an engine, ImageMagick, libvips, fre:ac and Permute, GIF tools, a codec and container primer, a feature matrix |
| [3d/](3d/) | 13 | F3D, Microsoft 3D Viewer (retired), Reality Converter and USDZ, FBX Review and SDK, assimp, MeshLab, glTF viewers and the three.js editor, glTF-Transform, OpenUSD tools, Blender headless, CAD Assistant and Open CASCADE, point clouds and Gaussian splats, a 3D format matrix |
| [file-utilities/](file-utilities/) | 10 | Archivers, hashing, duplicate finders, bulk renamers, font viewers, text, hex and data viewers, disk usage, capture and clipboard, light PDF utilities, the engine landscape |
| [engines/](engines/) | 3 | The licence matrix for every candidate engine library, codec patent notes, and the recommended cleared stack |

## Where to start

- Building the viewer: `xn/xnview-mp-viewer.md`, `image-viewers/viewer-feature-matrix.md`, `image-viewers/viewer-best-practices.md`, `macos-preview/quick-look.md`, `powertoys/peek.md`.
- Building batch image tools: `xn/xnconvert-actions.md`, `xn/xnconvert-output-and-naming.md`, `xn/nconvert-cli.md`, `xn/xnresize.md`, `powertoys/image-resizer.md`, `powertoys/power-rename.md`.
- Building the player: `media-players/player-feature-matrix.md`, `media-players/vlc-playback-and-sync.md`, `media-players/mpv.md`.
- Building the 3D viewer: `3d/f3d.md`, `3d/3d-format-matrix.md`, `3d/gltf-transform.md`, `3d/assimp.md`.
- Building desktop utilities: `powertoys/powertoys-index.md`, then one page per utility.
- Before adding any dependency: `engines/engine-licensing-matrix.md` and `engines/recommended-stack.md`.

## Trademarks

Product names belong to their owners and appear only to describe what those products do. formtools is not affiliated with or endorsed by any of them. See `NOTICE.md` at the repository root.
