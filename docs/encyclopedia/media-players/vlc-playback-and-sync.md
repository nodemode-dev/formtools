# VLC: playback, sources, subtitles, sync, snapshot, recording

Researched 2026-11-03 against VLC 3.0 docs. "(unverified)" = not confirmed in a fetched primary page.

## 1. Formats and codecs

- Wiki format table (last edited 2019, "under development"): video playable includes MPEG-1/2, MPEG-4 Part 2, H.264, H.263, DV, Theora, WMV, VP3/5/6, Indeo, RealVideo 1/2, Dirac, Huffyuv; audio includes MP3, AAC, HE-AAC, AC-3, DTS core, Vorbis, FLAC, ALAC, WMA 1/2, Musepack, AMR, Speex. Not supported: DTS-HD, WMA9 (per that page). Containers playable: AVI, MP4, MOV, MKV, OGG, ASF, FLV, 3GP, MPEG TS/PS, WAV, Nut. Muxing targets: ASF, AVI, FLV, MOV, MP4, OGG, MPEG TS, Nut, WAV.
- The table is dated; 3.0.24 added ATRAC3/9 and CEA-708 in MP4, and the FFmpeg base is now 8.1.x, so the real list is larger (modern HEVC/AV1 via bundled libs: unverified from this docs page).
- VLC plays without codec packs per the official site.

formtools note: Build the codec list from the decoder library at runtime (probe) instead of a hand-kept table.

## 2. Hardware decoding

Wiki (old, 2013-era) lists DXVA 2.0 on Windows, VA-API and VDPAU on Linux, VDA on macOS. Settings live in Preferences, Input/Codecs, with a method dropdown since VLC 2.1.

Modules in the 3.0.x branch of the official repository (checked 2026-11-03 by reading module descriptions): the preference `avcodec-hw` selects among modules with the "hw decoder" capability, default "any".
- Windows: "DirectX Video Acceleration (DXVA) 2.0" (priority 100) and "Direct3D11 Video Acceleration" (priority 110, preferred when both load).
- Linux: "VA-API video decoder" (X11 and a DRM variant) and "VDPAU video decoder".
- macOS: "VideoToolbox video decoder" is a separate video decoder module (capability priority 800), not under the avcodec-hw setting; the old VDA path is not in the 3.0.x build files.
- NVDEC/CUVID: no module found in 3.0.x.
- Android and iOS use their own decoders (MediaCodec, VideoToolbox, OpenMAX IL); not enumerated here.

formtools note: Expose a hwdec dropdown with "auto" default and per-API fallbacks, plus a log line saying which one engaged.

## 3. Sources: files, discs, network, devices

Media menu: Open File, Open Disc (DVD, Blu-ray, audio CD, VCD/SVCD; choose title, chapter, audio and subtitle track), Open Network Stream (URL tab; also acts as streaming client/server for MPEG unicast/multicast), Open Capture Device (Video4Linux, Hauppauge PVR with TV norm and tuner frequency). Drag and drop onto window or playlist. Command-line MRLs: dvd://, dvdsimple://, vcd://, cdda://, rtp://, http://, rtsp://. DVB/TS streams expose "Program" selection by service ID. Titles, chapters, bookmarks (Custom Bookmarks manager), and Jump to Specific Time (hh:mm:ss) are in the Playback menu. libbluray/libaacs updates in 2026 add HDR10+ and Dolby Vision metadata exposure for Blu-ray.

formtools note: Treat "source" as a unified open dialog with tabs: File, Disc, URL, Capture.

## 4. Subtitles

- External files: MicroDVD, SubRip, SubViewer, SSA/ASS, SAMI, VobSub (pick the .idx). Embedded: DVD, SVCD (image), OGM, Matroska (text). Wiki lists more text formats (JACOsub, MPL2, MPSub, RealText, USF, VPlayer) and image formats (DVB, Blu-ray, XSUB, CVD). 3.0.24 improved WebVTT.
- Loading: Open Multiple Files dialog (subtitle file checkbox, with encoding, alignment, size) or Video, Subtitle Track, Add Subtitle File.
- Styling: Preferences, Subtitles/OSD, text renderer: font, size (relative or pixels), effects. Changes need a restart of the stream. Image-based tracks cannot be restyled.
- Disable: Subtitle menu, or default subtitle track ID -1.
- Auto-download: via Lua extensions (VLsub is the common one); docs fetched here do not describe it, and the add-ons site blocks robots (unverified). Official add-ons overview says extensions are `.lua` files installed to the VLC directory or from the add-ons site.

