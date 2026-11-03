# Font Viewers and Managers

Research date: 2026-11-03.

## macOS Font Book

- Formats: TrueType (.ttf), variable TrueType, TrueType Collection (.ttc), OpenType and OpenType-SVG (.otf), OpenType Collection. Legacy suitcase and PostScript Type 1 may work but are discouraged.
- Install: File > Add Fonts to Current User, drag onto the Dock icon or window, or double-click in Finder and confirm. Install scope is per user or all users, set by a default-location preference.
- Validation: runs automatically on install and checks for duplicates. Manual: Validate Selection or Validate File. Results are color coded (pass, warning, failure); a filter shows only warnings or errors; failed fonts can be removed from the list in one action.
- Other documented areas: collections and libraries, activate or deactivate, remove, export, restore system fonts, troubleshooting. Preview modes and duplicate resolution were not detailed on the pages fetched.
- formtools note: three-state validation (pass, warn, fail) with a filter is a simple, learnable report format.

## Windows font handling

- Microsoft's font install and Font Validator pages could not be fetched in this run, so Windows viewer behavior and validator status are not documented here. (unverified)
- formtools note: plan the Windows path around per-user install without needing admin, but confirm against Microsoft docs before shipping.

## FontBase

- Mac, Windows, Linux. Core is free: collections, watched folders (fonts appear without moving files), OpenType feature toggles, a Playground for previewing styles and exporting CSS, a glyph viewer, instant search, specimen pages, Google Fonts on demand (used as if local), activation without installing, autoactive folders, deactivate-on-close.
- Paid "Awesome" tier: license seat tracking, team management, auto-activation in Adobe apps, tags, search by contrast/proportion/x-height/weight, cloud sync via Dropbox or Google Drive, grid view, themes. Prices not listed on the page. Proprietary status not stated. (single source)
- formtools note: watched-folder activation (no copy, no install) is the feature that distinguishes a manager from a viewer.

## Open-source engines for a font module

| Engine | Use | License |
|---|---|---|
| FreeType | rasterize glyphs, read many formats | FTL (BSD-style with credit) or GPLv2, your choice |
| HarfBuzz | OpenType shaping, subsetting (`hb-subset`), CLI `hb-shape` and `hb-view`; no hinting | license file in repo (MIT, not confirmed on page) |
| fontTools | read/write TTF/OTF/WOFF/WOFF2, TTX XML dump, optional UFO | MIT |
| OTS (OpenType Sanitizer) | validate and sanitize OTF, TTF, WOFF, WOFF2; used in Chromium and Firefox | BSD-3-Clause |

- formtools note: run untrusted fonts through OTS-style sanitizing before handing to system rasterizers; font parsers are a classic attack surface.

## Feature checklist for the viewer

1. Specimen text with editable sample string, size slider, weight/width axes for variable fonts.
2. Glyph grid grouped by Unicode block with codepoint, name, and advance metrics.
3. Metadata: family, style, version, license string, designer, languages and scripts covered.
4. OpenType feature toggles (ligatures, small caps, stylistic sets).
5. Validation report and duplicate detection by PostScript name.
6. Install or activate temporarily; export WOFF2 and CSS snippet (FontBase Playground model).

## Sources

- https://support.apple.com/guide/font-book/welcome/mac
- https://support.apple.com/guide/font-book/install-and-validate-fonts-fntbk1000/mac
- https://fontba.se/
- https://github.com/fonttools/fonttools
- https://github.com/khaledhosny/ots
- https://github.com/harfbuzz/harfbuzz
- https://freetype.org/license.html
