# Mouse Jump

## What it does
Shows a scaled preview of all screens; clicking a spot warps the pointer there. Useful for large or multi-monitor desktops.

## Activation
Customizable shortcut (no default stated).

## Keyboard navigation (current WinUI 3 UI)
Keys choose a monitor and the pointer goes to its center: 1 to 9 or numpad digits for a numbered monitor, Left/Right to cycle, Home/End for first/last, P for primary.

## Settings
- Activation shortcut.
- Thumbnail size: maximum 1600x1200 px; minimum width 160 and height 120.
- Appearance, Preview style: Compact, Bezelled or Custom (colors, borders, bezel depth, screen margins), with a Copy to Custom preview style action.

## How it works
Captures a thumbnail of the virtual desktop layout and maps clicks back to desktop coordinates (inferred from behavior; single source).

## Limitations
Keyboard mode jumps only to monitor centers.

## Cross-platform note
Pointer warping: CGWarpMouseCursorPosition on macOS, XWarpPointer/XTest on X11; Wayland has no portable absolute pointer warp (libei or compositor-specific protocols). Screen thumbnails require screen-capture permission on macOS and portals on Wayland.

## formtools note
Could render monitor layout schematically (rectangles) instead of live thumbnails to avoid capture permissions.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
