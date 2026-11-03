# mpv

Researched 2026-11-03. Latest stable seen: v0.41.0 (release page shows "21 Dec" without year; most likely Dec 2025, unverified).

## 1. Identity and license

Command-line media player, GPLv2 or later by default; builds as LGPLv2.1 or later with `-Dgpl=false`. Platforms: Linux, Windows 10 1607+, macOS 10.15+; Android app on Google Play; BSDs and Haiku via packages. Releases once or twice a year; only the latest is maintained; meson build system. Requires FFmpeg 6.1+ as of 0.41.

formtools note: mpv (libmpv) is the strongest embeddable engine candidate; check LGPL build flag for linking.

## 2. Configuration model

- `mpv.conf` (user dir like `~/.config/mpv/`; system dir `/etc/mpv`), syntax `option=value`, `#` comments; flags yes/no. Command line overrides user which overrides system. `--no-config`, `--config-dir`.
- Profiles: `[name]` sections, `--profile=`, `apply-profile` at runtime, `profile-restore`, and conditional `profile-cond` with Lua expressions over properties (can be slow). Per-file configs need `--use-filedir-conf` (flagged unsafe for untrusted media).
- `input.conf` for key bindings; defaults live in the repo's `etc/input.conf`; `--input-test` helps debugging.
- `script-opts/*.conf` per-script settings; `--script-opts=key=value`.
- Watch Later: `--save-position-on-quit` plus restore of selected options; opt-in watch history (JSON Lines).

formtools note: Plain text config plus profiles is the power-user pattern; mirror with a GUI that writes the same keys.

## 3. Scripting and extension

- Lua: single file or directory with `main.lua` in `scripts/`; each script on its own thread with event loop; API groups: commands (sync/async/cancellable), properties (get, set, observe), key bindings (incl. forced), timers, script messages, hooks (experimental), `mp.msg`, `mp.options`, `mp.utils`, OSD overlays.
- JavaScript: MuJS (ES5), same `mp` modules preloaded, CommonJS `require`, `init.js` in config dir.
- C plugins listed as a third route (details not fetched).
- Bundled scripts (0.38 to 0.41): stats overlay (`i`), console (backtick), select.lua menus for files/tracks/chapters/devices, positioning.lua (zoom and pan around cursor), context menu, `mp.input()`.
- Community ecosystem (wiki): OSC replacements (ModernX, ModernZ), thumbnails, autosub, equalizer, clippers, scrobblers, yt-dlp hooks.

formtools note: Expose a small property/command bus so users can script formtools the way mpv scripts do.

## 4. OSC and UI

Lua-based on-screen controller, on by default; layouts: box, slimbox, bottombar (default), topbar, slimbottombar, slimtopbar, floating; options in `osc.conf` or `--script-opts=osc-...`; seekbar styles, chapter markers, cache status, custom buttons, remappable mouse actions, optional thumbnail previews with a helper script. 0.40/0.41 added right-click menu. Deliberately minimal UI.

formtools note: Ship a clean default control bar; allow replacement.

## 5. IPC

JSON IPC over Unix socket or Windows named pipe via `--input-ipc-server` (or `--input-ipc-client` with fd). Newline-delimited JSON; request has `command` array and optional `request_id`; replies carry `error` and `data`; events are interleaved; `observe_property` with numeric id emits `property-change`; `async` flag available. Explicitly not secure (the `run` command can execute programs), so local-only.

formtools note: Copy this wire format for formtools remote control; add auth if networked.

## 6. Rendering, shaders, quality

- `gpu-next` (libplacebo) is the default as of 0.41; `gpu` remains with `fast` and `high-quality` profiles; GPU context/API selectable; custom GLSL shaders, scalers, dithering, deband (key `b`), HDR tone mapping, interpolation with `video-sync=display-resample`, ICC color management. Details of the shader, scaler and HDR options are in the next subsection (read from the manual source on mpv master, so a few values may be newer than 0.41).

### Shader, scaler and HDR options (mpv manual, master)

