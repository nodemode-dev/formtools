# XnConvert output tab, naming, and run options

## Destination and structure

| Feature | Behaviour | Formtools note |
|---|---|---|
| Output folder | Choose a folder, or "Save to source folder" to write beside inputs (used for in-place replacement). Default asks where to save at the end of the run. | folder picker + same-folder mode |
| Keep folder structure | Recreates the input sub-tree under the output folder. | relative path mapping |
| Keep parent folder | Also recreates the top input folder's name as a level in the output (needs output different from source). Example: source Travels with subfolders, output Processed gives Processed/Travels/... when on, Processed/... when off. Explained by a forum tester, not by the vendor. (single source) | root-name toggle |
| Delete original | Removes source after successful write; on Windows uses the Recycle Bin unless an INI flag disables it. Reported to interact badly with rename-on-conflict, and to delete originals even when others were skipped (user reports). | only delete after verified write; skip on error |
| Export destinations | Older tutorial mentions online targets (Picasa, Flickr). Likely obsolete. (single source) | skip |

## Filename template

- A filename field accepts text plus variables; a small arrow beside the field opens a menu of insertable variables.
- Confirmed tokens: `{Filename}` (source base name, can take suffix text), `{Directory}` (folder name), `###` style counter (each # is a digit position; multiple # pad the number), and image-property variables such as format or dimensions read from the source image (not the processed result, per a forum thread; a "new size" variable was requested and was added in XnView MP 0.48, XnConvert status unknown).
- The extension is added from the output format; extension/name case change options exist (XnResize guide).
- IPTC fields can use the same `{...}` variables (forum title only, not read).
- Also see NConvert's own placeholders (#, %, $, $$, $EXIF:DateTaken[fmt]) in `nconvert-cli.md`. They differ from the GUI tokens.

Not verified: complete token list, date-format syntax in the GUI, counter start/step fields in the GUI.

Formtools note: define one token grammar, e.g. `{name}`, `{ext}`, `{index:03}`, `{date_taken:%Y%m%d}`, `{w}`, `{h}`, `{new_w}`, `{new_h}`, `{folder}`, with both source and result dimension variants.

## Overwrite policy

- Option list contains at least: overwrite, rename if target exists, skip (inferred). The settings file stores the choice as an integer code (an example used value 3, meaning not documented). A forum case reports rename-if-exists failing when Delete Original was also on.
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

## Multipage and animated handling

- NConvert can extract all pages, pick a page, or join into multipage TIFF, DCX, LDF, PDF. The GUI option names for this were not verified. (single-source inference from CLI)

## Other run options

- Use multiple cores (checkbox, exists per forum; not exported to NConvert).
- Rotate images according to EXIF (checkbox, not exported to NConvert).
- Post-actions such as opening the folder: not verified.
- Error log at end: requested, unconfirmed.

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
