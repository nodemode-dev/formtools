# Encyclopedia gap register

What the v0.1.0 research could not verify, grouped by section. Each row is closed by a sourced fix in a later research pass, or stays open with its reason. Build phases that depend on a gap list it in `DEV_PLAN.md`.

## Blocked by the sourcing rules

| Gap | Why it is open | Needed by |
| --- | --- | --- |
| XnView MP full Adjust, Filter and Effect parameter lists, the complete batch action parameters, the current shortcut table | XnSoft's only official user guide is a wiki on xnview.com; open-edit wikis are excluded | Viewer, batch image tools |
| XnConvert per-action GUI parameters (many marked "(inferred)" from NConvert flags), the naming-token list, the preset file format | Same xnview.com wiki | Batch image tools |
| XnShell menu entries, XnRetro and XnSketch effect names | No official page lists them; the author says no changelog exists | Context-menu integration |
| gThumb feature page | Wiki | Viewer comparison only |

Decision needed: whether vendor-run official wikis (xnview.com, wiki.videolan.org) count as the vendor's own documentation. The VideoLAN docs were already used on that basis.

## Unverified facts

| Section | Gap |
| --- | --- |
| xn | XnResize on Linux (two vendor pages disagree); hot-folder watch method; whether a curves editor exists; HEIC and AVIF write (the format table says read-only, the product pages say writable) |
| powertoys | Image Resizer default presets and input formats; Mouse Without Borders protocol and ports; Workspaces storage location; Shortcut Guide internals; the engine behind ZoomIt's OCR snip; Screen Ruler Ctrl+1 to 4 mapping; release years before v0.99. The macOS and Linux mapping notes are the researchers' own analysis |
| macos-preview | Adjust Color slider list and ranges (older third-party source only); full hidden export format list; qlmanage -x and -i flags; Visual Look Up inside Preview; macOS 27 Preview changes are single source |
| image-viewers | Many matrix cells are "n/d" (not documented), not confirmed absences; Eye of GNOME, gThumb and Loupe pages are thin (GNOME GitLab did not load); speed claims are vendor numbers |
| media-players | VLC A-B loop key, backward frame step, stock Convert profiles, hardware decoding APIs, media library, Lua extension API; PotPlayer licence; mpv shader, scaler and HDR options; "?" cells in the matrix |
| converters | HandBrake GUI tab controls (derived from the CLI flags, marked "CLI-derived"); MP3, MPEG-2 and VP9 patent status; AAC bundling terms; libvips auxiliary tools; HLS muxer details |
| 3d | Rows marked "(gk)" in `3d-format-matrix.md` (OBJ, STL, PLY, 3DS, STEP, Alembic licence) rest on general knowledge and must be re-sourced; `blender-headless.md` is mostly general knowledge (manual pages returned no text); usdzip options; full `gltf-transform optimize` step list; CloudCompare formats and CLI; MeshLab glTF and 3MF save conflict |
| file-utilities | PeaZip site (GitHub only); Windows font docs; macOS shasum man page; Finder batch rename help; XML viewers not researched; Keka and Advanced Renamer licence and price; Bulk Rename Utility CLI; a few entries lack their formtools note line |
| engines | Access Advance (HEVC) and Sisvel AV1 pool pages did not load; imageio-ffmpeg bundled binary; pillow-avif-plugin and pillow-jxl-plugin licences; imagecodecs and OpenImageIO wheel notices |

## Family-level finding (outside formtools)

The engine research found that the pillow-heif binary wheels carry a GPLv2 licence file because they bundle x265. formvis's registry notes list pillow-heif among its frozen engine's wheels. This is reported to the owner, not acted on here.
