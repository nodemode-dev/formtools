# XnView MP: metadata tools

Source tags: see xnview-mp-overview.md.

## 1. Reading

* Info panel tabs: Properties, Exif, IPTC-IIM, XMP, ExifTool (full ExifTool output), GPS, Histogram. Only populated fields are shown. A floating Properties window gives the same tabs. ORCH, SEIBERT.
* ExifTool integration: an ExifTool tab, ExifTool fields usable in search conditions, details columns, viewer info; ExifTool path setting on Windows; ExifTool 13.37 to 13.51 bundled across 1.9 to 1.10; "store all ExifTool metadata in catalog" option (1.9.6). REL.
* MediaInfo supplies video details. REL.
* Favorites tab for metadata fields (1.9.4). REL.
* Metadata can be shown in thumbnail labels, tooltips (template with limited HTML), details columns, quick filter. SEIBERT, ORCH.

## 2. Editing

| Tool | Behaviour | Source |
|---|---|---|
| Edit IPTC/XMP (Ctrl+I; Tools > Metadata) | Tabbed dialog with image preview; multi-image navigation; Write (current) vs Write all files; templates (save, load, overwrite as clipboard); flyouts insert existing values; recent-value dropdowns | SEIBERT, ORCH |
| Options tab (multi-select safety) | Keep and add new value (keywords), keep original if new value empty, replace only if original empty, do not preload fields; mode: IPTC-IIM only, XMP only, or IPTC+XMP sync in a chosen direction | SEIBERT, EDELIN, ORCH |
| Write scope limit | Writes core IPTC fields in both IIM and XMP; extended IPTC (XMP-only) fields are readable but not writable (2018 statement; later releases added "Edit XMP" with more fields such as Subject Code, Country Code, local caption) | SEIBERT, REL |
| Edit XMP | Separate editor for XMP-only fields; merge keywords option | ORCH, REL |
| Edit EXIF (1.10.3) | Editor with more fields over time (seconds in timestamps, focal length above 100 mm, ISO above 65535 fixed) | REL |
| Edit GPS data | Copy/paste coordinates in decimal degrees or DMS; map panel | ORCH, FAQ |
| Modify time | Adjust EXIF capture/digitised/modified dates and file system dates | ORCH |
| Clean metadata | Choose categories to remove: EXIF, IPTC, XMP, thumbnail, GPS only, etc.; "Optimize Huffman table" lossless JPEG shrink; rebuild EXIF thumbnail | SEIBERT, FAQ |
| Transfer metadata | Add target fields and fill from fixed text or other fields in batch; no existing-value check, so it can clear fields | ORCH |
| Update metadata (catalog <-> files) | View menu commands to push catalog data into files or pull file data into catalog | ORCH, REL |
| Batch actions | XMP action and metadata write/clean actions in Batch convert | REL, SEIBERT |

## 3. Preservation on save

Each writable format has metadata keep/discard checkboxes (File > Format settings, also on batch Output tab), and the Export dialog has a "remove all metadata" tick. Order of precedence between batch-level and format-level boxes was unclear to a reviewer. Metadata writing support was extended format by format: lossless WebP metadata editing (1.8.1), JPEG XL metadata editing fixes (1.10.5), AVIF EXIF/XMP (1.11.x), and HEIF/AVIF/JXL XMP editing (1.12.1 to 1.12.2). JPEG metadata is written without recompressing pixels (Seibert, 2018). SEIBERT, REL.

## 4. Sidecars and interoperability

* XMP sidecars (.xmp) store rating, color label and keywords, round trip with Lightroom/Bridge style tools; develop settings are not rendered. Companion file settings (including audio companion in 1.11.2) in Settings. SITE (FAQ), ORCH, REL.
* Hierarchical keywords: lr:HierarchicalSubject plus dc:Subject plus IPTC Keywords. Rating can be exported to XMP; color label can be exported as a number 1 to 9. ORCH.
* Encoding: UTF-8 option for IPTC text. ORCH.
* Face regions from other tools can be imported (Settings > Metadata). ORCH.
* Lightroom hierarchical keywords, darktable color labels import. REL.

formtools note: needs an EXIF/IPTC/XMP read-write library with ExifTool-like tag names, a sidecar policy per format (embed vs .xmp), and a field-preservation policy on every save/convert path.

## Sources

* https://www.carlseibert.com/xnview-metadata-how-to/
* https://orchisere.fr/logiciels/html/xnviewmpintro.htm
* https://www.xnview.com/download/GestionWorkflowPhotos_171119.pdf
* https://www.xnview.com/en/faq/
* https://newsgroup.xnview.com/viewtopic.php?t=50407
* https://newsgroup.xnview.com/viewtopic.php?t=50659
* https://newsgroup.xnview.com/viewtopic.php?t=49947
* https://newsgroup.xnview.com/viewtopic.php?t=49642
* https://newsgroup.xnview.com/viewtopic.php?t=47934
* https://newsgroup.xnview.com/viewtopic.php?t=51261
* https://newsgroup.xnview.com/viewtopic.php?t=51463
