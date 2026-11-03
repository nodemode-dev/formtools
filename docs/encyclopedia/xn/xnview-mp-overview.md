# XnView MP: overview

Scope: the current cross-platform XnView by Pierre Gougelet (XnSoft). Research date: 2026-11-03. Latest release at that date: 1.12.2 (announced 2026-10-12 by the author on the official forum).

Source tags used in all files of this folder:

* [SITE] xnview.com product, FAQ, format and how-to pages
* [REL] release-note topics posted by the developer on newsgroup.xnview.com (changelog item lists only)
* [GUIDE] "XnViewMP for Beginners" PDF (Roger Carter, 2017, hosted on xnview.com; UI of that era)
* [EDELIN] "Perfectionner son workflow photo" PDF (Francois Edelin, Dec 2017, built on v0.88, French)
* [SEIBERT] Carl Seibert's metadata how-to (2018)
* [ORCH] orchisere.fr cataloguing intro (updated up to v1.8.3, Nov 2024, French)

Source policy note: the official step-by-step user guide lives on a MediaWiki instance at xnview.com. The brief bans wikis, so it was NOT used. Detailed per-dialog option lists (every Adjust/Filter/Effect parameter, every batch action, full shortcut table) are therefore thinner than a wiki-based survey would be. Gaps are called out per file.

## What the product is

| Item | Finding | Source |
|---|---|---|
| Role | Image viewer, photo organizer/browser, light editor, batch converter, creator of contact sheets etc. | SITE |
| Author | XnSoft, forum posts by "xnview" (Author of XnView) | REL |
| Current version | MP 1.12.2; Classic 2.52.7 (legacy, Windows only) | SITE |
| UI toolkit | Qt 6 migration noted at 1.12.1 (Windows 10+, macOS 13+, Ubuntu 22.04+, Debian 11.6+) | REL |
| Source model | Closed source freeware (the "not open source" statement came only from an out-of-scope forum thread, so treat as unverified) | unverified |
| Related products | XnConvert (batch GUI, shares the MP batch module), XnResize (simple batch resize), NConvert (CLI, 80+ commands), XnShell (Windows Explorer context menu extension), XnRetro, XnSketch, XnView Mobile for Android (new), XnPocket, GFL SDK | SITE |

## Platforms and packages

| Platform | Latest build requirements | Package types | Source |
|---|---|---|---|
| Windows | 10/11 64-bit (1.12.2); older 1.11.7 for Win 7/8; 1.5.5 for 32-bit | Setup, Zip (portable) | SITE |
| macOS | 13+ for 1.12.2; 1.11.7 for 10.13 to 12; universal Intel + ARM DMG | DMG | SITE |
| Linux | Ubuntu 22.04+, Debian 11.6+, RHEL 8.6+, 64-bit; ARM tgz | TGZ, DEB, AppImage, Flatpak (flatpak listed in 1.12.2 announcement) | SITE, REL |

Inconsistency: the features blurb on the XnView MP/Classic landing page still says macOS 10.13+, while the download table says 11.3+ and the MP download page says 13+. Use the download page (13+).

A portable mode exists: at first launch the user may keep settings beside the executable instead of in the profile folder (FAQ, single-source claim). Profile folders given by the FAQ: %APPDATA%\XnViewMP (Windows), ~/.config/XnViewMP (Linux), ~/.xnviewmp (macOS). Treat these paths as FAQ claims, not verified on a machine.

## Licensing model

* Freeware (no adware, no spyware) for private use, public entities, educational use and non-profit organizations (MP download page wording). The FAQ lists personal, educational, public-service and non-profit use. SITE.
* Company use requires a paid license, sold per seat on a sliding scale (EUR): 1 seat 29.00; 2 to 9: 26.00; 10 to 19: 22.00; 20 to 49: 19.00; 50 to 99: 10.50; 100 to 499: 6.50; 500 to 999: 4.20; 1000+: 3.90. SITE.
* Voluntary donation link exists.
* Sibling pricing: XnConvert per-seat (1 seat EUR 15 down to 6.50 at 100+, per XnConvert page); NConvert 100 EUR + VAT per company/application or 300 EUR + VAT site license, with no redistribution as a developer toolkit. SITE.

formtools note: decide the license up front; a "free for personal, paid per-seat for company" split is XnView's pattern. It needs only an honor-system notice, no license-key enforcement was found in the sources (not verified either way).

## Feature map (what the other files cover)

| Area | File |
|---|---|
| Browser, catalog, categories, ratings, search, compare, tagging | xnview-mp-browser.md |
| Viewer, zoom, fullscreen, slideshow, multipage, color management | xnview-mp-viewer.md |
| Edit tools | xnview-mp-editing.md |
| Batch convert, rename, Create menu, duplicates, capture, print | xnview-mp-batch-and-create.md |
| Metadata editing, ExifTool, sidecars, GPS | xnview-mp-metadata.md |
| Format matrix and libraries | xnview-mp-formats.md |
| Settings, layouts, shortcuts, CLI, plugins | xnview-mp-settings-and-shortcuts.md |

## Top-level capability list (vendor wording, paraphrased)

* Viewing: thumbnails, full screen, filmstrip, slideshow with effects, compare up to 4 images.
* Editing: resize, rotate, crop (with lossless JPEG variants), brightness/contrast/gamma, auto levels and auto contrast, color depth and palette changes, filters and effects, paint tools (lines, circles, arrows, bubbles, watermark).
* Create: slideshows, contact sheets, video thumbnail galleries, file listings, image strips.
* Batch: convert (same module as XnConvert), rename, change timestamp, metadata editing.
* Other: duplicate finder, advanced search, multimedia player, print module, screen capture, scanner support, Adobe Photoshop filter plugin support, face detection (MP only).
* Compatibility: Unicode, translations, EXIF/IPTC/XMP, embedded ICC profiles.

(SITE: xnview.com/en/xnviewmp)

## Release cadence and recent themes (from changelogs)

Version topics found on the forum announcement board: 1.7.0 through 1.12.2, about 5 to 8 minor releases per year. Recurring changelog themes: bumping bundled libraries (LibRaw, libheif, libjxl, libwebp, libavif, LCMS2, OpenEXR, OpenJPEG, libpng, zlib, libjpeg(-turbo), LibArchive, MDK video SDK, ExifTool, MediaInfo), catalog/category fixes, batch convert additions, metadata editors, HDR/10-bit AVIF and JXL handling. REL.

## Sources

* https://www.xnview.com/en/xnviewmp/
* https://www.xnview.com/en/xnview-mp/
* https://www.xnview.com/en/faq/
* https://www.xnview.com/en/xnconvert/
* https://www.xnview.com/en/nconvert/
* https://www.xnview.com/en/xnshell/
* https://www.xnview.com/en/mobile/
* https://newsgroup.xnview.com/viewforum.php?f=115
* https://newsgroup.xnview.com/viewtopic.php?t=51463
* https://newsgroup.xnview.com/viewtopic.php?t=51396
* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
