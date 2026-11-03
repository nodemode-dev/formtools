# digiKam (viewer and light table, brief)

KDE-based photo manager (manual version 9.2.0 seen). Cross-platform, open source. Covered only for its preview browser and Light Table.

## Features

- **Browsing**: thumbnails, list, or map pins; video files get thumbnails, previews and metadata; thumbnail sizes adjustable with high-DPI support; right sidebar with item details and tools. formtools note: a map view of geotagged photos is optional.
- **Light Table**: a separate window for side-by-side comparison, supporting every format including RAW. Place selected items with Ctrl+L, add with Ctrl+Shift+L, open with Shift+L, or pick from the thumbbar. formtools note: copy the "send to light table" action and its shortcuts as a pattern.
- **Light Table advanced**: focus-point overlay shows camera autofocus regions on previews so you can see what should be sharp; left and right sidebars show metadata for the left and right image (properties, metadata, colors, maps, captions, versions); ratings, color labels, tags and face actions from the preview context menu. formtools note: autofocus-point overlay and side-by-side metadata are a culling workflow, a strong differentiator. (single source)
- **Color management**: ICC profiles in browsing, color managed throughout the editor. formtools note: align with matrix.
- **Metadata**: tags, comments, geolocation editor, metadata editor as plugin. formtools note: tag and rating as first-class culling data.
- **RAW**: LibRaw decoding with its own defaults, hand-off to external editors (darktable, RawTherapee), import converts to DNG, batch queue does RAW processing. formtools note: external-editor hand-off keeps scope small. (single source)
- **Sync of pan and zoom between the two light table images**: not confirmed on the pages fetched.

## Not verified

- Light Table synchronization details, shortcut list beyond the above, performance mechanisms.

## Sources

- https://www.digikam.org/about/features/
- https://docs.digikam.org/en/light_table/lighttable_overview.html
- https://docs.digikam.org/en/light_table/lighttable_advanced.html
