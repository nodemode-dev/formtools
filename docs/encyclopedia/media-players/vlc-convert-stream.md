# VLC: Convert/Save, Streaming wizard, stream output (sout)

Researched 2026-11-03.

## 1. Concepts

Everything runs through the stream-output pipeline: source, optional `transcode` module (video codec `vcodec`, audio `acodec`, subtitle `scodec`), a muxer (`mux`), and an access output (file, HTTP, UDP, RTP, etc.). The docs describe four scenarios: remux and save (fast, no re-encode), remux and stream (including protocol proxying like UDP to HTTP), transcode and save, transcode and stream.

formtools note: Model conversion as a graph of source, filters, encoder, muxer, sink so remux is the zero-encode case.

## 2. Convert/Save wizard (GUI)

Media, Convert/Save: add input(s), choose destination file and a profile from a dropdown, Start. Profiles are editable and can be created (container, video codec, audio codec, subtitle options). Streaming wizard: Media, Stream: choose source, pick destination (display locally, File, HTTP, MS-WMSP/MMSH, UDP, RTP, IceCast), optional SAP/SLP announce, transcoding profile, then a editable "Stream Output MRL" string is shown. Containers named for profiles: MPEG-TS, MPEG-PS, Ogg, ASF, AVI, MP4, MOV. Known quirks from the wiki: a missing file suffix can silently pick FLV; MP4 is only supported for files, not live streaming; clients can fail below 5 fps. The exact stock profile list (Video H.264+MP3 MP4, Video H.265, Audio MP3, Audio FLAC, etc.) is not in the fetched docs (unverified).

formtools note: Show the generated command/chain beside the GUI so power users can learn and copy it.

## 3. Transcode options (command line)

Example parameters verified: `vb`, `ab`, `fps`, `samplerate`, `channels`, `vfilter`, `sfilter`, `afilter`, `venc=x264{profile=main,keyint=30}`, `aenc`, `senc`. Typical form: `--sout "#transcode{...}:std{access=file,mux=mp4,dst=out.mp4}"`. H.265 yields smaller files than H.264; Theora/Vorbis need Ogg, not MP4. 2026 docs add notes for AMF hardware encoders (FFmpeg AMF) and a Linux transcription tip.

formtools note: Presets should carry a codec/container compatibility matrix to prevent invalid pairs.

## 4. Streaming protocols

HTTP (most common, listen port and path), UDP (unicast or multicast, TS only), RTP (unicast or multicast), RTSP, MMSH for Windows Media (ASF only), IceCast. 3.0.24 adds SRT listener mode and RIST improvements. Docs pages also cover SAP announcements, VLM (VideoLAN Manager scripting for broadcast and mosaics), screen recording, adding a logo, batch encode, extract audio, merge videos, rip DVD.

formtools note: Out of scope for v1; offer "save as/convert" first, streaming server later.

## 5. Capture and recording

Desktop and webcam capture are done as inputs in Convert/Save or Open Capture Device (screen:// style input, DirectShow on Windows). Record button for live playback (see vlc-playback-and-sync.md).

## Sources

- https://docs.videolan.me/vlc-user/desktop/3.0/en/advanced/index.html (TOC)
- https://docs.videolan.me/vlc-user/desktop/3.0/en/advanced/transcode/transcode_introduction.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/advanced/transcode/transcode_and_save.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/basic/tipsandtricks/index.html
- https://docs.videolan.me/vlc-user/desktop/3.0/en/advanced/streaming/introduction.html (stub)
- https://wiki.videolan.org/Documentation:Streaming_HowTo_New/
- https://www.videolan.org/vlc/releases/3.0.24.html
