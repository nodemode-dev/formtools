# Viewer feature matrix

Legend: yes = documented in an official source fetched; no = documented as absent or requested but not shipped; n/d = not documented in the sources fetched (not the same as absent); part = partial, see the viewer's file. Cells come only from the per-viewer files in this folder, so read those for caveats and "(single source)" notes. XnView MP is covered by another researcher: see xn/.

## Table 1: identity, extensibility, viewing

| Viewer | License | Platforms | Version seen | Plugins or SDK | Archive or comic | Compare | Slideshow |
|---|---|---|---|---|---|---|---|
| IrfanView | freeware, non-commercial free | Windows | 4.76 | yes (DLL plugins) | n/d | n/d | yes (MP4, EXE export) |
| FastStone Image Viewer | free personal, paid commercial | Windows | 8.5 | n/d | no (MaxView: yes) | yes (up to 4) | yes (150+ transitions, music) |
| ImageGlass | GPLv3 core, Pro tier | Windows, macOS, Linux (X11) | 10.0.6.906 | yes (SDK, codec ABI) | no (open request) | n/d | yes (random interval) |
| nomacs | GPL-3.0 | Windows, Linux, macOS, BSD, others | 3.22.4 | yes (OpenCV plugins) | part (ZIP read) | yes (synced viewers) | yes (fade) |
| qView | GPL-3.0 | Windows, macOS, Linux | 7.1 | n/d | no (open request) | no | n/d |
| Windows Photos | proprietary | Windows | 2026.11070 (preview) | no | n/d | yes (multi-view) | yes |
| Apple Photos | proprietary | Apple OSes | n/d | no | n/d | n/d | n/d |
| gThumb | GPL (family n/d) | Linux | n/d | n/d | n/d | n/d | yes |
| Eye of GNOME | n/d | Linux | n/d | n/d | n/d | n/d | n/d |
| Loupe | GPL-3.0-or-later | Linux | 51.rc | no (glycin loaders) | n/d | n/d | n/d |
| Gwenview | GPL-2.0-or-later | Linux | 26.08.2 | n/d | n/d | yes (panes, synced zoom) | yes (full-screen) |
| digiKam (viewer) | n/d | n/d | 9.2.0 manual | yes (metadata editor plugin) | n/d | yes (Light Table) | n/d |
| Honeyview | freeware, EOL | Windows | 5.53 | n/d | yes | n/d | n/d |
| BandiView | shareware plus paid Pro | Windows 64-bit | 8.03 | n/d | yes (double-page, webtoon) | n/d | n/d |
| XnView MP | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ |

## Table 2: image handling

| Viewer | Color management | HDR | Animated | RAW | Lossless JPEG | Batch | Metadata | Basic edits | AI edits |
|---|---|---|---|---|---|---|---|---|---|
| IrfanView | optional (settings, LCMS plugin) | n/d | yes (GIF, animated AVIF) | yes (plugin) | yes (rotate, crop, IPTC) | yes (deep, placeholders) | yes (IPTC, EXIF dates) | yes | no |
| FastStone Image Viewer | yes (ICC, monitor) | n/d | n/d | yes | n/d (MaxView: yes) | yes (+PDF out) | n/d | yes | no |
| ImageGlass | yes | yes (tone mapper in Pro) | yes (GIF, WebP, SVG, frame step) | yes | part (lossless compression tool) | n/d | part (ExifGlass companion) | yes | no |
| nomacs | yes (3.22+) | n/d | part (GIF; APNG open request) | yes (build option) | n/d | n/d | yes (Exiv2) | yes | no |
| qView | yes (6.0+) | n/d | n/d | yes (6.0+) | n/d | no | part (info dialog) | n/d | no |
| Windows Photos | n/d | yes | n/d (motion photos yes) | n/d | n/d | n/d | yes (info panel, histogram) | yes | yes |
| Apple Photos | n/d | n/d | n/d | n/d | n/d | part (copy edits) | n/d | yes | yes (Clean Up) |
| gThumb | part (PNG profiles) | n/d | n/d | yes | yes | yes (rename, convert, scripts) | yes (EXIF, IPTC, XMP edit) | yes | no |
| Eye of GNOME | n/d | n/d | n/d | n/d | n/d | n/d | n/d | n/d | no |
| Loupe | yes (ICC, CICP info, CMYK) | n/d | yes | part (first loader) | yes (orientation tag only) | no | yes (properties) | part (rotate, crop, flip) | no |
| Gwenview | yes (PNG, JPEG profiles) | n/d | yes | n/d | yes (handbook intro) | n/d | part (EXIF comments) | yes (+annotations) | no |
| digiKam (viewer) | yes | n/d | n/d | yes (LibRaw) | n/d | yes (batch queue) | yes | n/d | n/d |
| Honeyview | n/d | no (EOL) | yes | yes | n/d | yes (slow) | n/d | n/d | no |
| BandiView | yes (ICM multi-monitor) | yes (Pro; SDR in free) | yes (incl. animated AVIF) | yes | n/d | yes (Pro faster) | part (EXIF, SD prompts) | n/d | no |
| XnView MP | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ | see xn/ |

## Reading the matrix for formtools

- Gaps no free viewer fills together: HDR plus color management plus RAW plus archive plus lossless rotate in one cross-platform app. ImageGlass 10 comes closest on platforms and HDR, BandiView on archives and HDR (Windows only).
- AI editing is only present in the two OS vendor apps (Windows Photos, Apple Photos) among the viewers covered.
- Many n/d cells are source limits, not product limits: GNOME GitLab, KDE handbook subpages and FastStone's history page failed to load.

## Sources

Per-viewer files in this folder (each lists its own fetched URLs): irfanview.md, faststone.md, imageglass.md, nomacs.md, qview.md, windows-photos.md, apple-photos.md, gthumb.md, eye-of-gnome.md, loupe.md, gwenview.md, digikam-viewer.md, honeyview-bandiview.md.
