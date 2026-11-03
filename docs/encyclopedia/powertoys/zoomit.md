# ZoomIt (PowerToys and Sysinternals)

## What it does
Screen zoom, annotation, break timer, recording, snipping, OCR snip, scrolling screenshots, demo typing and mirroring for presentations. Distributed in PowerToys and as standalone Sysinternals ZoomIt (current standalone 12.3, published 2026-10-15, all Windows versions, plus touch and pen drawing). A separate ZoomIt for Mac project exists (not documented here).

## Default hotkeys (PowerToys page; all customizable)
Zoom Ctrl+1 · Draw Ctrl+2 · Break timer Ctrl+3 · LiveZoom Ctrl+4 · Record Ctrl+5 (region Ctrl+Shift+5, window Ctrl+Alt+5) · Snip Ctrl+6 (save Ctrl+Shift+6, OCR text Ctrl+Alt+6) · DemoType Ctrl+7 · Panorama (scrolling screenshot) Ctrl+8 (save Ctrl+Shift+8) · DemoMirror Ctrl+9 (region Ctrl+Shift+9, window Ctrl+Alt+9). Sysinternals page also lists LiveDraw Ctrl+Shift+4 and previous DemoType snippet Ctrl+Shift+7.

## In-mode keys (Sysinternals page)
Zoom in/out: wheel or arrows. Left click starts drawing, right click stops. Ctrl+wheel or arrows set pen/cursor size. Space centers cursor. W whiteboard, K blackboard. T text left, Shift+T right. Pens R G B Y O P, Shift+key for highlighter, X blur. Shift line, Ctrl rectangle, Tab ellipse, Ctrl+Shift arrow. Ctrl+Z undo, E erase all. Ctrl+C copy, Ctrl+S save PNG, with Shift for cropped. Esc or right click exits. Break timer: Ctrl+wheel adjusts time, Alt+Tab minimizes without pausing.

## Settings (PowerToys)
- Behavior: show tray icon.
- Zoom: hotkey; animate zoom; smooth image; initial magnification 1.25 to 4.0 (default 2.0).
- Live Zoom and Draw: hotkeys.
- Type: text font (default Microsoft Sans Serif).
- DemoType: input file, hotkey, drive input while typing (off), typing speed 10 to 100 (default 55).
- Break Timer: hotkey; minutes (10); show elapsed after expiry (on); play sound (off) with file; lock workstation during break; opacity 10 to 100 percent; position (center); background bitmap (off) with faded desktop or image file and scale to screen.
- Record: hotkeys; lock region to 16:9; format GIF or MP4 (default MP4); scaling 0.1 to 1.0 (1.0 MP4, 0.5 GIF); capture system audio (on); capture audio input (off); noise cancellation (on); mono (off); microphone; webcam overlay (off, Ctrl+C toggles while recording) with camera, position (four corners), size (Small to Full screen), shape (rectangle, rounded rectangle, rounded square, circle), background (None, Blur, Image), image file, brightness 0 to 100 (50).
- DemoMirror: hotkeys; track window region (on).
- Snip and Panorama: hotkeys; copy to clipboard when saving (off). Screenshots save as zoomed or actual size PNG, WebP or JPG; scrolling shots as PNG, WebP or JPEG.

## Features
- Recording opens a trim editor; clips can be appended with hard cut, fade to black or fade to white (0.5 s). Audio source failure disables that source and keeps recording with a warning. Windows 10 May 2019 or later required for recording.
- DemoType (since v8.0) types text from a file into the active app; DemoMirror (0.101+) mirrors screen, region or window including pointer to a second monitor, with zoom and draw still working.
- 0.102 added snip with dictation (press Space during a snip, speech transcribed on device) and smoother zoom transitions. 0.103 preview improved DemoType clipboard text loading.

## Internals (dev docs)
PowerToys.ZoomIt.exe plus a module interface DLL; hotkeys registered with RegisterHotKey including conflict warnings; settings kept in the registry (not JSON) for compatibility with the standalone build, bridged to the Settings UI by a WinRT interop library; fonts stored as binary LOGFONT; named events for settings changes and exit; shared Sysinternals code under a common folder. Docs do not describe zoom rendering or panorama stitching (not verified). Which OCR engine backs text recognition is not stated.

## Limitations
Default hotkeys can conflict with other software; some features need recent Windows; options tabs are undocumented on the Sysinternals page.

## Cross-platform note
macOS: Screen Recording and Accessibility permissions, ScreenCaptureKit for recording and zoom frames, global hotkeys via Carbon/CGEventTap. Linux: PipeWire and portals for capture on Wayland; global hotkeys and click-through draw overlay are restricted on Wayland. Draw overlay, annotation tools and break timer are portable UI; recording can use ffmpeg.

formtools note: Split ZoomIt into independent modules (annotate overlay, timer, region recorder, scrolling capture, OCR snip) so each can ship per platform as capture APIs allow.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/zoomit
- https://learn.microsoft.com/en-us/sysinternals/downloads/zoomit
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/zoomit.md
- https://github.com/microsoft/PowerToys/releases
