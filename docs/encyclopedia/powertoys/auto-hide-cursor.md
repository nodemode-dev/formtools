# Auto Hide Cursor

## What it does
Hides the mouse cursor while typing or after idle time; shows it again on deliberate movement, click or scroll.

## Activation
Off by default; enable in Settings (no shortcut described).

## Settings
- Auto Hide Cursor (off); Hide after keyboard input (on); Hide after pointer inactivity (off); Idle delay seconds (5, range 1 to 60; only with the inactivity option). If both hide options are off, it never hides.

## How it works
Ignores tiny movements below a threshold; touchpad-simulated mouse input restores the cursor; modifier keys and synthetic keystrokes do not hide it. While hidden it temporarily swaps the system cursor shapes and restores the scheme on disable or exit (single source).

## Limitations
Apps that draw their own cursor may still show it.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS hides the cursor while typing in many apps natively (CGDisplayHideCursor is app-scoped, so global hide is limited). Linux: unclutter (X11); Wayland has no global equivalent.

## formtools note
Treat as optional; global hide is only fully reliable on Windows and X11.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