- Shaders: `--glsl-shader=<file>` (CLI/config alias for `--glsl-shaders-append`) adds one file per use; `--glsl-shaders=<list>` replaces the whole list (path-list option). A user shader is text with `//!` metadata lines forming HOOK, TEXTURE and PARAM blocks, with a `hook()` function returning a vec4; the manual warns the syntax is not stable. `--glsl-shader-opts=name=value,...` sets tunable parameters, optionally prefixed with a shader's base file name and a slash.
- Scalers: `--scale` (upscale, default `lanczos`), `--cscale` (chroma, defaults to the scale filter), `--dscale` (downscale; `hermite` is the stated default), `--tscale` (temporal, used only with `--interpolation`, default `oversample`). Named filters in the manual include `bilinear`, `lanczos`, `ewa_lanczos`, `ewa_lanczossharp` (default under the `high-quality` profile), `ewa_lanczos4sharpest` (built-in anti-ringing on gpu-next), `mitchell`, `hermite`, `catmull_rom`, `oversample`, `linear`; `--scale=help` lists all. Per-scaler tuning: `-param1/-param2`, `-blur`, `-clamp`, `-taper`, `-radius`, `-antiring`, `-window`, `-wparam`. `--scaler-resizes-only` limits scaling to actual resizes.
- Related quality options: `--deband` (with `-iterations`, `-threshold`, `-range`, `-grain`), `--dither` (`fruit`, `ordered`, `error-diffusion`, `no`), `--dither-depth`, `--interpolation` (needs a `display-` `--video-sync` mode), `--blend-subtitles`.
- HDR output: `--target-colorspace-hint=<auto|yes|no>` sets output colorspace metadata on the swapchain for HDR passthrough (gpu-next only; auto works on Wayland, D3D11 and winvk), with `--target-colorspace-hint-mode`. Display description: `--target-prim`, `--target-trc`, `--target-peak`, `--target-contrast`, `--target-gamut`, `--target-lut`, and `--hdr-reference-white`.
- HDR to SDR: `--tone-mapping` values `auto` (bt.2390 on gpu, spline on gpu-next), `clip`, `mobius`, `reinhard`, `hable`, `bt.2390`, `gamma`, `linear`, plus gpu-next-only `spline`, `bt.2446a`, `st2094-40`, `st2094-10`. Tuning: `--tone-mapping-param`, `-knee-*`, `-slope-*`, `-spline-contrast`, `-reinhard-contrast`, `-linear-knee`, `-exposure`; `--inverse-tone-mapping` with `--tone-mapping-max-boost`; `--tone-mapping-visualize`.
- Gamut and peak: `--gamut-mapping-mode` values `auto`, `clip`, `perceptual`, `relative`, `saturation`, `absolute`, `desaturate`, `darken`, `warn`, `linear` (most are gpu-next only). `--hdr-compute-peak=<auto|yes|no>` computes per-frame peak and average brightness for dynamic tone mapping (needs compute shaders); related `--hdr-peak-percentile`, `--hdr-peak-decay-rate`, `--hdr-scene-threshold-low/high`, `--hdr-contrast-recovery`, `--hdr-contrast-smoothness`, `--hdr-mastering-clip`, `--hdr-film-strength`.
- Color management: `--icc-profile=<file>`, `--icc-profile-auto` (uses the OS display profile; on Windows it must be an ICC profile, not WCS), `--icc-cache`. `--target-prim` and `--target-trc` apply only when ICC management is off.
- Hardware decoding must be requested with `--hwdec` (try `auto` first); 0.41 prefers Vulkan hwdec.
- Features seen in manual: A-B loop (`--ab-loop-a/b`), `--loop-file`, `--speed`, `--pitch`, backward playback `--play-direction`, bluray/dvd/cdda/dvb inputs, `--ytdl` integration (yt-dlp/youtube-dl) with format and raw options, `--start/--end/--length`, hr-seek.
- Keys: 1-8 adjust contrast, brightness, gamma, saturation; Ctrl+h toggles hwdec; `?` shows bindings.

formtools note: Treat shaders and scalers as an "advanced video" preset layer; default to a good preset.

## Sources

- https://github.com/mpv-player/mpv
- https://github.com/mpv-player/mpv/releases
- https://mpv.io/manual/stable/
- https://mpv.io/installation/
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/lua.rst
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/javascript.rst
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/ipc.rst
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/osc.rst
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/vo.rst
- https://raw.githubusercontent.com/mpv-player/mpv/master/DOCS/man/options.rst
- https://github.com/mpv-player/mpv/wiki/User-Scripts
