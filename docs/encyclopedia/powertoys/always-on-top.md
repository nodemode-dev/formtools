# Always On Top

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

Pins the focused window above all non-topmost windows with one shortcut, optionally drawing a coloured border so you can see which window is pinned.

## Activation

- Toggle pin on the active window: Win+Ctrl+T (default). Press again, or close the window, to unpin.
- Source also defines two opacity shortcuts, defaults Win+Ctrl+= (increase) and Win+Ctrl+- (decrease), which the Learn page does not mention (single source: `AlwaysOnTopProperties.cs`; virtual-key codes 0xBB and 0xBD).

## Settings

| Setting | Default (from source unless noted) | Notes |
|---|---|---|
| Activation shortcut | Win+Ctrl+T | |
| Do not activate when Game Mode is on | On | |
| Show Always On Top in the title bar context menu | Off | adds a system-menu entry |
| Show a border around the pinned window | On | |
| Color mode | Windows default (accent colour) | or Custom color |
| Custom color | #0099cc | only in custom mode |
| Opacity (%) | 100 | border opacity |
| Thickness (px) | 4 | |
| Enable rounded corners | On | |
| Play a sound when pinning | On | |
| Excluded apps | empty | one name per line; partial match, so "Notepad" also blocks Notepad++.exe; use a full name with .exe for exact |

## How it works internally

From the repo devdoc: a hotkey listener tells the AlwaysOnTop class to pin or unpin; a window-event hook watches every window; pinning sets the topmost flag (`PinTopmostWindow`) and creates a border overlay (`AssignBorder`); unpinning removes both. Settings are reloaded on change and pushed to observers. It runs as a separate process started by the module interface.

## Limitations

- A topmost window cannot be guaranteed above other topmost windows. Known offenders: Citrix (#15680), Remote Desktop (#16631), VMware (#18834).
- No documented workarounds.
- The 0.102 notes only add end-to-end tests (pinning, borders, virtual desktops, exclusions, sound, Game Mode), which hints that behaviour across virtual desktops is a tested path.

## Group Policy

`ConfigureEnabledUtilityAlwaysOnTop`.

## Cross-platform note

(Analysis.) Linux X11: set `_NET_WM_STATE_ABOVE` through EWMH on the other client's window; easy. Linux Wayland: a client cannot raise or pin other clients' windows; it needs compositor features (KDE window rules, GNOME's built-in "Always on Top" titlebar entry, wlroots foreign-toplevel protocols), so formtools can only offer it per compositor or for its own windows. macOS: no public API to change another app's window level; options are Accessibility to raise windows repeatedly, a private CGS call (fragile, needs SIP considerations in some tools), or restricting to formtools-owned windows. The border overlay is a simple transparent click-through window on every platform.

## formtools note

Ship Always On Top for formtools' own windows everywhere, and for foreign windows only on Windows and X11, with an honest "unsupported on this compositor" state elsewhere.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/always-on-top
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `doc/devdocs/modules/alwaysontop.md`, `src/settings-ui/Settings.UI.Library/AlwaysOnTopProperties.cs`
