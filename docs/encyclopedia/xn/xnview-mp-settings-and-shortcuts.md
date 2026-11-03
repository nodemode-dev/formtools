# XnView MP: settings, shortcuts, integration

Source tags: see xnview-mp-overview.md. The default shortcut table is NOT fully verified: only keys quoted in the 2017/2018 guides, the FAQ and the French 2017 course are listed, and they may have changed since. Labels differ by era ("Options" earlier, "Settings" now; F12 opened it in v0.88 per EDELIN).

## 1. Settings categories seen in sources

| Category | Known contents | Source |
|---|---|---|
| General | Start folder (none/last), startup behaviour, language | EDELIN |
| Interface | Toolbar editor (separate Browse and View toolbars, add/remove/reorder), Shortcuts tab, Mouse actions (wheel, horizontal scroll, prev/next separate action), themes (dark theme, custom styles) | GUIDE, REL |
| Browser / Explorer | Thumbnail settings, tooltip template, columns for details view, selection of first file at startup, sort behaviour | SEIBERT, REL |
| Thumbnails | Size, Labels (fields shown under thumbnail, colors), overlay icons, alignment, cache | GUIDE, SEIBERT |
| View | Misc (Quick Slideshow interval), color management (working space), zoom-out anti-aliasing, full screen options | GUIDE, FAQ, REL |
| Metadata | Import keywords, export DB categories to XMP subject / IPTC keywords, create XMP/IPTC data, export rating and color label to XMP, Labels (color label names), companion/sidecar options, encoding (UTF-8), face import | GUIDE, ORCH |
| Catalog | Managed folder list, import folder, delete all, thumbnail cache delete, size, maintenance tab, database tools | GUIDE, ORCH, REL |
| Formats | Per-format read and write options (JPEG quality, metadata keep flags, etc.); File > Format settings opens same page | SEIBERT |
| Integration | File associations, Windows ProgramData setting, external "open with" commands (macOS parameters fix in 1.11.x) | FAQ, REL |
| Other | Ini-file tweaking (xnview.ini, link in About), single-instance open options, no-DPI-scaling command-line switch (-noDpiScaling) | REL |

## 2. Storage and portability

* Settings, shortcuts and the catalog live in a per-user profile folder; a portable zip lets the user keep them beside the executable. Paths per FAQ (single source): %APPDATA%\XnViewMP, ~/.config/XnViewMP, ~/.xnviewmp. Catalog DB file named XnView.db (ORCH). SITE, ORCH.
* Layouts (A, B, C slots), sessions (open tabs), and toolbars are user-savable. GUIDE, REL.

## 3. Keyboard and mouse (as documented, era-tagged)

| Action | Key | Source / era |
|---|---|---|
| Open selected in viewer | Enter, double-click | GUIDE 2017 |
| Select all | Ctrl+A | GUIDE |
| Search dialog | Ctrl+F | GUIDE |
| Tag/check current | Ctrl+T | GUIDE |
| Show tagged files | Shift+T | GUIDE |
| Edit IPTC/XMP | Ctrl+I | GUIDE, SEIBERT |
| Save | Ctrl+S | GUIDE |
| Save As | Ctrl+Shift+S | GUIDE |
| Export | Ctrl+Alt+S | GUIDE, SEIBERT |
| Resize dialog | Shift+S | FAQ (single source) |
| Compare | Shift+C | EDELIN (v0.88) |
| Move to folder | Alt+M | EDELIN (v0.88) |
| Screen capture | F1 default (Shift+F1 suggested) | GUIDE |
| Settings | F12 | EDELIN (v0.88), unverified for 1.12 |
| Full size 100% | * | GUIDE |
| Fit/unfit toggle | / | GUIDE |
| Next/previous image | Right/Left arrow | GUIDE |
| Page flip | Page Up / Page Down | FAQ |
| Quick zoom | Shift + right mouse (older) | not re-verified |
| Mouse | Wheel zoom or navigate (configurable), Alt+wheel zoom, middle button/horizontal scroll options | REL |

Every item is rebindable in Settings > Interface > Shortcuts; toolbar buttons can be bound to metadata templates. GUIDE, ORCH.

## 4. Command line and scripting

* Launch arguments: file names open as a list; parameters exist for opening a file list in the viewer (viewlist, 1.11.5), a no-DPI-scaling switch, and Windows long path handling. There is no embedded scripting language in the sources. REL.
* Automation is by batch presets, templates and the NConvert CLI (XnConvert exports a job to an NConvert command line). SITE.
* Windows shell integration via the separate XnShell extension (preview and context menu operations). SITE.

## 5. Localization and themes

Plain-text translation files exist, translations contributed on the forum; dark theme and custom themes are in the build. SITE, GUIDE.

formtools note: model settings as typed schema with categories, user-rebindable actions with a registry (action id, default key), profile-folder or portable-mode switch, and a parameterised CLI that opens lists in the viewer.

## Sources

* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
* https://www.xnview.com/download/GestionWorkflowPhotos_171119.pdf
* https://www.carlseibert.com/xnview-metadata-how-to/
* https://orchisere.fr/logiciels/html/xnviewmpintro.htm
* https://www.xnview.com/en/faq/
* https://www.xnview.com/en/xnshell/
* https://www.xnview.com/en/nconvert/
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=51463
* https://newsgroup.xnview.com/viewtopic.php?t=50659
