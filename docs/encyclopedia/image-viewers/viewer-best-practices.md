# Viewer best practices: features users repeatedly rank as essential

Method: evidence is limited to vendor release notes, official docs and the most-reacted open and closed requests on each project's own issue tracker (reaction counts fetched via the GitHub search API). These are signals of demand, not a survey, and reaction counts are small. No opinion pieces, forums or listicles are used. Items below appear in at least two independent places.

## 1. Fast open and fast next/previous

- Evidence: qView's most-reacted issue is slow image loading and switching (16 reactions); ImageGlass has two launch/display speed issues in its top ten (18 and 10 reactions); qView 6.0 and ImageGlass both answered with preloading or caching and Turbo mode; Microsoft quantified a faster viewer open as the headline of its 2026 Photos rebuild (about 15%, up to 30% for HEIC, vendor test).
- formtools note: prefetch in navigation direction, cache decoded neighbours, show embedded preview first; publish benchmarks.

## 2. Wide, modern format coverage including animated formats

- Evidence: ImageGlass top requests include animated WebP (16), APNG (21) and SVG scaling (21); nomacs top requests include JPEG XL (8) and APNG (6); qView asked for AVIF (5) and later added RAW, HEIF, AVIF, JXL; BandiView 8.x and IrfanView 4.76 both added animated AVIF.
- formtools note: SVG, APNG, animated WebP and AVIF, JXL, HEIC and RAW preview are launch requirements.

## 3. Navigation by mouse wheel, keys and side buttons, with a Delete key

- Evidence: qView issues for wheel navigation (several, 4 to 6 reactions each) and DEL key support (11, closed); nomacs request for wheel scrolling (6); gThumb 3.12 added back and forward mouse buttons; Gwenview documents arrow-key behavior that switches image at fit and scrolls when zoomed.
- formtools note: configurable wheel behavior (zoom versus navigate), Delete to trash, mouse side buttons.

## 4. Zoom that stays put: lock zoom, lock pan, keep position, cursor-anchored

- Evidence: ImageGlass lock-pan request (12) beside its lock-zoom mode; nomacs "keep zoom should also keep position" (6); qView open-at-100% request (4); gThumb 3.12 anchors zoom at the pointer; Gwenview offers three zoom-persistence modes; BandiView has a lock-zoom key.
- formtools note: fit, fill, width, height, 100%, lock zoom and lock pan, all one key.

## 5. Correct color: ICC profiles and CMYK

- Evidence: nomacs shipped color management and CMYK in 3.22 and still has an open issue to improve it (6); qView added profile support in 6.0 and fixed CMYK/ICC in 7.0; ImageGlass 10.0 line fixed CMYK and monitor-profile bugs and 10.1 beta targets color-managed speed; Loupe added profile and CICP details and CMYK display fixes in 2026.
- formtools note: on by default, per-monitor, with the profile described in the info panel.

## 6. Lossless rotate and non-destructive behavior

- Evidence: IrfanView documents lossless JPEG rotate and crop, gThumb lists lossless JPEG transformations, Gwenview's handbook lists lossless transformations, Loupe rewrites only the orientation tag; nomacs has a closed issue about silently altering timestamps and metadata (5).
- formtools note: lossless first, never touch files unless saved.

## 7. HDR display that follows the OS

- Evidence: Windows Photos 2026 improves HDR display and preserves HDR in edits; BandiView 8.02 follows Windows 11 HDR calibration and adds tone mapping; ImageGlass 10 has HDR tone mapping and SDK HDR support for codec plugins.
- formtools note: tone-mapping controls for SDR displays and HDR passthrough where the OS supports it.

## 8. Archive and comic reading

- Evidence: ImageGlass open request to view images inside compressed archives (19, still open); qView comic/manga reading request (5, open); BandiView and MaxView ship archives, double-page and webtoon modes; nomacs added ZIP reading.
- formtools note: stream entries, support CBZ and CBR, double-page with RTL, vertical continuous mode.

## 9. Metadata panel and ratings

- Evidence: ImageGlass star/flag/bookmark request (13, open); nomacs filter by star rating (6, open); Windows Photos 2026 info panel with histogram and map; digiKam Light Table side-by-side metadata.
- formtools note: one info panel with EXIF, histogram, map, rating and flag, filterable.

## 10. Chrome options for power users: frameless, always on top, single instance

- Evidence: nomacs always-on-top for frameless mode (13), single instance (7, shipped in a 3.23 beta); qView single instance (5) and window-bar visibility (5); ImageGlass frameless resize (7).
- formtools note: frameless and pinned modes plus single-instance reuse.

## Sources

- https://api.github.com/search/issues?q=repo:d2phap/ImageGlass+type:issue+sort:reactions-%2B1&per_page=15
- https://api.github.com/search/issues?q=repo:jurplel/qView+type:issue+sort:reactions-%2B1&per_page=15
- https://api.github.com/search/issues?q=repo:nomacs/nomacs+type:issue+sort:reactions-%2B1&per_page=15
- https://github.com/jurplel/qView/releases
- https://github.com/d2phap/ImageGlass/releases
- https://github.com/nomacs/nomacs/releases
- https://blogs.windows.com/windowsexperience/2026/10/15/meet-the-new-photos-app-on-windows-11/
- https://en.bandisoft.com/bandiview/history/
- https://www.irfanview.com/main_history.htm
- https://mail.gnome.org/archives/gnome-announce-list/2021-September/msg00014.html
- https://docs.kde.org/stable5/en/gwenview/gwenview/view_mode.html
- https://docs.digikam.org/en/light_table/lighttable_advanced.html
- https://blogs.gnome.org/sophieh/2026/10/30/gnome-fellowship-october-2026/
- https://thisweek.gnome.org/posts/2024/06/twig-153/
