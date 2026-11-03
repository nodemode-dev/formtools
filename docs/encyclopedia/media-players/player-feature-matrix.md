# Player feature matrix

Y = documented in fetched primary sources; ? = not confirmed; N = not offered / stated absent. Researched 2026-11-03.

| Feature | VLC 3.0 | mpv | IINA | MPC-HC (clsid2) | MPC-BE | PotPlayer | QuickTime | Win Media Player |
|---|---|---|---|---|---|---|---|---|
| Platforms | Win, macOS, Linux (+mobile) | Win, macOS, Linux, Android | macOS | Win | Win | Win | macOS | Win 11 |
| License | GPLv2+ app, LGPL-2.1 lib | GPLv2+ (LGPL build) | GPLv3 | GPLv3 | GPLv3 | proprietary freeware ? | proprietary | proprietary |
| Open source | Y | Y | Y | Y | Y | N ? | N | N |
| Hardware decode | Y | Y (`--hwdec`) | Y (via mpv) | Y (LAV/D3D) | Y (D3D11) | Y | Y | ? |
| Network streams | Y | Y (yt-dlp) | Y (plugin) | Y (yt-dlp) | Y (yt-dlp) | Y (FTP/WebDAV/HTTP) | ? | ? |
| Discs (DVD/BD/CD) | Y | Y | ? | ? | ? | ? | ? | ? |
| Playlist | Y | Y | Y | Y | Y | Y | ? | Y |
| Media library | Y (unverified detail) | N | N | N | N | ? | N | Y |
| Subtitle auto-download | via Lua ext | via scripts | Y (OpenSubtitles plugin) | Y (search) | ? | ? | N | N |
| ASS/SSA styling | Y | Y (libass) | Y | Y (libass) | ? | Y | N | N |
| Audio EQ | Y (10-band) | via script/filter | ? | N (external) | ? | ? | N | ? |
| Compressor/spatializer | Y | filters | ? | N | ? | ? | N | ? |
| Video adjust (BCSH) | Y | Y (keys 1-8) | Y | Y | ? | ? | N | N |
| Deinterlace | Y (8 modes) | Y (auto option) | Y | ? | ? | ? | ? | ? |
| Custom shaders | N | Y (GLSL) | Y (via mpv) | Y (via renderer) | ? | ? | N | N |
| A-B loop | Y (adv. controls, unverified key) | Y | ? | Y | ? | ? | N | N |
| Frame step | Y (e) | Y | ? | ? | ? | ? | ? | ? |
| Speed control | Y | Y | Y | Y | Y (hold to speed) | Y | ? | ? |
| Snapshot | Y | Y | Y | ? | ? | ? | ? | ? |
| Recording | Y (record + capture) | N | N | N | N | Y (capture) | Y (screen/movie/audio) | N |
| Convert/transcode | Y (wizard) | N | N | N | N | N | Y (export) | N |
| Streaming server | Y | N | N | N | N | Y (broadcast) | N | N |
| Scripting/extension | Lua | Lua, JS, C | JS plugins | filters (DirectShow) | filters | AngelScript | N | N |
| Remote control | HTTP, rc, telnet | JSON IPC | CLI | web interface | ? | ? | N | N |
| PiP | ? | ? | Y | ? | ? | ? | ? | ? |
| Touch Bar / gestures | N | mouse bindings | Y | N | N | N | Y | N |

Gaps in this table reflect research limits, not necessarily absent features.

formtools note: Highest value-per-effort shortlist: robust codecs/hwdec, subtitle sync and styling, A-B loop and frame step, speed with pitch correction, snapshot, simple convert/remux, JSON control socket.

## Sources

See individual files: vlc-overview.md, mpv.md, iina.md, mpc-hc-be.md, potplayer.md, os-baseline-players.md.
