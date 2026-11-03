# Command Palette (CmdPal)

Snapshot: PowerToys 0.102.x. Part 1 (A to F). The successor to PowerToys Run (part 2); the repo README still labels it a preview with possible breaking API changes before 1.0.

## What it does

A keyboard launcher and command surface: start apps, run commands, search files, calculate, search the web, change Windows settings, manage services and the registry, switch windows, browse clipboard history, and more, all through extensions. 0.102 adds a compact search box with a quick-access shelf, and a Dock.

## Activation

- Default: Win+Alt+Space (also confirmed in source). Changeable in settings.
- Can be chosen as the app opened by the Copilot key (repeat presses toggle it, 0.102).
- Must be enabled from the PowerToys Home page and running in the background.
- In-list shortcuts: Alt+1 to Alt+9 run the visible item (configurable to select instead); Alt+Shift+1 to 9 select without running; Ctrl+Enter secondary command; Ctrl+K context menu; Ctrl+Shift+Enter run as administrator (apps, Run, Terminal, PowerToys, bookmarks, file search; for files and bookmarks only .exe, .bat, .cmd, .msc, .cpl).
- Query prefixes: `>` run command, `??` web search, `$` Windows settings, `=` calculator, `file` plus space for file search.

## Built-in capabilities

Apps launcher; shell commands; file and folder search (Windows indexer); web search; calculator (same engine as the PowerToys Run calculator, includes rand, randi, sign, logn, root and so on); Windows Settings pages (including Windows Update pages); WinGet search and install; window switcher (Window Walker); clipboard history; time and date (custom clocks); Windows services; Windows Terminal profiles; Registry lookups; Remote Desktop connections; system performance (CPU, memory, network usage and speed, disk, GPU, battery); system commands (restart, empty Recycle Bin, update-and-restart when pending); jump into other PowerToys modules; bookmarks (files, folders, URLs, shell commands, with `{query}`-style placeholders prompted inline); Actions.

Built-in extension projects in the repo (19): Actions, Apps, Bookmark, Calc, ClipboardHistory, Indexer, PerformanceMonitor, PowerToys, Registry, RemoteDesktop, Shell, System, TimeDate, WebSearch, WinGet, WindowWalker, WindowsServices, WindowsSettings, WindowsTerminal (single source: `src/modules/cmdpal/ext`). Sample extensions (SamplePagesExtension, ProcessMonitorExtension) ship alongside.

## Home, shelf and Dock

- Home page: top commands, recent items, Pinned commands (right click to pin, reorder, unpin); recents can show after pinned.
- Quick access shelf (opt-in, compact mode only): pinned and optionally recent commands beneath the collapsed search box; drag to reorder, drag recents to Pin to home, drag to Remove from quick access; right click for shelf settings or hide.
- Dock: persistent toolbar on a screen edge, using the Windows AppBar API so windows do not overlap it (restores itself if Explorer restarts). Three regions: Start (Home, WinGet launcher), Center (empty), End (Performance Monitor, Network Speed, Date/Time bands). Per-display docks and per-display band sets (a new display copies the primary layout, later edits stay local). Edit mode via right click > Edit Dock, drag bands between regions and monitors, Show Titles and Show Subtitles toggles, drop a file or URL to create and pin a bookmark. Focus the Dock with Win+Alt+J (Shift reverses), Enter or Space activates, Esc leaves. Bands: Time and Date (clock, notification centre, custom clocks with time zone and format strings), Performance Monitor items; extensions can add bands. Cannot be resized or dragged; position is a setting.

## Settings

