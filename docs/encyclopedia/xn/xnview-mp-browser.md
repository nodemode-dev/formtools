# XnView MP: browser, catalog and organizer

Source tags are defined in xnview-mp-overview.md. Menu names differ slightly between eras (the 2017 guide uses "Settings", the FAQ uses "Tools > Options"); treat exact menu paths as indicative.

## 1. Window model

XnView MP opens in Browse mode. Images open in separate View tabs, like browser tabs, each tab holding one image; the Browse button in a View tab jumps back to that image's folder. [GUIDE]

| Panel | What it does | Source |
|---|---|---|
| Folder tree | Folders, Favorites (star button), recent folders list in the address box | GUIDE |
| Thumbnail panel | Main grid or details list of the current folder | GUIDE |
| Preview panel | Large preview of selection; hosts Info tabs | GUIDE |
| Info tabs | Properties, Histogram, Exif, IPTC-IIM, XMP, ExifTool, GPS, Preview (3 to 8 tabs depending on file content) | ORCH |
| Categories, Category filter, Category groups | Catalog-driven keyword/tag panels | GUIDE, ORCH |
| Layouts | Several built-in layouts (View > Layout > Layout N) plus user slots to save/restore A, B, C; panels detach, dock and merge into tabs | GUIDE, EDELIN |

formtools note: dockable panels with saved layout presets, tabbed viewer documents and a dedicated address box with recents and favorites.

## 2. Thumbnails and views

* View As: Thumbnails, Thumbnails + Filenames, Thumbnails + Labels, Details (columns). Details columns can be added, removed, reordered and sorted by clicking headers; column presets can be saved (1.10.3). GUIDE, ORCH, REL.
* Thumbnail size slider; persistent thumbnail cache that can be cleared per folder or globally (Settings > Catalog). Clearing the cache also drops category assignments unless the "keep entries assigned to a category" prompt is answered No. GUIDE.
* Labels under thumbnails are user-configurable from a field list (Filename, Caption, etc.); up to six custom fields with variables and per-line colors were described in 2018. Separate tooltip template (some HTML tags allowed, templates savable). SEIBERT.
* Overlay icons on thumbnails show rating, color label, tag, and metadata presence; later releases split overlay icons and added multipage/video/audio overlay indicators and frame counts. SEIBERT, REL.
* Thumbnails image alignment option, tree indentation option, mini toolbar always two lines, thumbnails toolbar split into two (1.8 and 1.9 series). REL.
* Video thumbnails: generated automatically; faster generation in 1.12.x; a "frame at X percent" behaviour was being fixed. REL, SITE.
* Show files of sub-folders ("Show all files (recursive)" from the tree context menu). GUIDE.
* Folder thumbnail for zip files and archive browsing via LibArchive. REL (single source).

## 3. Sorting, filtering, quick filter

* Sort by name, date, folder and more via the Sort-by button; custom (manual) sort exists. GUIDE, REL.
* Filter-by button restricts the visible list (images only, specific label, all). GUIDE.
* Quick filter box in the toolbar with a settings magnifier; searches IPTC fields, categories, description.ion files and file names, and from 1.8 any field used as a thumbnail label. ORCH.

## 4. Ratings, labels, tags

| Feature | Behaviour | Source |
|---|---|---|
| Star rating | 1 to 5 stars, assignable from a Rating and Color Label toolbar button, from the viewer, shown as overlay and as colored rating in details | GUIDE, REL |
| Color labels | Nine slots named by default (Important, Work, Personal, To Do ...), renamable at Settings > Metadata > Labels; stored in XMP optionally (rating and label export options) | GUIDE, ORCH |
| Tag (transient mark) | Ctrl+T tags selection, Shift+T shows tagged files across folders, Untag all, Clear all tags; later renamed Check/Uncheck in 1.10.3 | GUIDE, REL |
| Persistence | Ratings, labels and categories are written to the catalog DB and optionally to XMP/IPTC; darktable color labels can be imported | ORCH, REL |

formtools note: separate persistent metadata (rating, label) from the transient selection set ("tag").

## 5. Categories and the catalog database

