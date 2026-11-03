# VLC: interfaces, extensions, CLI, shortcuts

Researched 2026-11-03.

## 1. Interfaces

- qt: default GUI on Windows and Linux (Qt version in 3.0 unverified; 3.0.24 notes better Qt 6 support). macosx: the only GUI on macOS. skins2: loadable skins, Windows and Linux.
- Non-GUI: http (web interface, default port 8080, also remote control), rc (text remote shell, `-I rc` or `--extraintf rc`; `--rc-host` TCP or `--rc-unix` socket), ncurses (terminal UI with file browser), dummy (no UI; hotkeys still work; exit with Ctrl+C or a `vlc://quit` item), plus lua and dbus modules (unverified details). Telnet is just rc over TCP.
- Select with `-I <module>` / `--intf` and add secondaries with `--extraintf`. `vlc -l` lists modules.
- Mouse gestures exist (page is a stub, details unverified).

formtools note: Provide a headless control surface (local socket) from day one; GUI and CLI share it.

## 2. HTTP requests API

Served under `requests/`: `status.xml` (state and commands), `playlist.xml`, `browse.xml`, `vlm.xml`, `vlm_cmd.xml`. Commands include in_play, in_enqueue, pl_play, pl_pause, pl_stop, pl_next, pl_previous, pl_delete, pl_empty, pl_sort, pl_random, pl_loop, pl_repeat, fullscreen, volume, seek. Host set via `--http-host`. Auth model not in the fetched page (unverified; in practice a password is required in 3.x).

formtools note: Prefer JSON over XML and require a token for any network control.

## 3. Extensions and Lua

- Lua playlist scripts since 0.9.0: each defines `probe()` and `parse()`; helpers `vlc.access`, `vlc.path`, `vlc.peek()`, `vlc.readline()`; items carry path, name, duration, description. Drop into the platform playlist folder or user data folder. VLC ships site parsers.
- Extensions are `.lua` files from the add-ons site (installed in the program directory, or user folder), loaded after restart; also interface and service-discovery Lua types. Extension API, read from the 3.0.x official source (modules/lua/extension.c, extension_thread.c, share/lua/README.txt):
  - The script defines a global `descriptor()` returning a table with `title`, `version`, `author`, `url`, `shortdesc`, `description`, `icon` and `capabilities`. Capabilities are strings: `menu`, `trigger`, `input-listener`, `meta-listener`, `playing-listener`.
  - Hook functions VLC calls if present: `activate()`, `deactivate()`, `close()` (dialog closed), `menu()` (returns the list of menu entry names), `trigger_menu(id)`, `trigger()` (trigger-only extensions), `input_changed()`, `meta_changed()`, `playing_changed()`.
  - Inside, `vlc.deactivate()` ends the extension; `vlc.dialog(title)` builds a grid-layout UI with methods `show`, `hide`, `delete`, `set_title`, `update`, `add_button`, `add_label`, `add_html`, `add_text_input`, `add_password`, `add_check_box`, `add_dropdown`, `add_list`, `add_image`, `del_widget`. The extensions README in the tree is itself a TODO stub, so this is the code-level contract.
- Browser NPAPI plugin was removed in 3.0.24, and the bundled YouTube Lua script was removed as broken.

formtools note: A small scripting surface (event hooks plus playlist resolvers) beats a large plugin API.

## 4. Command line

`vlc [options] item`; per-item options use `:` (for example `:fullscreen`). Help: `--help`, `--longhelp`, `--advanced --help-verbose`. Useful: `--start-time`, `--stop-time`, `--zoom`, `--aspect-ratio`, `--random`, `--loop`, `--repeat`, `--play-and-stop`, `--volume-step`, `--gain`, `-v/-vv`. Windows needs `--option=value` form. Hotkeys rebind with `--key-<function>`.

## 5. Keyboard shortcuts (verified subset)

Space play/pause, f fullscreen, Esc exit fullscreen, s stop, n/p next/previous, m mute, Ctrl+Up/Down volume, Shift+Left/Right jump 5 s (Alt 10 s, Ctrl 1 min, Ctrl+Alt 5 min), + - = speed, [ ] fine speed, e next frame, Shift+S snapshot, Shift+R record, l loop mode, j/k audio delay, g/h subtitle delay, Shift+H/J/K bookmark sync. Hotkeys are global when configured, and work only in the video window by default per the older interface page. Full list is in image form on the official page (not machine readable).

formtools note: Keep VLC-compatible defaults (space, f, m, arrows) and allow full rebinding.

## 6. Preferences

See vlc-filters-effects.md section 5.

## Sources

- https://wiki.videolan.org/Interfaces/
- https://wiki.videolan.org/Documentation:Alternative_Interfaces/
- https://wiki.videolan.org/VLC_HTTP_requests/
- https://wiki.videolan.org/Documentation:Command_line/
- https://wiki.videolan.org/Hotkeys/
- https://wiki.videolan.org/Documentation:Modules/hotkeys/
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/hotkeys.html
- https://wiki.videolan.org/Documentation:Play_HowTo/Building_Lua_Playlist_Scripts/
- https://docs.videolan.me/vlc-user/desktop/3.0/en/addons/index.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/advanced/interfaces/index.html (stubs)
- https://www.videolan.org/vlc/releases/3.0.24.html
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/lua/extension.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/lua/extension_thread.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/share/lua/README.txt
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/share/lua/extensions/README.txt
