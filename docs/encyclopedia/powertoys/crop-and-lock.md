# Crop And Lock

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

Turns part of another window into its own small window, in one of three ways, so you can keep an eye on (or work in) a slice of an app.

## Activation

Focus the target window, press a mode shortcut, drag a rectangle over the area, and a new window appears. Esc cancels the selection. The new window has a close button; closing it in Reparent mode restores the original window.

| Mode | Default shortcut |
|---|---|
| Thumbnail | Win+Ctrl+Shift+T |
| Reparent | Win+Ctrl+Shift+R |
| Screenshot | Win+Ctrl+Shift+S (default from source; Learn does not state one) |

## Modes

- **Thumbnail**: a live mirror of the chosen region. Cannot be clicked into (input does not go to the original). Best compatibility.
- **Reparent**: the original app is re-parented into a new frame that shows only the region, so you keep working with the app. Most compatibility problems.
- **Screenshot**: a frozen snapshot of the region; never updates. Good compatibility.

## Settings

Three shortcut pickers (Thumbnail, Reparent, Screenshot) plus the module toggle. Nothing else is documented.

## How it works internally

Repo devdoc: separate window classes per mode (`ThumbnailCropAndLockWindow` with an overlay window, `ReparentCropAndLockWindow` with a child window, `ScreenshotCropAndLockWindow`), all in a native module with the settings in `main.cpp`. The thumbnail mode is consistent with live window thumbnails from the desktop compositor (inference). The 0.102 release fixed capture alignment so the crop matches the selected region on scaled displays.

## Limitations

- Maximised or full-screen windows may fail in Reparent mode (workaround: resize the window to the screen corners).
- Some UWP apps (Calculator) misbehave when reparented; apps with tabs or sub-windows (Notepad, OneNote) too. Use Thumbnail instead.
- Thumbnail cannot control the source; Screenshot is static.

## Group Policy

`ConfigureEnabledUtilityCropAndLock`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) Thumbnail and Screenshot map to window capture: macOS ScreenCaptureKit (needs Screen Recording permission) streaming a single window with a source rectangle; Linux PipeWire screencast through the xdg-desktop-portal (user prompt per session) or X11 Composite/XShm. Reparent has no safe equivalent on macOS or Wayland because a process cannot embed another app's window; on X11 it is possible through XEmbed-like reparenting but is fragile. Offer only Thumbnail and Screenshot outside Windows.

## formtools note

Implement Thumbnail and Screenshot first as a region-cropped always-on-top capture window, and drop Reparent from the cross-platform scope.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/crop-and-lock
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `doc/devdocs/modules/cropandlock.md`, `src/settings-ui/Settings.UI.Library/CropAndLockProperties.cs`