* The catalog is an internal SQLite-style database (FAQ calls it SQLite-based; file named XnView.db per ORCH) that indexes chosen folders and keeps thumbnails, selected metadata, ratings, labels and categories. SITE (FAQ), ORCH.
* Categories form a user-editable tree, independent of folders; one image may have many categories. Right-click in the Categories panel to add/rename/delete; import/export of the category list as tab-delimited text; "Category files" export/import of every image-to-category link as XML (backup). GUIDE, EDELIN, ORCH.
* Category vs keyword: a category is a tree node in the DB; ticking it also writes keywords into IPTC Keywords, XMP dc:Subject and lr:HierarchicalSubject when the "export DB categories to XMP subject/IPTC keywords" setting is on. Hierarchy is preserved via hierarchicalSubject. Parent categories can be auto-applied. EDELIN, ORCH.
* Category sets (groups) exist, with a limit of 999 noted in a fix; "show orphaned categories", delete unused categories, multi-delete, numeric categories. REL.
* Filtering by categories: Category filter panel with Match = Any (OR) or All (AND); scope Global, Current folder, or Current + recursive; Ctrl+click adds criterion (AND), Alt+click excludes. Counters appear per node. ORCH.
* Catalog filter extras added over time: date and EXIF nodes, aspect-ratio nodes, face nodes, counters aligned right. REL.
* Catalog maintenance: Settings > Catalog lists managed folders; add (Import folder) rescans metadata and sub-folders; "Delete all" then re-import rebuilds the DB; View menu commands "Update files from catalog" and "Update catalog from files" synchronize in either direction. Import speed quoted by one user: under a minute per 1000 photos, about 40 minutes for 65,000. A maintenance tab was added in 1.11.x. ORCH, REL.
* Moving or renaming through XnView updates the catalog; doing it outside the app leaves stale paths. GUIDE, ORCH.
* Face tags: "face detection (MP only)" listed by the vendor; face tags can be written, imported from XMP face regions made by other tools, and filtered in the catalog. SITE, ORCH, REL.
* Smart albums, albums as tree: added in 1.9.x. Details (conditions, storage) not verified. REL (single source).

formtools note: needs (a) a local DB keyed by path with watch/rescan, (b) a hierarchical tag tree synced to XMP lr:HierarchicalSubject, (c) path-move tracking.

## 6. Search

* Quick search (toolbar) and full Search dialog (Ctrl+F, Tools > Search): file name, folder-only mode, recursive, conditions combined with AND/OR, search folder choice, groups of conditions (1.9.x), optional "use catalog" which answers from the DB instead of reading each file; conditions include file size, dates, keywords, stars, colors; EXIF fields (flash, ISO, UserComment fixes); ExifTool fields in conditions (1.12.x). GUIDE, ORCH, REL.
* Searching non-cataloged metadata forces reading every file and is slow. ORCH.

## 7. Compare

* Select up to 4 thumbnails, Tools/View > Compare (Shift+C). Synchronised pan and zoom, a side strip to swap images, histogram or grid per cell, per-image delete/copy/move. Interpolation choice exists. SITE, EDELIN, REL.

## 8. File operations in the browser

Copy, move, rename, delete (with recycle bin on desktop builds), new folder, copy path/name, drag and drop, send via FTP/upload, set wallpaper (Windows), move-to shortcut (Alt+M in the 2017 guide). Operations done inside XnView keep category links intact. GUIDE, EDELIN, REL.

## 9. Other browser features

* Map panel using GPS (FAQ), reverse geotagging by dragging a marker (FAQ, single source). Tools > Set GPS (FAQ).
* Import and sort tool (Tools > Import and sort): copy from card with destination subfolder pattern, rename pattern such as date taken plus file number, keyword assignment. EDELIN, REL.
* Session load/save of open tabs (1.10.3). REL.
* Companion/sidecar files (xmp, audio companion) handled on copy/move. REL.
* Folder panel supports drag, and a setting to disable dragging. REL.

## Sources

* https://www.xnview.com/en/xnviewmp/
* https://www.xnview.com/en/faq/
* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
* https://www.xnview.com/download/GestionWorkflowPhotos_171119.pdf
* https://www.carlseibert.com/xnview-metadata-how-to/
* https://orchisere.fr/logiciels/html/xnviewmpintro.htm
* https://newsgroup.xnview.com/viewtopic.php?t=50407
* https://newsgroup.xnview.com/viewtopic.php?t=49947
* https://newsgroup.xnview.com/viewtopic.php?t=49642
* https://newsgroup.xnview.com/viewtopic.php?t=48493
* https://newsgroup.xnview.com/viewtopic.php?t=48115
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=50659
* https://newsgroup.xnview.com/viewtopic.php?t=51356
* https://newsgroup.xnview.com/viewtopic.php?t=51463
