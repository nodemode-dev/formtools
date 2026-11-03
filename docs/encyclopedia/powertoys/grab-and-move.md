# Grab And Move

## What it does
Lets you move and resize a window by holding a modifier key and dragging anywhere inside it, instead of aiming at the title bar or thin borders.

## Activation
- Default modifier: Alt (switchable to the Windows key). Hold it and press a mouse button inside any window.
- Left-button drag moves the window; right-button drag resizes from the edge or corner nearest the drag start.

## Settings
- Activation modifier key: Alt or Win.
- Prevent Alt from activating the window menu after a drag or resize (relevant only when Alt is the modifier).
- Resize windows with modifier + right-click (toggle for the resize gesture).
- Do not activate when Game Mode is on.
- Show window geometry: overlay with position and size during the gesture.
- Excluded apps: one application name per line.

## How it works
Docs describe only the user-facing behavior. The nearest-edge resize rule means the grab point picks which of the eight resize anchors is used. Internals are not documented on the page fetched (single source).

## Limitations
- May not work reliably with some touchpads.
- No keyboard-only path; needs a pointer with two buttons for resize.

## Cross-platform note
macOS has no built-in equivalent (third-party tools do this with an event tap plus Accessibility API; needs Accessibility permission). Linux X11 window managers often ship Alt+drag move and Alt+right-drag resize already; Wayland compositors implement it themselves, so a portable app cannot move foreign windows on Wayland.

## formtools note
Low priority desktop utility; implement per-OS behind an Accessibility permission gate, and skip on Wayland.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/grab-and-move (single source)
