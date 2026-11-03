# Mouse Highlighter

## What it does
Draws a visual cue on mouse clicks, with distinct colors for primary and secondary buttons.

## Activation
Win+Shift+H toggles it (default).

## Settings
- Activation shortcut; Automatically activate on utility startup (off).
- Highlight mode: Spotlight, Circle highlight, or Ripple (Ripple for new profiles).
- Primary color #A6BFFF00 and secondary color #A600BFFF (ARGB; the page's color names look inconsistent with the hex values, treat as unverified).
- Spotlight/Circle only: Always highlight color, Radius (min 5 px), Fade delay (ms), Fade duration (ms).
- Ripple only: Size (60 px, range 10 to 300), Intensity (0.7, range 0.15 to 1.35), Duration (480 ms, range 60 to 2000), Follow cursor while held (on), Show crosshairs on right-click release (on).

## How it works
Click-driven animated overlay; docs give no implementation detail (single source).

## Limitations
Several defaults unstated.

## Cross-platform note
macOS and Linux have accessibility pointer-highlight features of varying strength; a portable approach is a click-through transparent overlay window fed by a global mouse listener (macOS needs Input Monitoring permission; Wayland restricts global listeners).

## formtools note
Presenter-oriented feature: ripple model with size, intensity and duration parameters is simple to port.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
