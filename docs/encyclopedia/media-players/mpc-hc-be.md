# MPC-HC and MPC-BE (Windows)

Researched 2026-11-03.

## 1. Lineage and status

- Original MPC-HC (mpc-hc.org) has been unmaintained since 2017; last release 1.7.13 (2017-07-16), site tells users to switch. Maintained fork: clsid2/mpc-hc (GPL-3.0), "mature and stable", no new feature requests but PRs accepted. Latest stable seen: 2.8.2 (17 Sep, year not shown; dev build dated 2026-09-16, so 2026). Windows 7 to 11.
- MPC-BE (Aleksoid1978): separate fork of Gabest MPC and MPC-HC code, GPL-3.0 with some MIT/BSD/zlib/Apache components. Latest seen: 1.9.1 (08 Aug). Requirements: SSE2 CPU, DirectX 9.0c, Windows 7 to 11.

formtools note: Both are Windows-only DirectShow players; features worth copying are UI density and renderer choice, not architecture.

## 2. MPC-HC (clsid2) features

- Renderers: bundled MPC Video Renderer (default on most systems since 2.7.4), or madVR for HDR; chosen in Options, Playback, Output.
- Codecs: internal decoding via LAV Filters (periodically updated); supports third-party DirectShow filters; HEVC, VVC, AV1, AC4.
- Subtitles: libass rendering, WebVTT, subtitle search; 2.8.1 added secondary subtitle track (external SRT) and copying subtitle text to clipboard in real time.
- Playback: adjustable speed, A-B repeat, pan/scan (rotate, flip, zoom), resume position, customizable hotkeys (editable without mouse in 2.8.2), ReplayGain (2.8.2), MPC Audio Renderer and SaneAR with pitch correction, yt-dlp streaming and download, history dialog, web interface "remote" page, registry-based defaults via HKLM.
- No built-in equalizer; project points to Equalizer APO.

formtools note: Secondary subtitle track and subtitle-text-to-clipboard are cheap, loved language-learning features.

## 3. MPC-BE features

- Built-in splitters and decoders (works without external filters); falls back to installed LAV Filters; D3D11 decoder support documented in wiki.
- Releases show: Dolby Vision in AV1 in MP4, MS and IMA ADPCM, RF64 audio, APV video, embedded cover images in FLAC with preview in Properties, "Merge files using FFmpeg" in save dialog, yt-dlp replacing a built-in YouTube parser, keep audio device active when paused, hold left mouse to speed up playback (1.9.1).
- Customizable toolbar buttons, default track preferences, automatic loading of external tracks (wiki titles).

formtools note: Long-press-to-speed-up is a good touch/mouse gesture to include.

## Sources

- https://mpc-hc.org/
- https://github.com/clsid2/mpc-hc
- https://github.com/clsid2/mpc-hc/releases
- https://github.com/Aleksoid1978/MPC-BE
- https://github.com/Aleksoid1978/MPC-BE/releases
- https://github.com/Aleksoid1978/MPC-BE/wiki
- https://github.com/Aleksoid1978/MPC-BE/wiki/LAV-Filters
