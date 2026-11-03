# Microsoft 3D Viewer (retired)

## Retirement status as of 2026-11

- Microsoft's Windows deprecated-features list records 3D Viewer as announced for deprecation in February 2026 and removed from the Microsoft Store on 2026-07-01. The entry gives no date for removal from Windows images themselves and points users to the Babylon.js Sandbox as the replacement for viewing 3D content.
- Consequence: treat it as unavailable for new installs; existing copies may linger but are unsupported. Do not design formtools around its presence.
- Lineage (general knowledge, not re-verified here): Windows 10 Creators Update era app (originally "Mixed Reality Viewer"), paired with Paint 3D, which was also retired.

## What it did (general knowledge, not fetched, verify before relying)

- Opened glTF/GLB, FBX, OBJ, STL, PLY, 3MF.
- Orbit/pan/zoom, lighting rig and HDRI environment choices, shaded vs wireframe-style display, animation playback, a mixed reality mode on Windows, simple measurements, and basic screenshot/export.
- Distribution: Microsoft Store, Windows 10/11 only.

formtools note: the vacated slot is "native-feeling Windows 3D preview with Explorer integration"; target glTF/GLB/OBJ/STL/FBX/3MF/PLY with orbit, HDRI, wireframe and animation to replace it.

## Replacement the vendor names

Babylon.js Sandbox (web, drag-and-drop viewer built on the Babylon.js engine, Apache-2.0 engine license per general knowledge). Runs in a browser, no install.
formtools note: a WebView-based viewer is an accepted fallback pattern even from Microsoft; if formtools embeds a web viewer, prefer a permissive engine (three.js MIT, Babylon Apache-2.0).

## Sources
- https://learn.microsoft.com/en-us/windows/whats-new/deprecated-features
- Search results only (not fetched, secondary, used for context): news coverage of the Store removal. Feature list above is unsourced general knowledge.
