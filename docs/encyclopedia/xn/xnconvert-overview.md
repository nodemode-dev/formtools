# XnConvert overview

Research scope: XnSoft's XnConvert, NConvert, XnResize. Facts below come from xnview.com product pages and the official XnSoft forum. Anything not confirmed is marked.

## Product facts

| Item | Value | Source note |
|---|---|---|
| Vendor | XnSoft (Pierre-E Gougelet) | product pages |
| Latest XnConvert seen | 1.118.0 (release date not shown on page) | xnconvert page |
| Read formats | "more than 500" | product page |
| Write formats | about 70 | product page |
| Actions | "more than 80" operations | product page |
| Platforms | Windows 10/11 64-bit (Setup exe or zip), macOS universal DMG (Intel + ARM), Linux 64-bit (DEB, TGZ, AppImage); older builds for Win 7/8, 32-bit Windows, 32-bit Linux | download section |
| Linux baseline | Ubuntu 22.04+, Debian 11.6+, RHEL 8.6+ | download section |
| UI languages | 20+ | product page |
| License | Freeware for private, educational, public-service and non-profit use; paid per-seat license for company use (list price from 15 EUR for 1 seat, down to 6.50 EUR at 100+) | product page + FAQ |
| Closed source | yes (freeware, not open source); no adware or spyware claimed | product page |

Formtools note: counts matter as positioning only. A reimplementation should aim for a curated read set (JPEG, PNG, WebP, AVIF, HEIC, TIFF, GIF, BMP, RAW via libraw, PDF via a renderer) and about 15 to 20 write formats, not 500.

## Tab model

