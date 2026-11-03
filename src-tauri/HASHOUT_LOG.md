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

## 2026-11-03 · v0.3.0 · the engine as a folder on every OS

- `tauri.conf.json` drops `externalBin` and ships `"resources": { "engine/": "engine/" }`. Per https://v2.tauri.app/develop/resources/ a trailing slash source copies the folder recursively with its structure, so `src-tauri/engine/formtools-engine[.exe]` and `_internal/` land under `$RESOURCE/engine/`. `tauri.macos.conf.json` is now `{}`: macOS uses the same layout, and the old override is gone. The folder must exist at build time, so `setup/freeze_backend` has to run before `tauri build` and `cargo check`.
- The resource directory per bundle type comes from https://docs.rs/tauri/latest/tauri/path/struct.PathResolver.html (resource_dir; Tauri says this is not a contract). macOS .app: `formtools.app/Contents/Resources/engine/`. Windows MSI and NSIS: `engine\` beside `formtools.exe` in the install folder. Linux deb and rpm: `/usr/lib/formtools/engine/`. AppImage: `$APPDIR/usr/lib/formtools/engine/`. Only the deb was built here; `dpkg -c` showed `usr/lib/formtools/engine/formtools-engine` next to `usr/bin/formtools`. The others follow the documentation and were not built.
- `packaged::engine_program(handle)` resolves `engine/formtools-engine[.exe]` with `BaseDirectory::Resource`, then `engine/` beside the executable, then `src-tauri/engine` from `CARGO_MANIFEST_DIR` (for `tauri dev`).
- `main.rs` no longer uses the shell sidecar API. `std::process::Command` starts the engine by path with `FORMTOOLS_PORT=0`, `PYTHONUNBUFFERED=1`, stdin closed, stdout and stderr piped and read line by line on two threads that feed the same `http://127.0.0.1:PORT` regex handshake and keep draining afterwards. Windows sets `CREATE_NO_WINDOW` (0x08000000). `kill_backend` runs on `RunEvent::Exit` and on engine failure: SIGTERM then a 1.5 s wait on `try_wait`, then `kill` and `wait` on unix; `kill` and `wait` on Windows. A hard crash of the shell (panic abort, SIGKILL) is not covered; a Windows job object would need `windows-sys`.
- `tauri-plugin-shell` stays registered because the contract lists it; nothing calls the sidecar API.
- Found while checking: `tauri build` run from `frontend/` (as `setup/desktop_build` does) stopped with "Couldn't recognize the current folder as a Tauri project", and from the repo root it stopped on mismatched versions (crate `tauri` 2.12.5 in `Cargo.lock` against `@tauri-apps/api` 2.11.1). `cargo build --release` plus `tauri bundle --bundles deb` from the repo root worked.
