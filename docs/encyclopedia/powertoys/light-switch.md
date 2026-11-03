# Light Switch

## What it does
Automatically switches Windows between light and dark theme by schedule, with a manual toggle shortcut and a CLI.

## Activation
Enable Light Switch in PowerToys Settings. A user-set theme toggle shortcut is available (no default stated in the page).

## Settings
- Enable Light Switch; Theme toggle shortcut.
- Schedule Mode: Sunset to Sunrise (needs location services synced), Fixed hours, Follow Night Light, Off (shortcut still works).
- Location (manual coordinates or location services); Offset in minutes relative to sunrise/sunset.
- Turn on dark mode / light mode times for fixed hours.
- Apply dark mode to: System, Apps, or both.
- Apply monitor settings to: pick a Power Display profile for each of dark and light (requires Power Display enabled).

## CLI
PowerToys.LightSwitch.CLI.exe with: status, light, dark, toggle, schedule enable [--mode fixed-hours|sunset-to-sunrise|follow-night-light], schedule disable. Options --json (version, success, state or error with code and message), --help, --version. Exit codes: 0 ok, 1 failure, 2 invalid args, 3 service unavailable, 4 timeout (state may have changed; run status first). Requires the running service. A change differing from the schedule becomes a manual override until the next scheduled change or a relevant setting change.

## How it works
A service tracks time or sunrise/sunset and sets the Windows system and app theme values; the CLI talks to that service (single source).

## Limitations
Sunset mode depends on location; CLI cannot start PowerToys; OLED battery benefit is a doc claim.

## Cross-platform note
macOS has native Auto appearance (sunset to sunrise) but a custom schedule is scriptable via osascript (dark mode setting). GNOME: org.gnome.desktop.interface color-scheme; KDE: plasma-apply-colorscheme or lookandfeeltool; XDG Desktop Portal exposes a color-scheme preference for reading. Sunrise/sunset can be computed offline from coordinates.

## formtools note
Build a scheduler plus per-OS theme setter adapters, and a JSON-speaking CLI with the same exit-code contract.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/light-switch (single source)
