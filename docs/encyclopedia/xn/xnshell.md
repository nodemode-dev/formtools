# XnShell Extension

## What it is
A Windows Explorer shell extension that adds image previews and operations to the right-click menu. Version 4.2.5. Bundled with XnView Classic Extended (as ShellEx) and also downloadable alone.

## Platforms and files
Windows only. Setup exe and zip for 32-bit (XnShellEx) and 64-bit (XnShellEx64); the site calls the zips portable. Supported Windows versions are not stated on the page.

## Behaviour (assembled from forum threads, partly dated)
- The context menu shows a small thumbnail preview of the image with the filename; choosing it (Enter or click) opens the file in XnView. This is how older versions worked (v1.8x thread).
- A submenu option exists with variants "submenu without preview" and "all"; the preview style is the older owner-drawn UI which can render oddly on Windows 10 in the no-preview mode.
- Operations offered: convert from the menu (a "Convert..." entry that writes new files; 4.1.11 fixed a bug where outputs got current time instead of the source timestamp) and set wallpaper (older versions). The exact current entry list is NOT documented on the site (not verified).
- Windows 11: the menu appears only in the classic ("show more options") menu, not the new primary one (user report, single source).
- Known issues reported: HEIC support dropped in 4.1.10 for one user; stray "f" instead of image size in the menu in 4.2.0.0; no WebP preview request pending.
- No official changelog exists; the author stated he has none for XnShell.

formtools note: a Windows-only shell extension is a separate native module; on Win11 target the modern IExplorerCommand menu to avoid the "show more options" limitation.
formtools note: the thumbnail-in-menu plus convert-in-place pattern is the useful idea; keep entries few and configurable.

## Licensing
Freeware, no adware or spyware per page; donations optional.

## Could not verify
Full menu entry list and settings dialog; Windows version support; current format coverage.

## Sources
- https://www.xnview.com/en/xnshell/
- https://newsgroup.xnview.com/viewtopic.php?p=24975 (old behaviour)
- https://newsgroup.xnview.com/viewtopic.php?p=126963
- https://newsgroup.xnview.com/viewtopic.php?p=197062 (user-reported, single source for Win11 and version issues)
- https://newsgroup.xnview.com/viewtopic.php?p=200718
- https://forum.xnview.com/viewtopic.php?p=172186 (no changelog statement)
