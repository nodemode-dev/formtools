# XnConvert output tab, naming, and run options

## Destination and structure

| Feature | Behaviour | Formtools note |
|---|---|---|
| Output folder | Choose a folder, or "Save to source folder" to write beside inputs (used for in-place replacement). Default asks where to save at the end of the run. | folder picker + same-folder mode |
| Keep folder structure | Recreates the input sub-tree under the output folder. | relative path mapping |
| Keep parent folder | Also recreates the top input folder's name as a level in the output (needs output different from source). Example: source Travels with subfolders, output Processed gives Processed/Travels/... when on, Processed/... when off. Explained by a forum tester, not by the vendor; the option label "Keep parent folder" itself is confirmed in the vendor's 1.118.0 program file. (behaviour single source) | root-name toggle |
| Delete original | Removes source after successful write; on Windows uses the Recycle Bin unless an INI flag disables it. Reported to interact badly with rename-on-conflict, and to delete originals even when others were skipped (user reports). The program asks for confirmation when this option is on (binary dialog text). | only delete after verified write; skip on error |
| Export destinations | The 1.118.0 binary's destination chooser lists Source folder, a chosen folder, E-Mail (SMTP settings dialog or default mail client, optional JPEG conversion, metadata removal, ZIP, size presets Large 1024x768, Normal 800x600, Medium 640x480, Small 320x240) and FTP; a "Multiple resolution..." output and a "compress file(s) as ZIP file" option also exist. The Picasa and Flickr targets from the older tutorial are not in the binary. | skip online targets; keep folder and ZIP |

## Filename template

