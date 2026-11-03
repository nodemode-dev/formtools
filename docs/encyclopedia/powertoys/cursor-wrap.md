# CursorWrap

## What it does
When the pointer leaves one screen edge it reappears on the opposite edge, shortening travel on single or multi-monitor setups.

## Activation
Customizable activation shortcut to toggle (no default stated); optional auto-activate on startup.

## Settings
- Enable CursorWrap; Activation shortcut; Automatically activate on utility startup.
- Disable wrapping while dragging.
- Wrap mode: Vertical and horizontal, Vertical only, Horizontal only.
- Wrapping activation: Always, Holding Ctrl, or Holding Shift.
- Disable wrapping when using a single monitor.

## How it works
Watches pointer position and warps it at boundaries (single source; no internals documented).

## Limitations
Defaults not explicitly stated on the page.

## Cross-platform note
Pointer warping is easy on macOS (CGWarp) and X11, hard on Wayland (no portable warp; compositor or libei needed).

## formtools note
Small feature; needs the same pointer-warp abstraction as Mouse Jump.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
