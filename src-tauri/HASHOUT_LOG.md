# src-tauri HASHOUT_LOG

## 2026-11-03, v0.2.0, desktop shell scaffold

Ported from formvis (Apache-2.0) `src-tauri`, re-read from the v1.98.7 source rather than the v1.96.4 maps. No code comments are kept in the Rust files; the context lives here.

### What the shell does

- `main()` calls `reveal::mark_launch()` first. Setup rounds the splash (`reveal::round_splash`), queues launch file arguments, then either uses the dev engine or spawns the engine with `FORMTOOLS_PORT=0` and reads the port from the `http://127.0.0.1:PORT` line on stdout.
- Engine program: macOS runs `Resources/engine/formtools-engine` by path (also `engine/` beside the binary in `tauri dev`), every other OS runs the sidecar `formtools-engine`.
- Dev: in a debug build, `FORMTOOLS_DEV_URL` (when it starts with `http://127.0.0.1:` or `http://localhost:`) is used as the page URL and no engine is spawned; any other non-empty value means `http://127.0.0.1:8240`.
- Main window: external URL, title `formtools`, hidden on macOS until `app_ready` (alpha 0 on screen meanwhile), background `#0a0a0a`, 90 percent of the screen or the saved size, minimum 980 by 640, drag-drop handler off, overlay title bar and hidden title on macOS with the lights placed in the 38 px row.
- Timing: `SPLASH_MIN` 2600 ms, `BAR_FINISH` 220 ms, `FALLBACK` 20 s. The splash hook is `window.formtoolsSplashDone()`.
- Engine failure (no spawn, early exit, no port, window build error): the splash closes, a dialog says the engine failed, the engine is stopped and the app exits with code 1.
- Single instance: a second launch passes its existing file or folder arguments to the running window as an `open-paths` event (payload: array of path strings) and focuses the window. Launch arguments and macOS `RunEvent::Opened` paths are queued and emitted 800 ms after the first page load finishes, so the page has registered its listener.
- Commands: `app_ready`, `text_edit`, `pick_folder(title?)`, `pick_files(title?, extensions?)`, `reveal_in_folder(path)`, `open_with_default(path)`. `reveal_in_folder` uses the opener plugin's `reveal_item_in_dir` (Explorer select on Windows, Finder reveal on macOS, the file manager's ShowItems over D-Bus on Linux with a folder fallback).

### Removed relative to formvis

- Native GPU renderer, fonts, display profile, recent documents, updater commands, exit gate and quit confirmation, crash-loop page, interface zoom, `set_window_title` command, launch-time `--command` and `--script` flags, `mcp` and `agents` command-line modes, Linux AppImage integration, portable and data-folder arguments, display server and graphics backend switches, file associations, wix fragment, deb template. None are in the contract.
- Dependencies dropped: devtools feature, fontdb, x11-dl, webkit2gtk, gtk, windows-sys, formvis-render, objc2 `NSDocumentController`.
- Window state keeps size, position and maximised state only (no zoom). On macOS a dead web content process is reloaded; there is no crash-loop page.
- The page sets its title with the `core:window:allow-set-title` permission; the lights are placed again on resize, focus, theme and scale events and on page load.

### Config notes

- `bundle.resources` for a `licenses` folder is left out because the folder does not exist yet; add `"resources": { "../licenses": "licenses" }` (and the same key beside `engine` in `tauri.macos.conf.json`) when it does.
- Updater: `pubkey` empty and `endpoints` empty; formcompiler fills both in at release time.
- No `fileAssociations` (not asked for in the contract).
- Dependencies use semver majors in `Cargo.toml`; `Cargo.lock` holds the exact resolved versions.

### Icons

`assets/formtools-icon.svg` is an original design (dark rounded square, gradient lens ring, short diagonal handle, 2 by 2 grid inside the lens). `assets/formtools-icon-1024.png` is rendered with `rsvg-convert`, and `src-tauri/icons/*` comes from `tauri icon` (CLI 2.11.4), including the Android and iOS sets it makes.