- A filename field accepts text plus variables; a small arrow beside the field opens a menu of insertable variables.
- Confirmed tokens: `{Filename}` (source base name, can take suffix text), `{Directory}` (folder name), `###` style counter (each # is a digit position; multiple # pad the number), and image-property variables such as format or dimensions read from the source image (not the processed result, per a forum thread; a "new size" variable was requested and was added in XnView MP 0.48, XnConvert status unknown).
- The extension is added from the output format; extension/name case change options exist (XnResize guide).
- IPTC fields can use the same `{...}` variables (forum title only, not read).
- Also see NConvert's own placeholders (#, %, $, $$, $EXIF:DateTaken[fmt]) in `nconvert-cli.md`. They differ from the GUI tokens.

Vendor placeholder reference (author's own post "Place holder", 2025-02-13, covers XnView MP and XnConvert; the old wiki page it came from is gone):
- Syntax: every variable sits in braces. A slice can be taken with `{variable [start-end]}`, `{variable [start-]}` or `{variable [-end]}` (zero-based; the vendor example turns `img_example_105` into `img` with `[0-2]` and `example_105` with `[5-]`).
- Replace text inside a value with `[~old~new]`, for example `{Filename [~img~out]}`.
- Hide a variable when its value is empty by wrapping in double parentheses, for example `((Model: {EXIF:Model}))`.
- Dates use a bracketed format string. Letters: Y year, y two-digit year, m month number, d day, H hour, M minute, S second, B month name, b short month name, A weekday name, a short weekday name. Example `{Creation Date [Ymd-HMS]}`. Without a format, the system format is used.
- EXIF fields by tag: `{EXIF:Model}`, or `{EXIF:x110}` with a hex-style tag value.
- Token names seen in the 1.118.0 program file: Filename, Filename With Ext, Directory, Modified Date, Creation Date, Current Date, Size KB, DstWidth, DstHeight, plus the generic `{...}` pattern and `{EXIF:...}` (also `{EXIF:Latitude(f)}` and `{EXIF:Longitude(f)}` inside a map link). The program also stores a history of name templates and offers ready-made ones: `{Filename}_{DstWidth}_{DstHeight}`, `{Filename}_{Current Date [m_d_Y]}`, `{Filename}_{Current Date [d_m_Y]}`; the defaults seen are `{Filename}`, `_result`, and a `Image##` counter style.
- Insert-variable menu entries found in the same binary (a template-menu component probably shared with XnView MP, so some entries such as rating, colour label and frame index may be inactive in XnConvert): "# - Numeric enumerator", Date format variables, Filename, Filename (with extension), Filename (last number), Directory, Folder name, File Type, Annotation, Accessed date, Creation date, Create date, Modify date, Current date, Size (Auto), Size (Bytes), Size (kB), File index, Rating (number), Color label, Color label (number), Frame index, Frame count, grouped sub-menus for EXIF (Camera, Image, GPS), IPTC (Caption, Keywords and Categories, Credits, Status, Origin) and XMP. The date menu offers the ready formats `Y-m-d-H-M-S` and `Y_m_d_H_M_S`, and the EXIF date item inserts `EXIF:Date Taken [Y-m-d_H-M-S]`.
- Name-case drop-down (binary): No change, Name & extension lowercase, Name & extension uppercase, Name lowercase, Name uppercase, Extension lowercase, Extension uppercase, First letters uppercase. A "Start index" field sets the counter start; the step is not shown as a separate field.
- "Preserve extension" is a checkbox on the Output tab (binary).

Not verified: whether the full set of token names is exhaustive (the vendor post speaks of variables generally and the full list is likely in the menu beside the field), and the counter step control.

Formtools note: define one token grammar, e.g. `{name}`, `{ext}`, `{index:03}`, `{date_taken:%Y%m%d}`, `{w}`, `{h}`, `{new_w}`, `{new_h}`, `{folder}`, with both source and result dimension variants.

## Overwrite policy

- The Output tab has an "If an output file already exists" drop-down. Labels isolated in the 1.118.0 binary: Ask and Skip; the remaining entries (overwrite and rename in some wording) were not isolated as separate strings, so their exact labels are still open. The "Ask" mode raises a dialog titled "Overwrite file" with buttons Yes to all, Yes, No, Rename, Cancel. The Status tab summary counts Input files, Extracted pages, New files, Overwritten, Skipped. The settings file stores the choice as an integer code (an example used value 3, meaning not documented). A forum case reports rename-if-exists failing when Delete Original was also on.
- Related safety prompts (binary): a warning when Delete original is on; a warning when the output filename template gives the same name to every file; a read-only-file message ("can't be overwritten"); the "Use multiple CPU Cores" setting is switched off automatically when combined with Ask mode or multipage PDF output.
- Formtools note: enum of ask/overwrite/rename-suffix/skip; never combine delete-original with overwrite of the same path.

## Metadata and file attributes

- "Keep original date/time" copies file timestamps. "Preserve metadata" carries EXIF/IPTC/XMP into the result. Both are checkboxes on the Output tab (Clemson, XnResize guides).
- Metadata is lost if any step (including an intermediate PNG save) writes a format lacking EXIF; metadata actions (Clean, IPTC/XMP) run in the action list and interact with these flags.
- Formtools note: carry metadata as a side structure across the pipeline, independent of pixel format.

## Format list and per-format options

- Output format dropdown includes "As original" plus roughly 70 writable formats (JPEG, PNG, TIFF, WebP, AVIF, GIF, BMP, JPEG 2000, JPEG XR, PDF, etc.).
- Each format has a Settings button with its own panel. Known options from NConvert (used as proxy):
  - JPEG: quality (default 85), progressive, optimize Huffman, subsampling (4:4:4, 4:2:2, 4:2:0), DCT method, smoothing, reuse original quality.
  - PNG: compression level 0 to 9 (default 6), interlace; transparency colour.
  - TIFF: compression types (several), single strip.
  - WebP: quality; lossless variants (not verified).
  - AVIF: format 444/422/420, speed 0 to 10, quantizer min/max for colour and alpha.
  - JPEG 2000: compression ratio, max file size. JPEG XR: colour format and filtering.
  - GIF: interlace, GIF87 flag; palette via colour-depth action.
- Animated sources: GIF to animated WebP unsupported (first frame only).
- The 1.118.0 binary has write-settings dialogs for AVIF, HEIC, JPEG, JPEG XL, JPEG XR, JPEG 2000, PNG, TIFF, WebP, GIF, BMP, PCX, TGA and PDF. That settles the earlier doubt: HEIC and AVIF settings panels exist in the Linux build, so write support is claimed there; a macOS user in April 2026 saw no HEIC entry in the output list and the author's only reply was to ask which OS (no resolution), so HEIC write availability may depend on platform. The vendor product page lists HEIC and AVIF among supported formats.

## Multipage and animated handling

- NConvert can extract all pages, pick a page, or join into multipage TIFF, DCX, LDF, PDF.
- GUI labels (binary): "Convert multipage file to multipage file (when possible)" and "Convert all pages from multipage file", stored as multipage and allPages settings. String order puts them beside the overwrite and keep-date options, so they are probably on the Output tab; not confirmed.

## Other run options

- Use multiple cores (checkbox "Use multiple CPU Cores"; the vendor guide calls it "Use CPU cores" and says one core is the default; not exported to NConvert).
- Rotate images according to EXIF (checkbox, not exported to NConvert; label "Rotate images according to EXIF orientation tag" in Settings).
- "After conversion" group (binary): Open File Manager, Open in Browser, Clear the 'Input' file(s), Beep at the end of process, Exit after conversion.
- Other labels: "Keep original file when encoded result is larger (experimental)", "Keep original date/time attributes", "Preserve Metadata", "Preserve color profile" (Output tab), then in Settings "Load last script used at startup", "Add 'Convert with XnConvert' to context menu" (needs admin rights), "Restore previous input file list", "Save actions list at exiting".
- Run log: the Status tab has a log with "Save log as..." and "Export log" (text files; default name batch_convert_log.txt), plus a summary of total input size, total output size, file-size ratio and duration.

## Sources

- https://newsgroup.xnview.com/viewtopic.php?p=159654 (filename tokens)
- https://newsgroup.xnview.com/viewtopic.php?p=103696 (variables read source image)
- https://newsgroup.xnview.com/viewtopic.php?p=196749 (keep parent folder)
- https://newsgroup.xnview.com/viewtopic.php?p=198712 (output options)
- https://newsgroup.xnview.com/viewtopic.php?p=129357 (overwrite and delete original)
- https://newsgroup.xnview.com/viewtopic.php?p=190508 (export gaps, checkboxes, recycle bin)
- https://newsgroup.xnview.com/viewtopic.php?p=150592 (metadata)
- https://digitalcollections.clemson.edu/digitization/digital-projects/instructions/batch-converting/
- https://www.ghacks.net/?p=161080
- https://www.howtoforge.com/tutorial/how-to-do-batch-image-processing-on-linux-with-xnconvert/
- https://forum.xnview.com/viewtopic.php?p=173031 (format option proxies)
- https://newsgroup.xnview.com/viewtopic.php?p=204000 (vendor post "Place holder": variable syntax, slices, date letters)
- https://newsgroup.xnview.com/viewtopic.php?t=42682 (vendor Documentation board: points to the now-removed wiki placeholder page)
- https://newsgroup.xnview.com/viewtopic.php?t=50568 (HEIC save question on macOS, vendor reply only asks the OS)
- https://www.xnview.com/en/how-to-batch-convert-and-batch-process/ (vendor guide: filename placeholders, CPU cores, presets)
- https://download.xnview.com/XnConvert-linux-x64.tgz (vendor 1.118.0 Linux build; labels read by static inspection, not run)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to forum, wiki gone)
