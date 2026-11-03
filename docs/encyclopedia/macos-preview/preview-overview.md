# Apple Preview: overview, versions, app structure

Scope: Preview on macOS, researched November 2026. Paraphrased from Apple documentation; gaps are flagged.

## Current OS version and what is new

- The Preview User Guide on support.apple.com is now headed "for macOS 27", with selector entries back to macOS Tahoe 26, Sequoia 15 and older. macOS 27 is code-named Golden Gate.
- Release: macOS 27 reached the public on 14 September 2026 (Apple Silicon only). Version 27.2 shipped 26 October 2026 per MacRumors. (journalism, two outlets for 27.0 date; 27.2 date single source)
- Preview-specific changes: one tech outlet (Macworld) says Preview gains support for more document formats, better PDF editing, and faster PDF saving. No detail given and Apple's guide has no "what's new" section. (single source, unverified in Apple docs)
- Rumor, not a feature: MacRumors notes that 27.2 code references new touch gestures in several apps including Quick Look. (single source, speculation)
- Platform-wide: unified toolbar, edge-to-edge sidebars, Liquid Glass opacity slider, Apple Intelligence filename suggestions in Finder, redesigned Shortcuts editor (relevant to Quick Actions).

formtools note: target the macOS 26/27 feature set as the reference; treat "more formats, better PDF edit" as unspecified and do not clone unverified behavior.

## What Preview is (feature map)

Preview is both a PDF viewer/editor and an image viewer/editor, plus a 3D file viewer. Apple's top-level capability list:

- Open: File > Open, Open Recent, double-click, Open With, iCloud Drive. Multiple files open in one window (sidebar list) or separate windows/tabs per setting.
- Edit: crop, markup, forms, signatures, annotation, combine PDFs, page add/delete/move.
- Manage: export, copy, lock, password-protect, reduce size.
- Share and print.
- 3D: view, edit, export (USD family, glTF etc.), view Mac content on Apple Vision Pro.

formtools note: model the app as one document window with a sidebar of "documents or pages" and a toolbar that switches between view and markup modes.

## Window and viewing model

- Detail views: Single Page, Continuous Scroll, Two Pages (View menu). Default for new PDFs is configurable.
- Sidebar modes: Thumbnails, Contact Sheet (larger grid), Table of Contents (if the PDF has one), Highlights and Notes, Bookmarks. Sidebar can be hidden and resized; multi-page PDFs and animated GIFs can expand to show children in the sidebar.
- Zoom: Zoom In/Out, Actual Size, Zoom to Selection (after a rectangular selection), numeric Scale field. Magnifier (Tools > Show Magnifier) follows the pointer; Esc dismisses.
- Navigation: click thumbnail, Go > Go to Page, previous/next.
- Animated GIF: frames are listed as children of the file in the sidebar (no playback timeline documented).
- Slideshow: View > Slideshow shows PDF pages (or selected images) fullscreen with bottom controls.
- Not found in Apple's guide (verify before claiming): Smart Zoom, explicit "tabs" behavior details.

formtools note: Thumbnails, Contact Sheet, and Highlights/Notes sidebars are the core of the PDF UX; ship thumbnails + drag reorder first.

## Settings (Preview > Settings)

- General: window background color.
- Images: open in shared window vs separate windows; define 100% scale as 1 image pixel per screen point or as printed size.
- PDF: 100% scale definition; reopen at last page vs first page; default view (Continuous, Single, Two Pages); Roman-numeral page numbers; stamp author name on annotations (name field, default is the macOS login name).

formtools note: copy these as the preferences baseline; "author name on annotations" matters for PDF annotation metadata.

## Save, autosave, versions, lock

- Autosave with versions: at least hourly, plus on open, save, duplicate, lock, rename, revert.
- File > Revert To: Previous Save, Last Saved, Last Opened; Browse All Versions (timeline UI) with Restore, or Option + Restore a Copy.
- Option > File > Save As; Duplicate; title-bar pop-up for rename/move/lock.
- Lock: title-bar menu Locked checkbox (also Finder Get Info). Locked files cannot be edited or deleted; non-owners edit a duplicate.
- Image markup saved to an image file is baked in and cannot be edited later; keep editable annotations by converting to PDF first (Apple guidance).

formtools note: implement non-destructive annotations only for PDF; for rasters warn that markup is flattened, and offer version history via a sidecar or backup.

## Color management

- Tools > Assign Profile: permanently tags the image with a ColorSync profile.
- View > Soft Proof with Profile: preview how it would look on another device without changing the file.
- "Match to profile" is not described in the current guide.

formtools note: expose "Assign" and "Soft proof" as separate actions; soft proof is view-only.

## Sources

- https://support.apple.com/guide/preview/welcome/mac
- https://support.apple.com/guide/preview/get-started-prvw846b61d3/mac
- https://support.apple.com/guide/preview/open-pdfs-and-images-prvw81f73d4e/mac
- https://support.apple.com/guide/preview/view-pdfs-and-images-prvw11470/mac
- https://support.apple.com/guide/preview/change-preview-settings-prvw5518ecc0/mac
- https://support.apple.com/guide/preview/save-files-prvw0b1e8d9e/mac
- https://support.apple.com/guide/preview/revert-changes-to-pdfs-and-images-prvwf4697c5a/mac
- https://support.apple.com/guide/preview/lock-pdfs-and-images-prvw35875/mac
- https://support.apple.com/guide/preview/apply-a-color-profile-to-an-image-prvw41540291/mac
- https://support.apple.com/guide/preview/image-device-prvw1098/mac
- https://support.apple.com/guide/preview/display-a-pdf-as-a-slideshow-prvw3b268798/mac
- https://support.apple.com/guide/preview/view-an-animated-gifs-frames-prvw1016/mac
- https://www.macrumors.com/2026/06/08/apple-announces-macos-golden-gate/
- https://www.macworld.com/article/3139330/macos-27-golden-gate-has-arrived-heres-what-s-new-on-your-mac.html
- https://appleosophy.com/2026/09/09/macos-27-golden-gate-set-to-be-released-on-september-14-heres-everything-thats-new/