General: activation shortcut; low-level keyboard hook (may help responsiveness, may clash with other software); ignore the shortcut in fullscreen, optionally by heuristic fullscreen/presentation detection, with "press 3 times in 2 seconds to override"; return home after closing (never, immediately, 10 to 180 seconds); select search text on open; keep search text when reopened; preferred monitor (mouse cursor, primary, focused window, in place, last position); Escape behaviour (clear then back, always back, always dismiss, always hide); auto-expand app details; Backspace goes back on empty search; single-click activation; show in tray; quit with Alt+F4 (default off); disable page transition animations; enable external reload through the `x-cmdpal://reload` URI; app language (restart needed).
Personalisation: app theme (light, dark, system); backdrop (Acrylic default, Transparent, Mica, Mica Alt) and opacity; colourisation mode, custom colour and intensity; background image with opacity, tint, blur, brightness, fit; compact search box (default off) with vertical position (default 75); on-screen indicator position.
Dock: enable; navigation shortcut (Win+Alt+J); focus primary dock first (off); cycle through all docks (on); remember last focused item (on); position (Left, Top default, Right, Bottom, per-display override); size (Default, Compact for top and bottom only); theme (system default); material (Transparent, Acrylic default); background colourisation (none, accent, custom colour, image with brightness -100 to 100, blur 0 to 50, fit fill or stretch); always on top (not over fullscreen apps); auto-hide (falls back to pinned if the taskbar or another app already auto-hides on that edge); per-monitor toggle, display name, position override.
Extensions: Gallery (curated feed, installs through WinGet, community list in the `CmdPal-Extensions` repo), Installed (enable/disable, per-extension settings, aliases, global hotkeys). Command links let a command, page or setting be opened from a URL or script.

## Extension model (how it works internally)

- Extensions are separate .NET apps in their own process, packaged with an appxmanifest declaring a COM server and an app extension named `com.microsoft.commandpalette`. CmdPal finds them through the Windows package catalogue.
- The contract is a WinRT API (`Microsoft.CommandPalette.Extensions`); the repo README says any language that can implement WinRT interfaces can write one, while the docs describe the C# toolkit (`Microsoft.CommandPalette.Extensions.Toolkit`) and a template via the "Create extension" command.
- Key interfaces: `IExtension.GetProvider` returns an `ICommandProvider`, which supplies top-level commands, fallback commands (when nothing else matches), context menu items and pages. Page types: list, detail, form (Adaptive Cards), markdown, grid. Extensions can have settings pages and pin to the Dock.
- Only `<Commands />` is a supported interface in the manifest today; the class id must match in three manifest places.
- The UI is WinUI 3, hosted separately from the runner (runs as its own packaged app). 0.102 replaced native keyboard and Run-history dependencies with managed code and virtualized result lists.

## Limitations

- Preview status; API may break before 1.0.
- Shelf only in compact mode and only while collapsed; Dock needs CmdPal running; Dock geometry fixed.
- Elevation shortcut only for supported result types.
- Windows Update commands appear only when an update is pending.

## Group Policy

`ConfigureEnabledUtilityCmdPal`. (PowerToys Run has richer plugin policies; Command Palette has none beyond enabled state in the docs table.)

## Cross-platform note

(Analysis.) macOS has Spotlight, Raycast and Alfred as direct competitors; implementing a launcher means a borderless panel (NSPanel), a global hotkey via Carbon or an event tap, an app index from LaunchServices, Spotlight metadata queries for files, and Accessibility for window switching. Linux: global shortcuts are the hard part on Wayland (use the xdg-desktop-portal GlobalShortcuts portal, or a compositor binding that runs `formtools --toggle`); app index from `.desktop` files; file search via Tracker or a custom index; layer-shell or a plain always-on-top window for the surface. The extension idea (out-of-process providers exposing commands and pages over a typed IPC) maps well to JSON-RPC over stdio or a local socket, which is language-neutral and works on all three OSes. The Dock maps to a macOS menu bar/Dock-like panel or a Linux layer-shell bar, and is the least portable part.

## formtools note

Adopt the provider-and-page extension contract (list, detail, form, markdown, grid) over out-of-process JSON-RPC, and start with a compact palette only; defer the Dock.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/overview
- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/settings
- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/dock
- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/extensibility-overview
- https://learn.microsoft.com/en-us/windows/powertoys/command-palette/finding-and-installing-extensions
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `src/modules/cmdpal/README.md`, `src/modules/cmdpal/ext` (directory listing), `src/settings-ui/Settings.UI.Library/CmdPalProperties.cs`
