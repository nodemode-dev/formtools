# FancyZones

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

A window layout manager. You define zones (rectangles) on each monitor; dragging a window with a modifier, or using keyboard shortcuts, snaps it into one or several zones.

## Activation and shortcuts

| Action | Default |
|---|---|
| Show zones while dragging | hold Shift while dragging (setting "Hold Shift key to activate zones while dragging", on by default; turning it off inverts: zones show immediately and Shift disables snapping) |
| Toggle zones with a non-primary mouse button | optional |
| Span multiple zones | hold Ctrl after a zone is active, or the middle mouse button (option), or hover the shared edge of two zones to take their union |
| Open layout editor | Win+Shift+` |
| Keyboard move between zones | Win+Arrow (needs "Override Windows Snap"; "Zone index" overrides only Left/Right, "Relative position" overrides all four) |
| Expand across zones | Win+Ctrl+Alt+Arrow (relative position mode) |
| Cycle windows sharing a zone | Win+PgUp / Win+PgDn (window switching on by default) |
| Apply a custom layout by number | Win+Ctrl+Alt+0-9 (quick layout switch) |
| Rotate windows to the adjacent monitor | Alt+X (rotation mode, off by default), then Left/Right |
| Switch layout while dragging | mouse wheel (new in 0.102, off by default) or a layout's hotkey |
| Move window to another monitor | Win+Shift+Arrow (not overridden by FancyZones) |

## Layouts and the editor

- Templates (source enum): Blank, Focus, Columns, Rows, Grid, Priority Grid, plus Custom. Template defaults: 3 zones, spacing shown at 16 px, sensitivity radius 20 px.
- Custom layouts come in two kinds:
  - **Grid**: starts as three columns; split zones by clicking, move dividers (drag the thumb or arrow keys), rotate a divider by holding Shift, merge by selecting multiple zones then Merge, or Delete on a divider. Percent-based, so it scales across monitor sizes. Data holds row and column percentages and a cell map.
  - **Canvas**: free rectangles that may overlap; move 10 px with arrows (1 px with Ctrl), resize 10 px with Shift+arrows (2 px with Ctrl+Shift). Data holds absolute rectangles plus the work-area size they were drawn for.
- Editor flow: pick a monitor, pick a layout (applies at once; double-click applies and closes), "Create new layout". Per layout: name, spacing toggle and size, sensitivity (distance to highlight adjacent zones), quick-switch hotkey 0-9.
- Overlapping zones resolution (setting "When multiple zones overlap"): smallest, largest, positional or closest centre (source enum; default smallest).

## Settings (grouped)

Activation and input: activation behaviour (above), non-primary mouse toggle, middle-click spanning, mouse-wheel layout switching (off), open editor on the display with the cursor (source default on).
Multi-monitor: show zones on all monitors while dragging (off; may cost performance), allow zones to span across monitors (treat as one screen; needs identical DPI scaling), overlap algorithm.
Appearance: use system theme colours or custom (highlight #0078D7, inactive #F5FCFF, border #FFFFFF, number #000000 in source defaults), show zone number (on), opacity 50 percent, make dragged window transparent (off).
Layout name indicator: on by default, position (top centre default), text #FFFFFF, background #262626, size 36 (range 8 to 128), padding 12 (0 to 64), duration 1500 ms (300 to 10000), flash zones on quick switch (on).
Window behaviour: keep windows in zones when the resolution changes (on), re-fit snapped windows when the layout changes (off), move new windows to the app's last zone (off), or to the active monitor (off), restore original size on unsnap (off), allow popups and child windows (off, off), disable rounded corners when snapped (Windows 11 only, off), excluded apps (partial matching, one per line).
Window switching: enable (on), next/previous hotkeys (Win+PgDn, Win+PgUp), rotate across monitors with its shortcut (Alt+X).
Keyboard snapping: override Win+Arrow, zone index vs relative position, move across all monitors.
Layout defaults: default layout for horizontal and vertical monitors, quick layout switch (on).
Editor: space around zones, highlight-distance.

## Per-monitor and virtual desktop behaviour

Layouts are assigned per work area, keyed by monitor identity (device id, instance, serial number, monitor number) **and virtual desktop id** in the applied-layouts store (source field names `device-id`, `monitor-instance`, `serial-number`, `monitor-number`, `virtual-desktop`). Learn does not document virtual desktops beyond a compatibility entry for Windows Virtual Desktop (the cloud product, issue #10018), but the data model clearly supports per-desktop layouts (single source: repo). Different DPI across monitors can leave a non-DPI-aware app a few pixels off an edge.

## Command line (new)

`PowerToys.FancyZones.CLI.exe`: `open-editor` (e), `get-monitors` (m), `get-layouts` (ls, ASCII previews), `get-active-layout` (active), `set-layout <uuid or template> [--monitor n | --all]` (s), `open-settings`, `get-hotkeys` (hk), `set-hotkey <0-9> <layout>` (shk), `remove-hotkey` (rhk). In PowerShell, quote layout GUIDs.

## How it works internally

Repo devdoc: `FancyZones` (thread and module init) wraps `FancyZonesLib` (all drag logic, zone overlay drawn in C++, data types), `FancyZonesEditor` (WPF editor, `MainWindow.xaml`, GridEditor, CanvasEditor) with `FancyZonesEditorCommon` (data I/O), and a module interface for the runner. Windows event hooks and a keyboard hook detect move/size start and hotkeys; hit-testing picks zones using the sensitivity radius and the overlap algorithm. State is JSON in `%LocalAppData%\Microsoft\PowerToys\FancyZones\`: `editor-parameters`, `applied-layouts`, `custom-layouts`, `default-layouts`, `layout-hotkeys`, `layout-templates`, `app-zone-history`. File watchers push editor changes into the running module. `custom-layouts.json` can be hand-edited or shared, though Microsoft advises against it. Debug tools (HitTest, zonable tester, StylesReportTool) exist in the repo. The extra "zonable" checks decide which windows can be snapped.

## Limitations

- Elevated apps (Task Manager, some terminals) need PowerToys elevated; FancyZones runs inside the runner process.
- Fails with apps that do not raise the move/size start event: Application Guard, VMware Workstation Player, and others (Citrix, Hyper-V Connection, Parsec, RemoteApp, TeamViewer driver issues, and so on, each with a tracking issue).
- RivaTuner Statistics Server blocks the editor (#707). Screen capture tools (ShareX, Screenpresso) may need excluding.
- Mouse-wheel switching cycles only custom layouts.

## Group Policy

`ConfigureEnabledUtilityFancyZones`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) The layout model (grid with percentages, canvas with rectangles, per-monitor and per-desktop assignment, JSON files) is completely portable and is the valuable part. The enforcement is not: macOS needs the Accessibility API to read and set other apps' window frames (permission prompt) and an event tap for the drag modifier, with Spaces having no public API (so per-desktop layouts are hard); Linux X11 can do it through EWMH and XInput; Linux Wayland has no generic way to move other apps' windows, so it needs compositor extensions (KWin scripts, GNOME Shell extension, wlroots protocols). Existing macOS tools (Rectangle, Magnet) show the Accessibility route works.

## formtools note

Make the layout editor and layout file format the product (importable and shareable), and treat window enforcement as a pluggable backend with honest capability flags per OS and compositor.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/fancyzones
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `doc/devdocs/modules/fancyzones.md`, `doc/devdocs/modules/fancyzones-tools.md`, `src/settings-ui/Settings.UI.Library/FZConfigProperties.cs`, `ConfigDefaults.cs`, `src/modules/fancyzones/FancyZonesLib/Settings.h`, `FancyZonesDataTypes.h`, `FancyZonesData/LayoutDefaults.h`, `FancyZonesData/AppliedLayouts.h`, `VirtualDesktop.h`, `Layout.cpp`
