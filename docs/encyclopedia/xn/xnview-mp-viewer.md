# XnView MP: viewer

Source tags: see xnview-mp-overview.md.

## 1. Opening and tabs

* Double-click a thumbnail or press Enter opens the image in its own View tab (tab bar like a web browser; close with the x). Left/right arrow keys or toolbar arrows step through the images of the folder shown in the browser. GUIDE.
* File > Open in View mode opens an image directly, bypassing the browser. Drag a file onto the window to open it. GUIDE, SITE.
* Settings allow a different startup behaviour, maximum tab count, and "open single instance in full screen". REL (1.11.x).
* View mode has its own menu bar and toolbar, separate from Browse mode. GUIDE.

## 2. Zoom and navigation

| Control | Behaviour | Source |
|---|---|---|
| Toolbar +, -, 100% buttons; status bar shows percentage | Step zoom, reset to 100% | GUIDE |
| "*" key | Show at 100% (default mapping in 2017 guide) | GUIDE |
| "/" key | Toggle fit-to-window and 100% | GUIDE |
| Pan overview | Small thumbnail with red rectangle appears above status bar when zoomed in; drag it to pan | GUIDE |
| Alt + mouse wheel zoom, horizontal wheel scroll, shift+arrow speed | Settings > Mouse | REL |
| Zoom-out anti-aliasing setting | Affects downscaled display quality (a bug fix noted that 100% was impacted) | REL (1.12.2) |
| Pan to coordinates, center image, grid overlay that scales with zoom | Added/fixed in 1.11.x | REL |
| Reload (reopen) keeps or restores zoom/position | 1.11.x | REL |

formtools note: viewer needs fit/fill/100%/custom zoom, wheel modifier remapping, pan minimap and a downscale-quality option.

## 3. Full screen and filmstrip

* Full screen mode and a filmstrip view are vendor-listed core features. A floating info panel can be shown in full screen; fixes for title bar, rotation and floating-view behaviour appear in the changelog. SITE, REL.

## 4. Slideshow

* Quick Slideshow button in View mode plays the images of the browser list starting at the current one; selection or tagged cross-folder sets can be shown. Interval is set in Settings > View > Misc > Quick Slideshow. GUIDE.
* Full slideshow (Tools/View > Slideshow) with transitions/effects, saved as .ini sessions with intervals, music and per-image timings (FAQ, single-source for music and per-image timing). Slideshow of a folder with "watch folder" (new files appear automatically) added in 1.9.4. SITE, REL.
* Create menu offers exporting a slideshow (see batch-and-create file). SITE.

## 5. Histogram, channels, clipping

* Histogram tab in Info panel. REL, ORCH.
* "Show channel" display option and a shadow/highlight clipping overlay (1.11.2). Clipping settings exist. REL.

## 6. Multi-page and animated images

* Page navigation toolbar with previous/next and page number, Page Up/Down keys, and a Pages side panel (thumbnails of all pages) enabled from the View menu. Supported: PDF (Ghostscript required in older docs; PDFium used for PDF from 1.12.2), multi-page TIFF, animated GIF/APNG/WebP/AVIF/JXL, multi-size ICO, multi-frame DICOM, layered PSD. FAQ, REL.
* Animated formats play on open and can be stepped frame by frame via Pages panel. Animated AVIF added in 1.11.2; JXL animation speed fixes in 1.11.7. SITE, REL.
* Frame index/count placeholders are usable in labels and overlays. REL.
* Video and audio: playback of MP4/MOV/AVI/MKV/WebM through an embedded MDK-based player (MDK SDK version bumps appear in the changelog; the FAQ says "FFmpeg-supported containers"). MediaInfo supplies video information. SITE, REL.

## 7. Color management

* Reads embedded ICC profiles (JPEG, PNG, TIFF, PSD, JXL, most RAW per FAQ). Working space default sRGB, Adobe RGB and custom .icc selectable (FAQ path: Options > View > Color management; single source). Engine: LCMS2 (release notes list LCMS2 2.16 to 2.19.1). PNG cICP chunk handled (1.11.6). AVIF HDR and JXL 48-bit fixes noted. SITE, REL.
* HDR/tone mapping and display-profile detection details: not verified.

## 8. Info and properties

* Properties window (floating, tabbed, same tabs as browser Info panel), status bar with coordinates, pixel color picking while selecting. Info display formatting and ExifTool fields can be shown in viewer info (1.8.1). SEIBERT, REL.
* Overlay of rating and color label on the image. REL.

## 9. Ratings, tags and actions from the viewer

Ratings and labels can be assigned to the current image; Delete, rename, copy, move, set wallpaper, open with external editor are available from the menu. GUIDE, REL.

## 10. Selections

Dragging draws a selection; handles resize it; the Image menu can fix the selection to a size or ratio (A4, 4:3, 16:9). Selection is the target for crop, red-eye and Spotlight. GUIDE.

## Sources

* https://www.xnview.com/en/xnviewmp/
* https://www.xnview.com/en/faq/
* https://www.xnview.com/en/webp-viewer/
* https://www.xnview.com/en/png-viewer/
* https://www.xnview.com/en/avif-viewer/
* https://www.xnview.com/en/jpeg-xl-viewer/
* https://www.xnview.com/en/dicom-viewer/
* https://www.xnview.com/en/tiff-viewer/
* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
* https://www.carlseibert.com/xnview-metadata-how-to/
* https://newsgroup.xnview.com/viewtopic.php?t=51463
* https://newsgroup.xnview.com/viewtopic.php?t=51356
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=50659
* https://newsgroup.xnview.com/viewtopic.php?t=49642
* https://newsgroup.xnview.com/viewtopic.php?t=47934
