# Preview: PDF features

## Viewing and finding
- Single Page, Continuous Scroll, Two Pages; thumbnails, contact sheet, table of contents sidebar.
- Search field in toolbar: phrase search by default, "Any Match" for any-word search, results sortable by Search Rank (match count) or Page Order; scope can be limited to notes.
- Bookmarks: Tools > Add Bookmark on the current page; View > Bookmarks sidebar; Control-click to delete.
- Highlights and Notes sidebar (View > Highlights and Notes) lists marks; select and Delete removes.
- Slideshow via View > Slideshow.

formtools note: search with ranking and "any match" is cheap to implement; bookmarks are app-level (stored in file/sidecar, mechanism not documented).

## Page management
- Insert: Edit > Insert > Blank Page or Page from File (after selected page); sidebar Add button offers the same.
- Delete: select thumbnails (or contact sheet), Delete key; removes annotations on those pages.
- Reorder: drag thumbnails; drag between open PDFs; Command-click for non-contiguous selection; drag to desktop to make a new PDF.
- Combine: drag pages between two open PDFs' sidebars, or drag a PDF file icon from Finder into a sidebar. Changes autosave, so Apple advises duplicating originals first.
- Rotate pages (single or multi-select) and Crop pages with the rectangular selection plus Crop.
- Scanner as a page source: mentioned by Apple elsewhere, steps not verified.

formtools note: thumbnail drag-drop between windows is the signature interaction; copy it, and make it non-destructive (edit a working copy).

## Forms and signatures
See preview-markup.md (Form Fill, AutoFill, Sign).

## Annotate, redact
See preview-markup.md. Redaction becomes permanent when the document closes.

## Security
- Open password: set in Export dialog Permissions area (Require Password To Open Document). A separate owner password controls permission changes; permission checkboxes (printing, changes) require it.
- File > Edit Permissions changes passwords later; changes take effect next open.
- Encryption inspector shows state. Encryption algorithm is not documented in the Apple page.
- Third-party (TidBITS, 2016): Export dialog Encrypt only sets an open password; Print > Save as PDF > Security Options sets both passwords. (single source, may have changed)

formtools note: support AES-256 PDF encryption with open and owner passwords and permission flags; document algorithm choice ourselves.

## Size reduction and filters
- File > Export, Quartz Filter pop-up. "Reduce File Size" is the main size filter, lossy for images.
- Export checkboxes documented by Apple: Create Linearized PDF (fast web view), Optimize images for screen, Save images as JPEG.
- Color filters per Apple: Black & White and Sepia. TidBITS adds Blue Tone, Gray Tone, Lightness Increase/Decrease, Create Generic PDFX-3 Document. (partly single source)
- Print dialog: Selection only, Auto Rotate, Show Notes, Scale / Scale to Fit (Print Entire Image or Fill Entire Paper), copies per page, pages per sheet. Print > Save as PDF flattens annotations (Apple guidance on annotating).

formtools note: provide "Reduce size" presets (image downsample + JPEG recompress) and a flatten-on-print option.

## 3D files (brief)
Opens USDZ, USD/USDA/USDC, PLY, STL, Alembic (Ogawa), glTF/GLB, OBJ, MaterialX, OpenVDB. Export to USD family (USDZ texture/geometry compression, USD ASCII or binary), image sequence, QuickTime movie (animated files), PDF, and HEIC spatial/immersive photos from cameras.

formtools note: 3D is out of scope for v1 except possibly glTF/OBJ/STL viewing.

## Sources
- https://support.apple.com/guide/preview/find-text-in-pdfs-prvw2014/mac
- https://support.apple.com/guide/preview/bookmark-pdf-pages-prvw1087/mac
- https://support.apple.com/guide/preview/combine-pdfs-prvw43696/mac
- https://support.apple.com/guide/preview/add-delete-or-move-pdf-pages-prvw11793/mac
- https://support.apple.com/guide/preview/crop-or-rotate-a-pdf-prvw11567/mac
- https://support.apple.com/guide/preview/password-protect-a-pdf-prvw587dd90f/mac
- https://support.apple.com/guide/preview/reduce-the-size-of-a-pdf-prvw1509/mac
- https://support.apple.com/guide/preview/add-effects-to-a-pdf-prvw1510/mac
- https://support.apple.com/guide/preview/print-pdfs-and-images-prvw15175/mac
- https://support.apple.com/guide/preview/annotate-a-pdf-prvw11580/mac
- https://support.apple.com/guide/preview/3d-file-formats-supported-in-preview-prvwenxw4tm2/mac
- https://support.apple.com/guide/preview/export-a-3d-file-prvw1gxwpz8/mac
- https://tidbits.com/2016/05/18/the-power-of-preview-converting-images-and-exporting-pdfs/
