# XnView MP: batch, create, duplicates, capture, print

Source tags: see xnview-mp-overview.md. The complete batch action catalogue (80+ actions in XnConvert) is only enumerated by category in non-wiki sources.

## 1. Batch Convert (Tools > Batch convert)

Same module as XnConvert; it can open as a tab and picks up the thumbnails selected in the browser. SITE.

| Tab | Behaviour | Source |
|---|---|---|
| Input | Add files or whole folders, drag and drop; processed top to bottom, reorderable; Del key removes items | SITE, REL |
| Actions | Ordered chain of operations added from an "Add action" menu, grouped by category. Vendor category list: Metadata, Transforms (rotate, crop, resize), Adjustments (brightness, contrast, saturation), Filters (blur, emboss, sharpen), Effects (masking, watermark, vignetting); "more than 80" actions in XnConvert | SITE |
| Output | Destination folder, filename template with placeholders, output format ("same as original" falls back to JPEG if source not writable), per-format Settings button, overwrite policy, keep date/time, keep metadata (IPTC/EXIF/XMP), "Use CPU cores" multi-core option (off by default) | SITE |
| Status | Log of errors and warnings after pressing Convert | SITE |

Additional facts:

* Presets save the full job (actions, parameters, format settings); preset list sortable (1.9.3). SITE, REL.
* Actions mentioned in changelogs: border (with enlarge option), blurred frame, XMP action, watermark text with outline, align histogram, change color depth, saturation, multiple resized versions in one pass (1.10.5), metadata write/clean actions. REL, SEIBERT.
* Metadata write action overwrites; flyouts insert variables substituted per image (EXIF values etc.). SEIBERT.
* Prevent system sleep while running (Windows). Core-count handling fixed in 1.12.2. REL.
* Batch of multi-page TIFF handled, PDF output possible. SITE (FAQ).
* Watch folders (apply preset to newly arrived files) are an XnConvert feature, not stated for MP. SITE.
* Command-line sibling NConvert: 80+ commands, 500 formats, runs on many OSes; XnConvert can export a job as an NConvert command line. SITE.

formtools note: an ordered action list with presets, placeholder-based output naming, a status log and parallel workers is the whole model; keep the action set identical for the viewer and CLI.

## 2. Batch Rename (Tools > Batch rename)

* Name template field, sequential counter appended or placed by token, source order honoured from the browser sort (a regression about this was fixed in 1.11.5). Placeholders cover EXIF date (examples from vendor page: {EXIF:DateTime} and {DateTaken|Y-m-d_His} style), Filename Number, Create/Modify Date, DPI x/y, replace-word, frame index/count. Drag and drop supported; UI revamp in 1.11.x. GUIDE, SITE, EDELIN, REL.
* Import and sort tool combines copy-from-card, subfolder pattern, rename template and keyword assignment. EDELIN.

## 3. Other batch tools

* Change timestamp (menu entry translated as "Modify time" in the French guides, under Tools or Metadata): EXIF dates and file system dates adjustable; dates before 1970 only safe in EXIF, per one user guide. ORCH, SITE.
* Metadata batch: Edit IPTC/XMP with templates, Clean metadata, Transfer metadata, Edit GPS, rebuild EXIF thumbnail (see metadata file).
* JPEG lossless transform based on EXIF orientation in batch. SITE (FAQ).
* Export dialog (Ctrl+Alt+S) is single-file: choose format, JPEG quality, strip metadata. Beginners guide says export cannot be batched; use Batch convert. GUIDE, SEIBERT.

## 4. Create menu (Browse mode)

| Entry | What it makes | Source |
|---|---|---|
| Contact sheet | Rows, columns, page size, captions (file name, EXIF, custom text), output JPEG/PNG/TIFF/PDF; order follows browser order (fixed 1.11.5) | SITE, REL |
| Multi-page file | Combine selected images into one multi-page TIFF or PDF | SITE (FAQ) |
| Slideshow | Export slideshow sessions | SITE |
| Video thumbnail gallery | Grid of frames from video files | SITE |
| File listing | Text/CSV style metadata table for selected images using field placeholders | SITE, SEIBERT |
| Strip of images | Single-row/column strip | SITE |
| Collage, mosaic | Mentioned in the 2017 guide ("collages, mosaics, contact sheets") | GUIDE |
| Web page / gallery | Not listed on the current xnviewmp product page (2026-11 recheck); upload-to-web and FTP send exist. Panorama stitching: no evidence in sources. The vendor wiki that might settle this no longer resolves. | not verified |

## 5. Duplicate finder (Tools > Find similar)

Compares by name, size, date, binary content or visual similarity (detects recompressed or resized copies), according to the FAQ (single source for method list). The product page (2026-11) confirms a "Duplicate File Finder" exists but gives no modes. SITE.

## 6. Screen capture

Capture entire screen, region or window; hotkey defaults F1 in the 2017 guide (user suggested Shift+F1); result opens in a View tab for editing; works while the app is in the background. Wayland-related fixes on Linux. GUIDE, REL.

## 7. Print

Print module with sizing, dpi and grayscale option, "print all opened images" (1.9.0), print selection and page layout; Seibert notes metadata-annotated prints and contact sheets and print-to-PDF. GUIDE, SEIBERT, REL.

## 8. Scan and upload

Scanner support (vendor list, no detail). Upload web / FTP send exist. SITE, REL.

## Sources

* https://www.xnview.com/en/how-to-batch-convert-and-batch-process/
* https://www.xnview.com/en/how-to-resize-images/
* https://www.xnview.com/en/xnconvert/
* https://www.xnview.com/en/xnviewmp/
* https://www.xnview.com/en/nconvert/
* https://www.xnview.com/en/xnresize/
* https://www.xnview.com/en/faq/
* https://www.xnview.com/en/raw-viewer/
* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
* https://www.xnview.com/download/GestionWorkflowPhotos_171119.pdf
* https://www.carlseibert.com/xnview-metadata-how-to/
* https://newsgroup.xnview.com/viewtopic.php?t=50492
* https://newsgroup.xnview.com/viewtopic.php?t=49456
* https://newsgroup.xnview.com/viewtopic.php?t=49093
* https://newsgroup.xnview.com/viewtopic.php?t=48493
* https://newsgroup.xnview.com/viewtopic.php?t=48561
* https://newsgroup.xnview.com/viewtopic.php?t=47934
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=51463
