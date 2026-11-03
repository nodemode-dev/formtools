# Window Hopper (PowerToys)

## What it does
Cycles through the windows of the currently focused app only, like the macOS Cmd+` behavior, instead of Alt+Tab across all apps. Introduced in 0.101.2362 per release notes.

## Activation
Off by default; enable in Settings.
- Next window: Alt+` (grave accent), shows previews of the app's windows.
- Previous: Shift+Alt+`.
- Release Alt to switch; Esc before release cancels.

## Settings
Enable Window Hopper (off); Next window shortcut; Previous window shortcut. Nothing else documented.

## How it works
Hold Alt, tap the key repeatedly to move the highlight through preview thumbnails of same-app windows, release to focus. Implementation internals not documented in sources read (not verified).

## Limitations
- Same-app scope only.
- Does not open with fewer than two eligible windows.
- Docs do not state allowed shortcut combos or conflict handling.
- Needs a US-style layout assumption for the backtick key (inference, not documented).

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS already has this natively (Cmd+`). Linux desktops vary: GNOME has Alt+` for same-app switching, KDE offers Walk Through Windows of Current Application. So formtools value is mainly consistency and previews.

formtools note: Low priority; only build if offering a unified window-switcher, using native same-app cycling on macOS and GNOME.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/window-hopper
- https://github.com/microsoft/PowerToys/releases
