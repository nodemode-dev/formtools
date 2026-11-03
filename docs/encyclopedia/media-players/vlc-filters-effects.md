# VLC: audio and video filters, effects, geometry

Source basis: VLC 3.0 docs and wiki. Researched 2026-11-03.

## 1. Where effects live

Tools, Effects and Filters (Ctrl+E is unverified): tabs Audio Effects, Video Effects, Synchronization (and VLC 3 also a Track Synchronization). On macOS an Equalizer button and Window menu equivalents. Filters can also be applied by command line (`--video-filter`, `--audio-filter`) or in a transcode chain (`vfilter`, `afilter`, `sfilter`).

formtools note: One "Effects" panel with live preview and reset-to-default per group.

## 2. Audio effects (verified)

- Equalizer: 10-band graphic EQ with presets, must be enabled with a checkbox.
- Compressor: dynamic range compressor emulation.
- Spatializer: room-style spatial effect.
- Stereo widener: suppresses mono content and cross-delays channels.
- Advanced: pitch adjustment.
- Also in preferences: stereo mode (stereo, mono, left, right, reverse), volume above 100 percent (max VLC volume setting), audio visualizations (Goom, projectM, spectrum etc.), resampler selection, replay gain.

formtools note: Ship EQ + compressor + pitch with speed; spatializer is optional.

## 3. Video effects

Official 3.0 pages name only the menu-level features; tab names below match the Tools, Effects and Filters dialog as commonly documented (tab contents beyond Geometry/Puzzle are unverified from fetched pages).

- Video menu (verified): Aspect Ratio (default, 1:1, 4:3, 16:9, 16:10, 2.21:1, 2.35:1, 2.39:1, 5:4), Crop presets (16:10, 16:9, 1.85:1, 2.21:1, 2.35:1, 2.39:1, 5:3, 4:3, 5:4, 1:1), Zoom (1:4, 1:2, 1:1, 2:1), Deinterlace on/off plus mode, Take Snapshot.
- Deinterlace modes (verified): Discard, Blend, Mean, Bob, Linear, X, Yadif, Yadif (2x). Streaming docs add phosphor and ivtc for sout deinterlace.
- Filter module families (wiki module index): Adjust (brightness, contrast, hue, saturation, gamma), Gaussian Blur, Sharpen, Rotate, Motion Blur, Logo Erase, Transform (rotate 90/180/270, flip), Magnify, Mosaic, Wall (video wall, default 3x3 up to 15), Puzzle Game (Geometry tab), clone, Crop and padding, Logo and Marquee sub-picture overlays, Goom and ProjectM visualizations.
- Overlay: logo (image) and marquee (text) are sub-picture filters and can be streamed.

formtools note: Treat adjust (BCSH + gamma), rotate/flip, crop, deinterlace as core; wall/puzzle are novelty.

## 4. Track sync

See vlc-playback-and-sync.md section 5.

## 5. Preferences structure

Tools, Preferences has Simple and All (Advanced) views. Simple sections: Interface, Audio, Video, Subtitles/OSD, Input/Codecs, Hotkeys. "All" exposes the full module tree (Audio, Video, Input/Codecs, Stream output, Playlist, Advanced). Reset Preferences deletes preferences and plugin cache. Shortcut: Ctrl+P.

formtools note: Use the simple/advanced toggle pattern, but make advanced searchable.

## Sources

- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/settings/adjustmentsandeffects.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/settings/preferences.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/video.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/tipsandtricks/index.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/audio.html (listed in navigation only; headings used)
- https://wiki.videolan.org/Documentation:Modules/
- https://wiki.videolan.org/Documentation:Advanced_Use_of_VLC/
- https://wiki.videolan.org/Documentation:Command_line/
