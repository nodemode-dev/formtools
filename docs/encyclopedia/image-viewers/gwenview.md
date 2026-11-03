# Gwenview (KDE)

KDE's image and video viewer. License GPL-2.0-or-later. Listed release 26.08.2 (2026-10-08). The KDE app page lists Linux installs (distro packages, Flathub, Snap) and does not mention Windows or macOS. Distinguishing idea: separate Browse and View modes with a thumbnail bar, an in-pane compare view, and tight KDE integration.

## Features

- **Modes**: Browse mode (thumbnails of a folder), View mode (one image), both usable full screen, where quick slideshows can run. A start page lists recent folders, URLs, places and tags. formtools note: a browse-versus-view split with a collapsible thumbnail strip is the proven layout.
- **Zoom and fit**: slider with presets Fit, Fill and 100%; F toggles Fit and 100%, Shift+F toggles Fill. Three behaviors for zoom between images: reset to fit, share zoom and position, or remember per image. A small bird's-eye overview appears when zoomed in. At fit zoom arrow keys change image, when zoomed they scroll. formtools note: copy the arrow-key rule and the three zoom-persistence options.
- **Compare**: select several images in Browse (or add a pane with the + button) to view side by side; Tab cycles panes; zoom can be synced or independent, toggled with Ctrl+Y. formtools note: this is the best-documented compare behavior among the free viewers; use it as the spec. (single source)
- **Basic edits**: rotate (Ctrl+R / Ctrl+Shift+R), mirror, flip, resize (Shift+R), crop (Shift+C), red-eye reduction; an undo/redo bar with navigation between modified images and three save options. The app page also lists brightness, contrast, gamma and annotations (arrows, shapes, text, stamps). formtools note: annotation stamps are a common ask.
- **Lossless JPEG**: the handbook introduction states lossless JPEG transformations (rotate, mirror). The image-operations page does not say whether the Rotate button is lossless; treat it as unconfirmed. formtools note: tell users when an edit is lossless.
- **Metadata**: view and edit EXIF comments in JPEG. Sidebar info. formtools note: see matrix.
- **Color**: reads embedded profiles in PNG and JPEG and combines with the display profile. formtools note: display-profile awareness is table stakes on Linux.
- **Formats**: image support depends on Qt and installed plugins, so the format list varies per distribution; transparency and animated images display. RAW not mentioned in the handbook intro. formtools note: ship our own decoder set so format support does not depend on the distro.
- **File management and import**: copy, move, delete; a Gwenview Importer with automatic renaming. formtools note: camera-card import with rename is a nice add-on, not core.
- **Plugins**: not documented in sources fetched.

## Not verified

- HDR, RAW, slideshow options, KIPI/share plugin status, shortcut philosophy. Several handbook pages failed to load.

## Sources

- https://apps.kde.org/gwenview/
- https://docs.kde.org/stable5/en/gwenview/gwenview/index.html
- https://docs.kde.org/trunk_kf6/en/gwenview/gwenview/introduction.html
- https://docs.kde.org/stable5/en/gwenview/gwenview/view_mode.html
- https://docs.kde.org/stable_kf6/en/gwenview/gwenview/image_operations.html