XnConvert is a four-step wizard in one window: Input, Actions, Output, Status, plus a Settings tab (language, startup behaviour, loading the last script at launch). A fifth region, a before/after preview, sits beside the Actions list. One source describes the layout as action options on the left and image preview on the right. (The vendor's own batch guide now confirms the tab names Input, Action, Output and Status for XnConvert, and says to check the Status tab for errors or warnings; the Settings tab is a separate dialog in the 1.118.0 binary.)

### Input tab

- Add Files, Add Folder, or drag and drop. Subfolders are included automatically when a folder is added (Clemson guide; the vendor guide says the Add folder button adds the folder and its contents, and files at the top of the list convert first, so the list is user-orderable).
- File list shows thumbnails with name, resolution, size; sortable columns and switchable view modes (XnResize guide; XnConvert shares the UI, likely).
- Remove selected / remove all.
- Hot folders: a checkbox plus folder list on the Input tab. See below.
- Formtools note: needs a file list model with recursive folder add, drag-drop, sort, thumbnail cache, and format sniffing by content not extension.

### Hot folders (folder monitoring)

- Described by the vendor as automatically applying the saved set of edits to new or changed images.
- Operation (forum, community-confirmed): add folders on the Input tab, set actions and output, press Convert once; the app then stays running and processes new arrivals. Files already present when Convert is pressed were not processed in one user test.
- Known caveats: never write output into the watched folder (infinite loop); one settings set per running instance, so different actions per folder means separate instances; a bug existed where subfolders with fewer than 10 added files were missed (fixed after v1.65); the Convert button was reported greyed out until a file was loaded (v1.98).
- Vendor statements (author, Aug 2026, forum thread t=51206): a "watch hot folders" checkbox is always present, unchecking it pauses watching, and the folders are designated in a "Hot folders..." dialog. The product page says only that it watches folders for new or updated images and applies a custom set of edits.
- Dialog contents (labels in the 1.118.0 Linux binary): a folder list with "Add folder...", a "Recursive" option, and an "Extensions" list; the Settings dialog has a "Frequency" label and a stored check-frequency key (its exact scope is not clear).
- Watch method (binary, indirect): the program contains directory-changed handlers of the kind Qt's file-system watcher emits, plus a directory timer and a process timer, so detection is likely OS directory notifications combined with a timed re-scan at the configured frequency. Exact mechanism not stated by the vendor; treat as inferred.
- The ARM64 1.115.0 thread reports that a re-processing pass handled every file in the folder rather than only new ones (user report, one source); the vendor did not address it.
- Formtools note: needs a watcher service with debounce (wait for file write to finish), an ignore-own-output rule, and per-folder profiles (improvement over XnConvert).

### Status tab

Progress and error reporting for the run. Users requested a consolidated error list at the end; developer agreed in one thread but delivery is unconfirmed.

## Actions pipeline

- Add Action menu grouped into Image, Map, Filter, Misc (full catalog in `xnconvert-actions.md`).
- Actions are an ordered list, executed top to bottom; order matters (a forum case shows an intermediate PNG step destroying EXIF before a final JPEG save).
- A tutorial states up to 80 actions can be chained, with a warning that long chains slow the batch.
- Each action has its own parameter panel; preview updates to show the result on a selected sample image, with before/after viewing.
- Reordering, disabling, deleting items: standard list operations (exact UI affordances not verified).

## Presets and scripts

- Settings are saved as "scripts"/presets: a file holding the action list and output settings. A forum config excerpt shows an XML-style structure with attributes on an options element (for example a delete-original flag and an overwrite integer code), so scripts are XML-ish (single source, partial).
- Vendor build facts (1.118.0 binary): preset buttons read "Load preset", "Save preset", "Remove preset from list" under a "Presets:" drop-down; the file dialogs use the extension `.xbs` ("Load script", "Save script"); a separate "Export script" writes a `.bat`, and "Export for NConvert..." builds an NConvert command line. The internal serialisation of `.xbs` is not documented and was not seen (a sample file was not available); the binary stores per-action values under short keys such as active and collapse flags, and keeps a "lastActions" list for "Save actions list at exiting". Whether `.xbs` is XML or INI-style remains open.
- The vendor guide says a preset stores actions, parameters, format and format settings.
- The Settings tab can reload the last script at startup.
- Application settings live in `xnconvert.ini` (Windows: AppData\Roaming\xnconvert); the INI must sit beside the program in portable form.
- Formtools note: store presets as versioned JSON, include a schema version, make them importable/exportable, and keep app settings separate from job presets.

## CLI interop

- "Export for NConvert" button writes a `.bat` file with an `nconvert` command line. Per the author it exports only actions, not every option; the multiple-cores, delete-original, preserve-metadata and rotate-by-EXIF options were reported as not exported. Batch file passes filenames as arguments, which can hit the 8191-character Windows limit (users asked for a list file; NConvert has `-l`).
- Formtools note: build the engine as a library plus CLI, and generate CLI strings from the same job model so export is lossless and warns when something cannot be expressed.

## Other behaviours noted

- Animated GIF to animated WebP is not supported; only the first frame converts (forum, developer-acknowledged).
- Writing is done via format libraries (libpng/libjpeg); buffer size complaints were not acted on.
- Delete Original sends to Recycle Bin on Windows by default; an INI flag switches to direct unlink.

## Not verified

- Official help pages: the vendor wiki is allowed under the owner's ruling but no longer exists (xnview.com/wiki and wiki.xnview.com now redirect to the forum index, checked 2026-11-03), so there is no help text to cite. Per-action parameters were re-read from the vendor's 1.118.0 program file; value ranges for effect actions remain unknown.
- Threading ("use multiple cores") details, the hot-folder watch mechanism (inferred only) and the `.xbs` script schema.
- The vendor forum announcement for 1.118 (author post dated 2026-10-12) says the program accepts file names as arguments or `@filelist`, and lists a Flatpak and a Mac App Store build besides the downloads on the product page.

## Sources

- https://www.xnview.com/en/xnconvert/
- https://www.xnview.com/en/faq/
- https://www.xnview.com/en/image-formats/
- https://www.xnview.com/en/how-to-resize-images/
- https://www.howtoforge.com/tutorial/how-to-do-batch-image-processing-on-linux-with-xnconvert/
- https://digitalcollections.clemson.edu/digitization/digital-projects/instructions/batch-converting/ (university guide, single source for workflow)
- https://newsgroup.xnview.com/viewtopic.php?p=190875 (hot folders)
- https://newsgroup.xnview.com/viewtopic.php?p=161336 (hot folders)
- https://newsgroup.xnview.com/viewtopic.php?p=113405 (watched folders)
- https://newsgroup.xnview.com/viewtopic.php?p=175986 (settings, per-folder)
- https://newsgroup.xnview.com/viewtopic.php?p=127958 (export for NConvert)
- https://newsgroup.xnview.com/viewtopic.php?p=190508 (export gaps, delete original, GIF to WebP)
- https://newsgroup.xnview.com/viewtopic.php?p=150592 (metadata and PNG intermediate)
- https://www.xnview.com/en/how-to-batch-convert-and-batch-process/ (vendor guide: tabs, input ordering, presets, CPU cores)
- https://newsgroup.xnview.com/viewtopic.php?t=51206 (hot folders thread, vendor replies)
- https://newsgroup.xnview.com/viewtopic.php?t=51458 (XnConvert 1.118 announcement, command-line arguments)
- https://download.xnview.com/XnConvert-linux-x64.tgz (vendor build, strings inspected, not executed)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to forum, wiki gone)