formtools note: Support SRT/ASS/WebVTT first; offer an online-search provider interface instead of hardcoding one.

## 5. Synchronization

- Audio vs video: `k` delays audio, `j` advances it.
- Subtitle vs audio: `h` delays subtitles, `g` advances them.
- Bookmark sync: Shift+h marks audio time, Shift+j marks subtitle time, Shift+k applies; wiki lists Ctrl+Shift+K to reset (older Qt4 page).
- Numeric: Tools, Track Synchronization, Synchronization tab: audio track sync, subtitle speed and duration factors (positive advances, negative delays).
- Hotkey values step in small increments (50 ms in practice: unverified).

formtools note: Offer both tap-nudge keys and a numeric field with a visible running offset.

## 6. Speed, frame step, A-B loop

- Speed: `+` faster, `-` slower, `=` normal, `]` and `[` fine adjustments (wiki Qt4 list).
- Frame by frame: `e` (next frame). Checked against the official source: the 3.0.x branch defines only `key-frame-next` (default `e`); there is no backward-step hotkey in 3.0. The development (master, 4.0) branch adds `key-frame-previous` with default Shift+e.
- A-B loop: in 3.0 it is a toolbar button ("Loop from point A to point B continuously", the A to B Loop item in View, Advanced Controls). The 3.0.x hotkey table has no default key for it (the `key-loop` hotkey, `l`, is the playlist loop mode, not A-B). Click once to set A, again to set B, a third time to clear.
- Official wiki hotkey page lists only Next frame (E) and no A-B or backward step.
- Pitch is adjustable in Audio Effects, Advanced.

formtools note: A-B loop and frame step (both directions) should be first-class buttons, not buried.

## 7. Snapshot and recording

- Snapshot: Video, Take Snapshot; PNG to the Pictures folder by default; Shift+S (Win/Linux), Cmd+Alt+S (macOS). Filename templates are supported through format codes; options (format, folder, prefix) live in Video preferences.
- Recording while playing: Record button hidden until View, Advanced Controls; files named vlc-record-Date-Time-Channel-Track.ext in the folder set at Preferences, Input/Codecs. Desktop and webcam recording go through Convert/Save capture mode (see vlc-convert-stream.md).

formtools note: Snapshot should copy to clipboard and save, with a configurable template.

## 8. Playlist and media library

The wiki guide lists a Playlist chapter and playlist formats are parsed by the playlist demuxer plus Lua playlist scripts (probe/parse functions; ship scripts for Vimeo, Dailymotion and similar sites). Media library: checked against the official source tree on 2026-11-03. The 3.0.x branch has no medialibrary directory in the Qt interface, so VLC 3.0 desktop has no browsable media library (only the playlist and its Local/Media Library nodes). The development master branch (4.0) has a Qt medialibrary UI (medialib.cpp, folders model) built on a core `vlc_ml` API with event callbacks, giving a folder-scanned video and music library. Treat the 4.0 library as unreleased. Loop modes via L key, `--random`, `--loop`, `--repeat`, `--play-and-stop`.

formtools note: Keep playlist as simple ordered queue first; library is a later, separate module.

## Sources

- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/media.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/playback.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/subtitles.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/video.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/hotkeys.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/settings/adjustmentsandeffects.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/recording/playing.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/tipsandtricks/index.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/addons/index.html
- https://wiki.videolan.org/VLC_Features_Formats/
- https://wiki.videolan.org/Hotkeys/
- https://wiki.videolan.org/GPU_decoding/
- https://wiki.videolan.org/Documentation:Subtitles/
- https://wiki.videolan.org/Documentation:Command_line/
- https://wiki.videolan.org/Documentation:Play_HowTo/Building_Lua_Playlist_Scripts/
- https://www.videolan.org/news.html
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/src/libvlc-module.c
- https://raw.githubusercontent.com/videolan/vlc/master/src/libvlc-module.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/gui/qt/components/controller.cpp
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/gui/qt/input_manager.cpp
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/codec/avcodec/avcodec.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/codec/avcodec/dxva2.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/codec/avcodec/d3d11va.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/codec/avcodec/vaapi.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/hw/vdpau/avcodec.c
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/codec/videotoolbox.m
- https://raw.githubusercontent.com/videolan/vlc/master/modules/gui/qt/medialibrary/medialib.cpp
