# Disk Usage Visualizers

Research date: 2026-11-03.

## WinDirStat

- Scans drives, folders, network shares and MTP devices with pause/resume and refresh. Visualizations: treemap, sunburst, flame graph. Lists largest files and file-type statistics, finds duplicates (optional sparse hashing that tags sampled matches as "Probable duplicates"), inspects permissions, estimates storage-tier cost by modification age, and can recover deleted files on NTFS, exFAT, FAT with admin rights.
- Cleanup: open, move, delete, Windows cleanup tools, NTFS compression, hardlink deduplication, custom commands.
- CLI: `/SaveTo`, `/SaveDupesTo`, `/SavePermsTo` write reports and exit; `/LoadFrom` reopens a scan; CSV and JSON export in the File menu.
- License GPL-3.0-or-later. Windows 7 through 11 and Server 2008 R2 to 2025; x64, ARM64, x86 MSI, portable; also Store, winget, Chocolatey, Scoop.
- formtools note: report-to-file CLI flags and saved scans make disk usage scriptable.

## WizTree

- Reads the NTFS Master File Table directly for speed (site claims 46 times faster than WinDirStat). Treemap, largest-file search, duplicates, CSV export, hardlinks counted once, scans non-NTFS and network drives too. Windows and, recently, macOS. CLI guides cover CSV export and MFT dump.
- Free for personal use; commercial use needs a paid code, enterprises a separate license. Closed source.
- formtools note: MFT/native-index scanning is a Windows-only optimization; design the scanner interface so a fast backend can be swapped in.

## GrandPerspective (macOS)

- Treemap where area equals size, grouped by folder; views for files, packages or folders; color by name, type, size or dates; filters on path, size, type; search; open, reveal, Quick Look, delete; saved scans; multiple views to compare before and after cleanup; export as image or text; handles Time Machine hard links and cloud files.
- GPL, free from SourceForge; App Store build 2.99 USD. Version 3.8.1 needs macOS 14 or later.
- formtools note: the "compare two scans" view is an underrated way to confirm cleanup worked.

## DaisyDisk (macOS)

- Interactive ring-style map to drill into folders; scan reported around 15 seconds in the vendor's benchmark; drag-and-drop removal with system files protected; scan as admin; counts physically used space excluding clones and hard links; breaks down "Other" and "System Data"; manages snapshots; scans cloud storage (Dropbox, Google Drive, OneDrive, Box).
- 9.99 USD one-time license, macOS 10.13 or newer. Closed source. (single source)
- formtools note: the staging-area-then-delete flow reduces accidental deletion.

## ncdu

- Text-mode analyzer for remote servers. Zig line 2.x (2.9.2, 2025-10-24) is current; C line 1.x (1.22, 2025-03-05) is long-term support. Parallel scanning since 2.5 (opt-in threads), binary export format since 2.6 that supports browsing trees larger than memory. JSON export is also documented; other tools (gdu, tdu) read it.
- MIT. Linux static builds (x86, x86_64, ARM, AArch64), many distro packages, macOS via Homebrew/Fink/MacPorts, unofficial Windows builds.
- formtools note: a serializable scan format is what lets a scan on a NAS be inspected on a desktop.

## dust (bootandy)

- Rust, Apache-2.0, Linux/macOS/Windows. Shows largest subdirectories with bars, depth and count limits, hardlinks counted once, config file. Lists dua, ncdu, pdu and others as alternatives.

## Czkawka Big Files

- One tool of the Czkawka suite (see duplicate-finders.md): finds the largest files in selected locations.

## Common feature set

Treemap or sunburst, drill-down, file-type stats, largest files list, exclusions, hard-link/clone-aware sizes, report export, safe delete (trash first), saved scans.

## Sources

- https://github.com/windirstat/windirstat
- https://diskanalyzer.com/
- https://grandperspectiv.sourceforge.net/
- https://daisydiskapp.com/
- https://dev.yorhel.nl/ncdu
- https://github.com/bootandy/dust
- https://github.com/qarmin/czkawka
