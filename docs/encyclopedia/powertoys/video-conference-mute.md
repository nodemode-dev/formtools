# Video Conference Mute (PowerToys) - RETIRED

## Status
Removed. Deprecated and removed in v0.88.0 (the last version with it was 0.87.1; a later cleanup PR describes its policy range as 0.64 to 0.87.1). It no longer appears in the current utility list.

## What it did
Muted the microphone and camera system-wide for any app with one action, showing a small banner and a toolbar mic icon while muted. Its own default shortcut is not stated in the sources read; users who wanted a shortcut after removal used Keyboard Manager (single source, issue thread). It relied on a virtual camera driver.

## Why it was retired
Maintainers cited maintenance mode since v0.67, low usage, hard testing and debugging across webcam hardware, Arm64 quirks, accessibility issues, and installer complications from the virtual driver. Users disputed that Windows offers an equivalent.

## Leftovers
The removal PR also deleted the Webcam Report Tool and added registry cleanup so stale virtual camera entries vanish. A later (October 2026) PR removed remaining installer custom action, helper header and the deprecated Group Policy setting.

## Cross-platform note
Muting the mic is easy via OS APIs (CoreAudio, PulseAudio/PipeWire). Camera disable is not: macOS and Linux lack a per-app global kill, so a virtual camera (CoreMediaIO extension, v4l2loopback) is the only route and carries the driver pain that killed this module.

formtools note: Do not build a virtual camera; if wanted, offer a global mic mute hotkey plus an on-screen indicator only.

## Sources
- https://github.com/microsoft/PowerToys/issues/36339
- https://github.com/microsoft/PowerToys/pull/36772
- https://github.com/microsoft/PowerToys/pull/51101
- https://github.com/microsoft/PowerToys/releases/tag/v0.88.0
- https://learn.microsoft.com/en-us/windows/powertoys/ (confirms absence from current list)
