# XnShell Extension

## What it is
A Windows Explorer shell extension that adds image previews and operations to the right-click menu. Version 4.2.5. Bundled with XnView Classic Extended (as ShellEx) and also downloadable alone.

## Platforms and files
Windows only. Setup exe and zip for 32-bit (XnShellEx) and 64-bit (XnShellEx64); the site calls the zips portable. Supported Windows versions are not stated on the page.

## Behaviour (assembled from forum threads, partly dated)
- The context menu shows a small thumbnail preview of the image with the filename; choosing it (Enter or click) opens the file in XnView. This is how older versions worked (v1.8x thread).
- A submenu option exists with variants "submenu without preview" and "all"; the preview style is the older owner-drawn UI which can render oddly on Windows 10 in the no-preview mode.
- Operations offered: convert from the menu (a "Convert..." entry that writes new files; 4.1.11 fixed a bug where outputs got current time instead of the source timestamp) and set wallpaper (older versions).
- Current menu entries (gap pass 2026-11-03, read from the language file shipped in the vendor's XnShellEx64 4.2.5 zip, English section). The settings page has a "Displayed Menu items" list; the items it names are: Thumbnail (image), Image Information, Filename, Edit IPTC, Set Wallpaper as (with Best fit to desktop, Centered, Fit to desktop), Clipboard (Copy to Clipboard), Convert ("Convert into" a chosen format plus "Convert..." with per-format settings for JPEG, PNG, GIF, PCX, BMP, TGA, TIFF, PDF and WebP), Rotate (+90 right, -90 left, 180, flip horizontal, flip vertical, rotate by EXIF tag), Resize (preset sizes 320x200, 640x480, 800x600, 1024, 50% and 25%, with an "Overwrite when resizing" option and a sizes list file named XnViewShellExt-Resize.txt in the install folder), Mosaic, Go to folder, and File's Icon. A "Send to ImageShack" entry is still in the strings but that service is gone. Which items are on by default is not stated.
- Menu layout choices: "No sub-menu", "Sub-menu without preview", "All", "Custom"; "Show filename (menu)" and "Use sub-menu" are separate settings. Other settings: high-quality thumbnails, no thumbnail for EPS/PDF, thumbnail size and size cap, use embedded thumbnail, recognise format by extension, use XnView to open the picture (or an associated or custom program), use EXIF rotation, keep EXIF and IPTC, keep original date and time, sub-folder for converted files, output folder, output format. Convert warns before lossless JPEG rotation changes the original file and before processing more than a set number of files.
- The package registers with regsvr32 on XnViewShellExt64.dll (register.bat and unregister.bat are included); the zip is therefore the portable install path.
- Windows 11: the menu appears only in the classic ("show more options") menu, not the new primary one. User reports in 2023 and 2025, and in Nov 2025 the vendor author answered a user by pointing to guides for disabling "show more options", which confirms the behaviour (now two sources, one vendor).
- Known issues reported: HEIC support dropped in 4.1.10 for one user; stray "f" instead of image size in the menu in 4.2.0.0; no WebP preview request pending.
- No official changelog exists; the author stated he has none for XnShell. The vendor's version archive does give dated 64-bit builds: 4.1.10 on 2023-10-17, 4.1.14 on 2025-04-24, 4.2.0 on 2025-06-19, 4.2.5 on 2026-01-13.

formtools note: a Windows-only shell extension is a separate native module; on Win11 target the modern IExplorerCommand menu to avoid the "show more options" limitation.
formtools note: the thumbnail-in-menu plus convert-in-place pattern is the useful idea; keep entries few and configurable.

## Licensing
Freeware, no adware or spyware per page; donations optional.

## Could not verify
Which menu items are enabled by default; the visual layout of the settings dialog (only its label strings were read); Windows version support; current format coverage (the shipped plugin folder was not enumerated).

## Sources
- https://www.xnview.com/en/xnshell/
- https://newsgroup.xnview.com/viewtopic.php?p=24975 (old behaviour)
- https://newsgroup.xnview.com/viewtopic.php?p=126963
- https://newsgroup.xnview.com/viewtopic.php?p=197062 (user-reported, single source for Win11 and version issues)
- https://newsgroup.xnview.com/viewtopic.php?p=200718
- https://forum.xnview.com/viewtopic.php?p=172186 (no changelog statement)
- https://download.xnview.com/XnShellEx64.zip (vendor package, 4.2.5; language file and readme read, DLL not run)
- https://download.xnview.com/versions/XnShellEx/ (vendor archive with dates)
- https://newsgroup.xnview.com/viewtopic.php?t=49735 (vendor reply on Windows 11 menu)
- https://newsgroup.xnview.com/viewtopic.php?t=44641 (Windows 11 menu report)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to forum, wiki gone)
