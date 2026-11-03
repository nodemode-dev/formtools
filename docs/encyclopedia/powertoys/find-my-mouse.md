# Find My Mouse

## What it does
Dims the screen and shows a spotlight circle centered on the pointer, with a short zoom-in animation, to locate the cursor.

## Activation
Methods: press Left Ctrl twice, Right Ctrl twice, shake the mouse, or a custom shortcut. The docs do not say which is default. Dismiss with a click or any key; if the mouse is moving, it dismisses shortly after it stops.

## Settings
- Activation method; Only activate while holding the Windows key (for the double-Ctrl methods).
- Minimum distance to shake; Shake detection interval (1000 ms); Shake sensitivity factor (2000 percent, relative to screen diagonal, lower is more sensitive).
- Activation shortcut (custom); Do not activate when Game Mode is on.
- Background color (#000000, alpha sets opacity); Spotlight color (#FFFFFF); Spotlight radius (100 px); Spotlight initial zoom; Animation duration (500 ms).
- Excluded apps: one per line, partial names match (Notepad matches Notepad++); add .exe for exact.

## How it works
Overlay window drawn above the desktop; trigger detection via keyboard/mouse hooks (docs describe behavior only; single source).

## Limitations
Defaults for several options are not stated.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS has a built-in shake-to-find (accessibility). Linux: KDE has Shake Cursor effect; GNOME has Ctrl highlight of pointer under accessibility. A portable build needs a transparent click-through overlay (not possible for global overlays on some Wayland compositors without layer-shell).

## formtools note
Implement as transparent always-on-top overlay with shake detector (distance over time window) and optional double-modifier trigger.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
