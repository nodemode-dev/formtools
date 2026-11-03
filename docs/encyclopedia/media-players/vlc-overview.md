# VLC media player: overview, versions, licensing

Scope: VLC desktop (Windows, macOS, Linux). Researched 2026-11-03. Claims marked "(single source)" rest on one fetched page; "(unverified)" means not confirmed from a fetched primary source.

## 1. Version status (as of Nov 2026)

- Current stable desktop release is the 3.0.x line: 3.0.24 "Vetinari", announced 2026-09-22. The news page lists no 4.0 release. (videolan.org news, single source for the date)
- 3.0.24 highlights: more than 130 security fixes, bundled FFmpeg moved from 4.4 to 8.1.2, 49 third-party libraries updated, ATRAC3/ATRAC9 decoding, CEA-708 captions in MP4, SRT listener mode, SFTP public-key auth, NV12 DirectShow capture on Windows, better Qt 6 and RIST support, improved WebVTT and subtitle language detection. Removed: the NPAPI browser plugin and the broken YouTube Lua script. RealRTSP disabled. New RSA-4096 update-verification key.
- 3.0.23 (2026-01-08) added a dark mode option on Windows and Linux and Windows ARM64 support.
- VLC 4.0 status: still not released. The nightly page offers daily "VLC 4.0" builds (Windows 32/64/ARM64, macOS Intel and Apple Silicon, Snap) but labels all nightlies unstable with no support. The code.videolan.org tag list shows only 3.0.x tags (newest seen: 3.0.22 in that cached view), no 4.0 tags or release candidates. Nightly directory listings were still being produced in Oct 2026. Conclusion: 4.0 remains a development branch; build against 3.0 behavior and treat 4.0 as a moving target.
- VideoLAN showed an AI-based live subtitle generator at FOSDEM (Jan 2026 news item). Not shipped in a stable release as far as the fetched pages show.

formtools note: Target 3.0 behavior for any VLC-compat claims; do not promise 4.0 parity.

## 2. Platforms

Official site lists desktop Windows (32-bit, 64-bit, ARM64), macOS (Universal, Apple Silicon), GNU/Linux; mobile Android, iOS, Apple TV; plus Chrome OS, BSDs, Solaris, QNX, OS/2 via source. Site claims no spyware, ads or tracking.

formtools note: A cross-platform player is table stakes: Win, macOS, Linux at minimum, ARM64 included.

## 3. Licensing

- Application (VLC media player): GPL v2 or later.
- libVLC engine: LGPL v2.1 or later. The relicense from GPL to LGPL was completed 2011-12-21 for libVLC from 1.2 onward, so third parties can embed it in non-GPL apps. Related libs libdvbpsi, libaacs, libbluray moved to LGPL; biTStream to MIT. (VideoLAN press release)
- The GitHub repo shows both GPL-2.0 and LGPL-2.1 license labels; main development in C with C++, Obj-C, asm and Rust.
- Trademark: the name "VLC" may not be reused for other applications; trademark use is tied to GPL-compliant redistribution (videolan.org legal page). Some icons are CC BY-SA 3.0+.
- Redistribution of GPL parts requires source for the binary and included libraries.
- libVLC is a C library split into hundreds of runtime plugins. Maintained bindings: libvlcpp (C++), VLCKit (Apple), libvlcjni (Android), LibVLCSharp (.NET). Community: vlcj, python-vlc, vlc-rs, libvlc-go.

formtools note: If formtools embeds libVLC (LGPL) via dynamic linking it can keep a permissive or proprietary license; copying VLC app code (GPL) forces GPL. Do not name anything "VLC".

## 4. Documentation layout (useful for structuring our own help)

Official 3.0 desktop docs: Getting Started, Basic Usage (Media, Playback, Audio, Video, Subtitles, Hotkeys, Recording, Settings, Tips and Tricks), Advanced Usage (Stream Output, Player guides, Interfaces, Conversion and Transcode, Streaming, VLM, Unusual cases), Reference (formats, modules, OS matrix), Add-ons, FAQ. Several reference pages (formats, features, modules) are still stubs pointing at the old wiki.

formtools note: Mirror the Basic/Advanced split; keep a living formats table rather than a stub.

## Sources

- http://www.videolan.org/vlc/
- https://www.videolan.org/news.html
- https://www.videolan.org/vlc/releases/3.0.24.html
- https://nightlies.videolan.org/
- https://code.videolan.org/videolan/vlc/-/tags
- https://www.videolan.org/legal.html
- https://www.videolan.org/press/lgpl-libvlc.html
- https://www.videolan.org/vlc/libvlc.html
- https://github.com/videolan/vlc
- https://docs.videolan.me/vlc-user/desktop/3.0/en/
- https://docs.videolan.me/vlc-user/desktop/3.0/en/reference/formats/index.html
