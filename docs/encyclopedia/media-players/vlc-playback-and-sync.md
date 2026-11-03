# VLC: playback, sources, subtitles, sync, snapshot, recording

Researched 2026-11-03 against VLC 3.0 docs. "(unverified)" = not confirmed in a fetched primary page.

## 1. Formats and codecs

- Wiki format table (last edited 2019, "under development"): video playable includes MPEG-1/2, MPEG-4 Part 2, H.264, H.263, DV, Theora, WMV, VP3/5/6, Indeo, RealVideo 1/2, Dirac, Huffyuv; audio includes MP3, AAC, HE-AAC, AC-3, DTS core, Vorbis, FLAC, ALAC, WMA 1/2, Musepack, AMR, Speex. Not supported: DTS-HD, WMA9 (per that page). Containers playable: AVI, MP4, MOV, MKV, OGG, ASF, FLV, 3GP, MPEG TS/PS, WAV, Nut. Muxing targets: ASF, AVI, FLV, MOV, MP4, OGG, MPEG TS, Nut, WAV.
- The table is dated; 3.0.24 added ATRAC3/9 and CEA-708 in MP4, and the FFmpeg base is now 8.1.x, so the real list is larger (modern HEVC/AV1 via bundled libs: unverified from this docs page).
- VLC plays without codec packs per the official site.

formtools note: Build the codec list from the decoder library at runtime (probe) instead of a hand-kept table.

## 2. Hardware decoding

Wiki (old, 2013-era) lists DXVA 2.0 on Windows, VA-API and VDPAU on Linux, VDA on macOS. Settings live in Preferences, Input/Codecs, with a method dropdown since VLC 2.1. Modern equivalents (D3D11VA, VideoToolbox, NVDEC) are not on the fetched pages (unverified).

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
- Frame by frame: `e` (next frame) per the same list. No backward step in 3.0 as far as fetched pages show (unverified).
- A-B loop: present in the Advanced Controls row (View, Advanced Controls) in 3.0; the fetched pages do not document it, so key and behavior are unverified.
- Pitch is adjustable in Audio Effects, Advanced.

formtools note: A-B loop and frame step (both directions) should be first-class buttons, not buried.

## 7. Snapshot and recording

- Snapshot: Video, Take Snapshot; PNG to the Pictures folder by default; Shift+S (Win/Linux), Cmd+Alt+S (macOS). Filename templates are supported through format codes; options (format, folder, prefix) live in Video preferences.
- Recording while playing: Record button hidden until View, Advanced Controls; files named vlc-record-Date-Time-Channel-Track.ext in the folder set at Preferences, Input/Codecs. Desktop and webcam recording go through Convert/Save capture mode (see vlc-convert-stream.md).

formtools note: Snapshot should copy to clipboard and save, with a configurable template.

## 8. Playlist and media library

The wiki guide lists a Playlist chapter and playlist formats are parsed by the playlist demuxer plus Lua playlist scripts (probe/parse functions; ship scripts for Vimeo, Dailymotion and similar sites). Media library (SQL-based library with video/music browsing) is a Qt-side feature; fetched pages do not describe it, so details are unverified. Loop modes via L key, `--random`, `--loop`, `--repeat`, `--play-and-stop`.

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
