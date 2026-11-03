# Peek

## What it does
Quick system-wide file previewer for the file selected in File Explorer (like macOS Quick Look).

## Activation
Default Space (changed in 0.95), toggles Peek. Left/Right or Up/Down move through files in the folder (or only the selection). In scrollable previews (PDF, Markdown, text, HTML, archives) arrows scroll, and Alt+Left/Right switch files. Esc or Ctrl+W close; Enter opens in the default app; Delete sends the file to the Recycle Bin (confirmation by default; files only, never folders). Tab reaches title bar buttons.

## Supported content
Images, Office documents, videos, web pages, Markdown, text, PDF, archives; source code and developer files (including Unreal .uproject and .uplugin); SQLite (.db, .sqlite, .sqlite3: read-only, table list, columns, up to 200 rows, BLOB sizes); folders (type, size, modified date, file and subfolder counts computed in the background); unknown or extensionless files are tested for text, else a details view.

## Window behavior
Auto-sizes to image dimensions; pin keeps size and position; hover tooltip shows name, size, type, modified.

## CLI
PowerToys.Peek.UI.exe path1 path2 ... (folders allowed; "." previews the current folder); nonexistent paths skipped; exit code 2 if none exist.

## Settings
Activation shortcut (Space); Always run without elevation (helps network shares); Always on top (off); Show Peek icon on taskbar (on); Auto-close on focus loss; Show file preview tooltip; Confirm before deleting (on). Source code (preview feature): Wrap text, Try to format source, Font size, Sticky scroll, Show minimap, Maximum file size in KB (1 to 102400, default 10240; larger files show details).

## How it works
Devdocs: developer-file previews share the FileExplorerCommon project built on the Monaco editor. Other previewer internals are not documented in the pages fetched. A folder scan marks counts incomplete if subfolders are unreadable.

## Limitations
SQLite 200-row cap; size cap on source; inaccessible subfolders skipped; source settings still preview.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS has Quick Look (qlmanage, Space key) natively; Linux has GNOME Sushi and KDE Dolphin previews. A portable Peek would use per-type renderers (image, PDF via pdfium, Monaco/Tree-sitter for code, SQLite via sqlite lib) in a lightweight window. Getting the Finder or Nautilus selection requires scripting or AT-SPI/AppleScript hooks.

## formtools note
Previewer registry keyed by type with a fallback chain (text sniff, then details) is the key design to reuse.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/peek
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/peek/readme.md
