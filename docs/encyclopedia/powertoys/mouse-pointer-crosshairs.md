# Mouse Pointer Crosshairs

## What it does
Draws horizontal and vertical lines through the pointer for visibility and precision; helps low-vision users. Includes a Gliding Cursor accessibility mode.

## Activation
Activation shortcut is user-defined (default not stated); Quick Access flyout in the tray can toggle it. Gliding cursor: Win+Alt+. (period) by default; move the mouse to steer, Esc or any click cancels.

## Settings
- Activation shortcut; Automatically activate on utility startup.
- Color; Opacity (75 percent); Center radius (20 px); Crosshairs thickness (5 px); Border color; Border size.
- Orientation: Horizontal, Vertical, or both (default both).
- Automatically hide crosshairs when the pointer is hidden; Fix crosshairs length with a fixed length value (px).
- Gliding cursor: shortcut, Travel speed, Delay speed.

## How it works
Overlay lines follow the pointer; gliding cursor moves the pointer along guided lines driven by one button (single source).

## Limitations
Many defaults unstated.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS and Linux lack a built-in crosshair; implement as click-through overlay following global pointer position. Gliding cursor is similar to switch-control style accessibility tools.

## formtools note
Overlay with configurable thickness, opacity and fixed length; gliding cursor is optional accessibility extra.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
