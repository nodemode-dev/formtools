# Bulk Renamers

Research date: 2026-11-03. PowerRename is referenced only for contrast; the suite already covers it.

## Baseline: PowerRename (contrast)

- Windows only, Explorer context menu. ECMAScript regex (optional Boost for lookbehind), `$1` capture groups, counters (`${start=}`, `${increment=}`, `${padding=}`), random values, date parts, EXIF/XMP variables such as camera model and ISO, live preview, Explorer undo.
- formtools note: PowerRename's regex plus counter/date/EXIF variables with a live preview is the baseline feature set; see the powertoys page for its detail.

## Advanced Renamer

- Windows and macOS. Methods apply in list order and can be chained into one rule. The site lists 14 methods: Add, List, List replace, Move, New case, New name, Remove, Remove pattern, Renumber, Replace, Script, Swap, Timestamp, Trim. (The site text says 13; the list shows 14.)
- Tag system: categories for Filename, Number, Data, File info, Datetime (created, modified), Image, Video, Audio, Document, GPS location; modifiers like a lowercase suffix; fallbacks such as an artist tag with a default value after a pipe.
- Metadata sources include EXIF, XMP, ID3, video tags, and GPS-based city/state/country lookup (credits ExifTool and Geonames).
- Modes: rename, copy, move. Features: live preview, undo of batches, saved presets, JavaScript-generated names, a command line batch runner, timestamp changes.
- Licence and price (vendor buy and license pages, 2026-11-03): proprietary. Free for casual or occasional personal use; frequent personal use asks for a personal licence. Any business, government or non-profit use counts as commercial and needs a licence, one per user (one user may use several devices; one per server for automation). The key is a one-time purchase, lifetime, with free updates within the 4.xx range; no subscription. The price is not in the page text (the buy button is served by Paddle), so no figure is recorded. Current release 4.28 (2026-10-27); Windows 10 or later 64-bit, and macOS 11 or later on Apple silicon or Intel.
- formtools note: the ordered method stack plus a tag grammar with modifiers and fallbacks is the model to copy.

## Bulk Rename Utility (Windows)

- Single-window design with panels: Regular Expressions, Replace, Case, Remove, Add, Auto Date, Append Folder Name, Numbering, Extension, plus attribute and timestamp changes (created, modified, accessed, hidden, read-only, archive).
- Metadata: EXIF for photos, ID3 for MP3, Windows file properties such as width and height. Supports JavaScript for advanced renaming; can create an undo batch file.
- Windows only (XP to 11 and Server 2025; 32-bit, 64-bit, portable). Free for personal home use; businesses need a commercial license.
- CLI: the FAQ says Bulk Rename Utility is solely a GUI program. A separate free product, Bulk Rename Command (BRC, version 1.3.3.0, 32-bit and 64-bit zips, no installer), is the command-line version, aimed at Windows Scheduler jobs. Its bundled manual (copyright 2007-2008) shows slash-style arguments applied in the order given: /DIR, /PATTERN, /RECURSIVE, /QUIET, /INCLH, /INCLR, /NOFILES, /NOFOLDERS, /SORTDIR, then name operations such as /APPENDDATE, /APPENDFOLDER, /AUTONUMBER, /CHANGECASE, /COPYFIRSTN. Regex uses PCRE. The manual does not describe a dry-run or undo switch (searched for test, preview, simulate, undo), so assume none. Current BRU is 4.1.0.1; the Download page also offers 3.4.4.0 for old Windows.
- formtools note: the order-sensitive argument list is a usable model for a scriptable rename pipeline; add the dry-run default that BRC lacks.
- formtools note: it proves the "all panels at once" layout works for power users, but its density is a usability warning for a family app.

## macOS Finder batch rename

- Apple's rename documentation page fetched here did not cover batch rename, so the Replace Text, Add Text and Format (name plus index/counter/date) modes could not be verified from Apple support in this run. (unverified)
- formtools note: whatever Finder offers, the minimum to match is replace text, add text, and name-plus-counter/date formats, each with a visible preview before applying; verify the exact Finder options on a Mac before copying labels.

## A Better Finder Rename (macOS)

- Commercial, one-time price listed at 29.95 USD with free trial and 60-day refund. Version 12.36 requires macOS 15 or later on Intel or Apple Silicon.
- Fetched page confirmed live preview and batch handling of photos and music; EXIF/ID3, undo, droplets and AppleScript appear only as topic headings. (single source)
- formtools note: a paid macOS incumbent confirms the demand for live-preview batch rename of photos and music; compete on dry-run safety and undo, not feature count.

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
- https://www.advancedrenamer.com/buy
- https://www.advancedrenamer.com/license
- https://www.advancedrenamer.com/download
- https://www.bulkrenameutility.co.uk/Faq.php
- https://www.bulkrenameutility.co.uk/Download.php
- https://www.bulkrenameutility.co.uk/Buy.php
- https://www.bulkrenameutility.co.uk/Downloads/BRC_Unicode_64.zip (manual BRC_Manual.pdf read from the extracted zip)
- https://www.bulkrenameutility.co.uk/Main_Intro.php
- https://support.apple.com/guide/mac-help/rename-files-folders-and-disks-mchlp1143/mac
- https://www.publicspace.net/ABetterFinderRename/features.html
- https://github.com/ayoisaiah/f2
- https://f2.freshman.tech/guide/tutorial
