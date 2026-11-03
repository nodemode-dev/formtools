# IINA (macOS)

Researched 2026-11-03.

## 1. Identity

Free, open-source macOS player built on mpv, native UI. License GPLv3 (per iina.io). Current version 1.5.0 (GitHub release dated 03 Oct, year not shown; likely 2026, unverified). Bundles mpv 0.41.0 and FFmpeg 9.0.1 per release notes (as printed; verify). Requires macOS 12+ on Apple Silicon, macOS 11+ on Intel; macOS 11 support to be dropped. States no tracking or telemetry. Native Apple silicon build.

formtools note: IINA proves the "mpv core plus native shell" architecture is viable; license GPLv3 means no code reuse in a permissive app.

## 2. Distinguishing features

- Picture in Picture, Touch Bar, Force Touch, trackpad gestures, Live Text on frames, media-key integration.
- Music Mode for audio files, unlimited playback history, chapters, playlists, video thumbnails on seek bar, chapter names on slider (1.5).
- Online subtitle search (OpenSubtitles via official plugin), plus plugin-provided online media.
- mpv compatibility: users can supply mpv config options and scripts; command-line tool `iina-cli`; browser extensions to open web video.
- 1.5.0 (Oct): new Settings window, plugin store inside Settings, split Video/Audio pages, Quick Settings sidebar with a Layout pane, resizable sidebars, Liquid Glass icons, unshuffle playlist, `tone-mapping-param`, HDR tone mapping fixes.

formtools note: Quick Settings sidebar and playlist/chapter side panels are good reference UX for formtools viewers.

## 3. Plugin system

Plugins are folders (`*.iinaplugin`) with `Info.json` (name, identifier, version, entry) plus JavaScript (TypeScript typings via npm package `iina-plugin-definition`). Two entries: main (per player instance, after init) and global (once at launch, can create windows and managed players). APIs: core, event, mpv (properties, commands, hooks), menu, overlay (content over video), sidebar, file, http, preferences, subtitle, playlist, input, standaloneWindow, utils, ws, global, console. Official plugins: online media, OpenSubtitles, user scripts. Community plugins installed from the in-app plugin store; listing via PR to `plugins.json`. Permission model and packaging format (.iinaplgz) not found in fetched pages (unverified).

formtools note: Per-instance main entry plus global entry is a clean plugin lifecycle to copy.

## Sources

- https://iina.io/
- https://github.com/iina/iina
- https://github.com/iina/iina/releases
- https://docs.iina.io/
- https://docs.iina.io/pages/getting-started.html
