# Preview: image features

## Inspector (Tools > Show Inspector)

Panes documented by Apple:
- General Info: file size, author, resolution and similar.
- More Info: image metadata in several tabs (the Apple page does not use the words EXIF or GPS, but this pane is where Exif, TIFF, GPS, IPTC style tabs live; tab names not verified from Apple docs).
- Keywords: view assigned keywords.
- Annotations: list of shapes/text; selecting an entry highlights it on the page.
- Crop: shows the dimensions of the current selection with a unit choice.
- Encryption (PDF): shows protection and permissions.

formtools note: a tabbed metadata inspector (general, EXIF/GPS, keywords) is the baseline; read-only first, editing keywords later.

## Location

Tools > Show Location Info is enabled only when the image has GPS data. It shows a world-map pin in the GPS section and a "Show in Maps" button for a street map.

formtools note: use an offline-friendly map link (open in default map provider) rather than embedding a map.

## Crop

- Rectangular Selection in the Markup toolbar, drag the area, click Crop. Unit choice appears in the Crop inspector.
- Undo with Edit > Undo Crop, or later via File > Revert To > Browse All Versions.
- Crop works the same on PDF pages.

formtools note: crop is destructive on save; keep undo stack plus version backups.

## Adjust Size

Tools > Adjust Size (also toolbar button). Controls:
- Width and Height, units pop-up (pixels, percent and others), "Fit into" preset list.
- Scale proportionally: lock aspect ratio; with Fit into the result can be smaller than the preset.
- Resample image: when off, changing size only changes the pixel/inch relationship and does not change pixel data; when on, pixels are resampled. A Resolution field (pixels per inch) is included; the resulting file size is shown at the bottom.
- Batch: show several images in one window, select in sidebar, Tools > Adjust Size.
- Rotate/flip multi-select works the same way (Tools > Rotate, Flip Horizontal, Flip Vertical).
- The full unit list (pixels, percent, inches, cm, mm, points) is from general knowledge and the Apple page names only "percent"; mark as partly unverified.

formtools note: a resize dialog with unit selector, lock-ratio, resample toggle, resolution field and live output-size readout is the target.

## Adjust Color

Apple confirms: exposure, contrast, saturation, tint "and other values", plus Auto Levels and Reset All. Apple does not list every slider. Third-party (How-To Geek, older Preview) describes:
- Histogram with three triangle handles (black point, midtones, white point equivalents)
- Exposure, Contrast, Highlights, Shadows, Saturation, Temperature, Tint, Sepia, Sharpness
- Eyedropper for neutral white balance
- Auto Level button, Reset All

Slider ranges and processing order are not documented. A forum thread notes an older "Gamma" slider was removed in 10.6. (single source for slider list; version drift likely)

formtools note: implement the slider set above via a standard image pipeline (levels, exposure, contrast, HSL/temperature, unsharp mask); ranges are ours to choose.

## Instant Alpha, Remove Background, Smart Lasso

- Instant Alpha (Markup toolbar selection menu): drag across a background color to select similar contiguous pixels, Delete makes them transparent.
- Remove Background (button, Shift-Command-K): AI subject isolation. Preview offers to convert the file to PNG; Duplicate first to keep the original. Undo with Edit > Undo.
- Smart Lasso: snaps to edges while tracing; copy the result to paste elsewhere.
- Rectangular, Elliptical, Lasso selections: copy or delete regions.
- To use these on a PDF page, export the page as an image first.

formtools note: ship Remove Background via a pluggable segmentation model and Instant Alpha as a flood-fill with tolerance; both must output PNG/alpha formats.

## Live Text

In an image, text becomes selectable (Text Selection tool under Tools if needed). Context menu: Copy Text, Look Up, Translate (language list), Search with web engine. Detected phone numbers, emails and URLs get a dropdown arrow with actions (call, Contacts, FaceTime, Messages, compose, open, Quick Look site). Availability depends on language and region. Hardware/OS requirements are not stated on the page.

formtools note: OCR plus data-detector overlay is a high-value feature; use platform OCR (Tesseract or system APIs) with selectable text layer.

## Visual Look Up

Documented for the Photos app on Mac (landmarks, art, plants, flowers, pets, other objects) via a toolbar button or an on-photo icon. Apple's Preview guide does not mention Visual Look Up; whether Preview exposes it is unverified.

formtools note: out of scope for v1; needs an online recognition service.

## Animated GIF, HDR, color

- GIF frames are shown as children in the sidebar.
- Quick Look displays HDR images in HDR only when its window is foreground (see quick-look.md).

## Import and capture

- File > Import from [camera/device]: list or grid, rotate, resize thumbnails; Import or Import All; choose destination; results open in one window.
- File > Import from iPhone or iPad > Take Photo (Continuity camera). Scan Documents and Add Sketch exist per Apple but the steps are not on the fetched page.
- File > Take Screenshot > From Selection, From Window, Entire Screen; the capture opens as Untitled.
- Image Capture app (briefly): imports from cameras, iPhones, iPads, scanners; ADF scanners combine multipage scans into one file; flatbed saves each item separately; "Build Web Page" import option; delete-after-import option; can auto-open when a device connects; Live Photos import as two files.

formtools note: add "capture screenshot into editor" and "import from folder or device" flows; scanner support can defer to the OS scan dialog.

## Sources

- https://support.apple.com/guide/preview/view-information-about-pdfs-and-images-prvw9c94f0a4/mac
- https://support.apple.com/guide/preview/see-where-a-photo-was-taken-prvw19865/mac
- https://support.apple.com/guide/preview/crop-resize-or-rotate-an-image-prvw2015/mac
- https://support.apple.com/guide/preview/annotate-an-image-prvw1501/mac
- https://support.apple.com/guide/preview/remove-a-background-or-extract-an-image-prvw15636/mac
- https://support.apple.com/guide/mac-help/mark-up-files-mchl1fd88863/mac
- https://support.apple.com/guide/preview/interact-with-text-in-a-photo-prvw625a5b2c/mac
- https://support.apple.com/guide/photos/visual-learn-a-photo-pht66e7f4102/mac
- https://support.apple.com/guide/preview/import-images-from-a-camera-prvw28007/mac
- https://support.apple.com/en-sg/guide/preview/prvw1092/mac
- https://support.apple.com/guide/image-capture/welcome/mac
- https://support.apple.com/guide/preview/keyboard-shortcuts-cpprvw0003/mac
- https://www.howtogeek.com/258246/how-to-make-quick-color-corrections-to-photos-with-preview-for-os-x/
- https://discussions.apple.com/thread/2474994 (search snippet only, not fetched)
