# Workspaces (PowerToys)

## What it does
Saves a set of apps and their window layout and relaunches them together in place with one action. A desktop-layout "project launcher".

## Activation
Win+Ctrl+` (customizable) opens the editor; also "Launch editor" in Settings. Saved workspaces launch from the editor list, a desktop shortcut, or a taskbar-pinned shortcut (pinning the workspace itself is unsupported).

## Capture and launch flow
1. Open editor, choose Create workspace to enter Capture; the desktop stays usable, so arrange apps first.
2. Press Capture.
3. Post-capture edit: name it, resize windows, add CLI arguments, remove apps, create a desktop shortcut, save.
4. Launch: a status dialog shows per-app state (success, in progress, failed, skipped) and can be dismissed or used to cancel.
Editing: Launch & Edit relaunches and reopens Capture. Re-capturing is a clean redo that discards earlier CLI arguments and settings.

## Per-app options
CLI arguments (file path for editors, profile for terminals, comma-separated URLs for browsers), window position, Launch as Admin, Remove. A "Move existing windows" option repositions already-open apps instead of launching duplicates; docs advise using app arguments (for example reuse-window flags) to control reuse. Single-instance apps are always repositioned.

## Admin safety (0.102)
For admin entries with an unverifiable EXE signature, a dialog offers Skip this app (default) or Run anyway (one time, not remembered), with Details/Copy details. Dev docs: Authenticode plus catalog checks, revocation from cache only, path-based execution so parent directories and dependencies are not covered; packaged apps, URIs and shortcuts are not checked; the warning IPC is advisory, not a security boundary; 10 second display timeout never approves.

## Internals
Components: WorkspacesLib (core, signature verification), Launcher and Launcher UI, Window Arranger. PowerToys cannot ask apps to open at a position: it launches, then moves and resizes via public APIs, so movement is visible. A 0.103 preview adds command-line list and launch of saved workspaces with JSON output.

## Limitations
- Admin apps may not reposition (fix pending per docs).
- No restoration of snapped state.
- Storage (from source): definitions live in workspaces.json inside the module's settings folder, which resolves to %LOCALAPPDATA%\Microsoft\PowerToys\Workspaces\. A just-created, not yet saved workspace is held in temp-workspaces.json in the same folder, and the window arranger checks that file first (WorkspacesData.cpp, WorkspacesWindowArranger/main.cpp, settings_helpers.cpp). The Workspaces folder name is confirmed by the UI test helper; the docs pages do not state the path.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS has no public API to place other apps' windows without Accessibility permission (AXUIElement); launch via open with bundle ids and arguments. Linux X11: wmctrl/xdotool; Wayland: largely impossible without compositor-specific protocols (KWin scripting, GNOME extensions). Spaces/virtual desktops add variance.

formtools note: Store workspaces as portable JSON (app id, args, rect, monitor id) and degrade gracefully to launch-only where window placement is unavailable.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/workspaces
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/workspaces.md
- https://github.com/microsoft/PowerToys/releases
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/Workspaces/WorkspacesLib/WorkspacesData.cpp
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/Workspaces/WorkspacesWindowArranger/main.cpp
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/common/SettingsAPI/settings_helpers.cpp
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/Workspaces/Tests/Workspaces.UITests.Next/WorkspaceTestState.cs
