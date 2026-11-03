# Duplicate File Finders

Research date: 2026-11-03.

## Czkawka (and Krokiet)

- Latest release seen: 12.0.1 (2026-07-29). 12.0.0 (2026-06-28) was the last Czkawka GTK release; the project now recommends Krokiet (Slint UI). Cedinia is an experimental Android app.
- Tools: Duplicate Files (by name, size or hash), Empty Folders, Big Files, Empty Files, Temporary Files, Similar Images, Similar Videos, Same Music (tags or content), Invalid Symbolic Links, Broken Files, Bad Extensions (content does not match extension), EXIF Remover, Video Optimizer (crop static borders, convert to efficient formats), Bad Names (special characters and similar).
- Similar videos: 12.0 switched the visual engine to `similario_core` with configurable window count, duration tolerance, subclip detection, and added audio comparison. Frame-based mode is desktop only; Android has audio only.
- Similar images: 12.0 added geometric invariance, so mirrored, flipped and rotated copies can match.
- Hash pipeline: a cheap "prehash" pass (12.0 also hashes the file tail) filters candidates before full hashing; caches persist between runs and are shared across frontends; stopped scans keep computed hashes.
- Safety: reference paths are compared against but never auto-modified; excluded paths and glob-style excluded items; Krokiet has separate trash and permanent-delete buttons, default selection "all except one" per group, invert selection, image compare view.
- CLI: `czkawka_cli` for automation (the CLI stores no config); environment variables override config and cache paths.
- Licenses: core, GTK GUI and CLI under MIT; Krokiet and Cedinia under GPL-3.0-only (Slint requirement). Platforms: Linux, Windows, macOS, FreeBSD, x86, ARM, RISC-V, Android.
- formtools note: copy the "tool per problem" list as a module catalog, and the reference-folder plus prehash-cache design as the safety and speed baseline.

## dupeGuru

- Three scan modes: Standard (filenames or contents), Music (tags or contents) and Picture (fuzzy "picture blocks" that compare image color data, or EXIF timestamps).
- Contents scan groups by size then confirms with MD5. Filename scans split names into words, with a filter-hardness percentage and an optional fuzzy word-similarity setting (0.8 cutoff) that is slower and false-positive prone.
- Picture mode threshold: match when the difference score is at or below 100 minus threshold; 100 means identical.
- License GPL-3.0; Python 3 with Qt (PyQt5); Linux, macOS, Windows. The README says the project still seeks maintainers for macOS, Linux packaging, translations and docs, so maintenance is thin. No CLI mentioned.
- formtools note: expose the "reference vs duplicate" concept and a hardness slider; skip MD5 for new code.

## WinDirStat duplicate view

- WinDirStat (see disk-usage.md) also lists duplicates, with optional sparse hashing that labels sampled matches "Probable duplicates".
- formtools note: label sampled-hash matches as probable and offer a full-hash confirm step before any delete; WinDirStat's `/SaveDupesTo` report flag is a model for scriptable output.

## Design patterns to adopt

1. Staged matching: group by size, prehash partial content, then full hash.
2. Similarity scores with a visible threshold for images and video.
3. Reference folders that are read-only.
4. Move to trash by default; permanent delete is a separate action.
5. Cache hashes keyed by path, size and mtime.
6. Hardlink dedup as an alternative to deletion (WinDirStat offers hardlink deduplication).

## Sources

- https://github.com/qarmin/czkawka
- https://github.com/qarmin/czkawka/releases
- https://github.com/qarmin/czkawka/blob/master/instructions/Instruction.md
- https://github.com/arsenetar/dupeguru
- https://dupeguru.voltaicideas.net/help/en/scan.html
- https://github.com/windirstat/windirstat
