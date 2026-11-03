# Screen Ruler (PowerToys)

## What it does
Measures on-screen pixel distances using edge detection on a screen capture. Inspired by Pete Blois's Rooler.

## Activation
Win+Ctrl+Shift+M (customizable) shows a toolbar. Esc or the close control exits. Ctrl+1 to Ctrl+4 select toolbar tools. Mapping, from the UI string resources: Ctrl+1 Bounds, Ctrl+2 Spacing (the cross), Ctrl+3 Horizontal spacing, Ctrl+4 Vertical spacing.

## Modes
- Bounds: drag a box; hold Shift to leave boxes in place until cancelled.
- Spacing: cross measuring horizontal and vertical at once.
- Horizontal: horizontal only.
- Vertical: vertical only.
A primary click copies the measurement to the clipboard. Mouse wheel adjusts the pixel-difference threshold by 15 per tick (up raises it, lengthening the line).

## Settings
- Activation shortcut
- Default mode (default None)
- Capture screen continuously during measuring (off: one snapshot; on: near real time, heavier)
- Per color channel edge detection (on: each channel within tolerance; off: summed channel difference under tolerance)
- Pixel tolerance 0 to 255 (higher forgives gradients and shadows but may find fewer edges)
- Extra units: pixels only (default), inches, cm, mm, or DIP (scaled by the monitor measured on; DIP added in 0.102)
- Draw feet on cross
- Line color

## How it works
Dev docs: a module interface DLL starts/stops a UI process (PowerToys.MeasureToolUI.exe); a core library does the work: screen capture, an edge-detection pass over a BGRA texture, Direct3D/Direct2D rendering of overlays and text, bounds drawing via mouse and touch, and clipboard output. Results are always in physical pixels, optionally alongside another unit.

## Limitations
- Snapshot mode goes stale if the screen changes; continuous mode costs resources.
- Edge quality depends on tolerance tuning.
- DIP depends on per-monitor scaling.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

Needs screen-capture permission (macOS Screen Recording, Linux portal/PipeWire on Wayland, X11 grab). Edge detection over a pixel buffer is portable; the overlay must be a transparent click-through window per display. Handle Retina/HiDPI by reporting physical and logical units.

formtools note: Implement the edge scan as a pure image function in a shared core, with thin per-OS capture and overlay shells; report physical px plus logical px.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/screen-ruler
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/screenruler.md
- https://github.com/microsoft/PowerToys/releases
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/MeasureTool/MeasureToolUI/Strings/en-us/Resources.resw
