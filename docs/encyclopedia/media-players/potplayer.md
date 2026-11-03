# PotPlayer

Researched 2026-11-03. Evidence is thin: only the official site's changelog excerpt was readable.

## 1. Identity

Windows player from the Daum / Kakao ecosystem. Versions are date-based. License: proprietary freeware under the official PotPlayer End User License Agreement (potplayer.daum.net/publicRelation, read 2026-11-03). Free to install and use at home, at work and in venues such as schools and internet cafes to view media on one's own computer. Not permitted without prior permission: commercial service use (Art. 3(3)); copying, redistributing, selling, renting or reselling the software, and modifying, reverse engineering or decompiling it (Art. 3(1)-(2)). The company owns the software (Art. 4), may collect system information for support (Art. 5), and may use a relay technique that passes streaming data through the user's network device (Art. 6). The agreement mentions no open-source components, ads or bundled software, and has no explicit warranty text. Consequence for formtools: cannot be bundled or redistributed. Platform: Windows (7, 8, 10 and UWP mentioned in changelog). No macOS or Linux build found.

formtools note: Proprietary and Windows-only; use only as a feature checklist.

## 2. Features seen (single source: official site changelog)

- Hardware decoding via DXVA, CUDA, QuickSync.
- 3D playback with several glasses types and layouts (side-by-side, top-bottom, page flipping); 360 degree VR playback.
- Subtitles: SMI, SRT, VobSub, Blu-ray, animated ASS/SSA.
- Built-in codecs plus an "OpenCodec" mechanism for more.
- Screen and game capture, broadcasting.
- Navigation and playlists over FTP, WebDAV, HTTP.
- AngelScript-based extension system; VapourSynth filter support.
- Not verified from fetched pages: skins, madVR/renderer options, per-file bookmarks, extensive video/audio filter lists (common reputation only).

formtools note: Capture plus 360 plus script extension in one player shows demand for a "power" tier.

## Sources

- https://potplayer.daum.net/
- https://potplayer.daum.net/publicRelation
