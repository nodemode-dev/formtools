# Bulk Renamers

Research date: 2026-11-03. PowerRename is referenced only for contrast; the suite already covers it.

## Baseline: PowerRename (contrast)

- Windows only, Explorer context menu. ECMAScript regex (optional Boost for lookbehind), `$1` capture groups, counters (`${start=}`, `${increment=}`, `${padding=}`), random values, date parts, EXIF/XMP variables such as camera model and ISO, live preview, Explorer undo.

## Advanced Renamer

- Windows and macOS. Methods apply in list order and can be chained into one rule. The site lists 14 methods: Add, List, List replace, Move, New case, New name, Remove, Remove pattern, Renumber, Replace, Script, Swap, Timestamp, Trim. (The site text says 13; the list shows 14.)
- Tag system: categories for Filename, Number, Data, File info, Datetime (created, modified), Image, Video, Audio, Document, GPS location; modifiers like a lowercase suffix; fallbacks such as an artist tag with a default value after a pipe.
- Metadata sources include EXIF, XMP, ID3, video tags, and GPS-based city/state/country lookup (credits ExifTool and Geonames).
- Modes: rename, copy, move. Features: live preview, undo of batches, saved presets, JavaScript-generated names, a command line batch runner, timestamp changes.
- Pricing and license: not stated on the pages fetched; check the license terms page. (single source)
- formtools note: the ordered method stack plus a tag grammar with modifiers and fallbacks is the model to copy.

## Bulk Rename Utility (Windows)

- Single-window design with panels: Regular Expressions, Replace, Case, Remove, Add, Auto Date, Append Folder Name, Numbering, Extension, plus attribute and timestamp changes (created, modified, accessed, hidden, read-only, archive).
- Metadata: EXIF for photos, ID3 for MP3, Windows file properties such as width and height. Supports JavaScript for advanced renaming; can create an undo batch file.
- Windows only (XP to 11 and Server 2025; 32-bit, 64-bit, portable). Free for personal home use; businesses need a commercial license.
- The site text did not confirm a CLI. (single source)
- formtools note: it proves the "all panels at once" layout works for power users, but its density is a usability warning for a family app.

## macOS Finder batch rename

- Apple's rename documentation page fetched here did not cover batch rename, so the Replace Text, Add Text and Format (name plus index/counter/date) modes could not be verified from Apple support in this run. (unverified)

## A Better Finder Rename (macOS)

- Commercial, one-time price listed at 29.95 USD with free trial and 60-day refund. Version 12.36 requires macOS 15 or later on Intel or Apple Silicon.
- Fetched page confirmed live preview and batch handling of photos and music; EXIF/ID3, undo, droplets and AppleScript appear only as topic headings. (single source)

## F2 (cross-platform CLI)

- MIT, Go, Windows/macOS/Linux. Dry run is the default; apply with an exec flag. Conflict detection and auto-resolution, undo of any operation.
- Find/replace with regex default, literal mode, replace limit and range, recursion with depth, include/exclude regex, directory-only mode, hidden files, chained find/replace pairs, piping filenames from `find`.
- Variables: extension, filename, modification date parts, auto-increment index with printf-style padding, regex captures, and string transforms such as uppercase. Docs list separate EXIF, ID3, hash, and path variable pages (not read here).
- formtools note: dry-run-by-default with conflict resolution is the safety contract to match in the GUI.

## Cross-tool feature matrix to design from

- Methods: replace, regex, case, add/remove, trim, move/swap segments, numbering, list-based names, script.
- Tokens: name, ext, counters with padding, dates (several sources), EXIF/GPS, audio tags, hash, parent folder.
- Safety: live preview, collision detection, undo batch, dry run, presets.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/powerrename
- https://www.advancedrenamer.com/
- https://www.advancedrenamer.com/user_guide/methods
- https://www.advancedrenamer.com/user_guide/tags
- https://www.bulkrenameutility.co.uk/Main_Intro.php
- https://support.apple.com/guide/mac-help/rename-files-folders-and-disks-mchlp1143/mac
- https://www.publicspace.net/ABetterFinderRename/features.html
- https://github.com/ayoisaiah/f2
- https://f2.freshman.tech/guide/tutorial
