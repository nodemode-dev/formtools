# VLC: Convert/Save, Streaming wizard, stream output (sout)

Researched 2026-11-03.

## 1. Concepts

Everything runs through the stream-output pipeline: source, optional `transcode` module (video codec `vcodec`, audio `acodec`, subtitle `scodec`), a muxer (`mux`), and an access output (file, HTTP, UDP, RTP, etc.). The docs describe four scenarios: remux and save (fast, no re-encode), remux and stream (including protocol proxying like UDP to HTTP), transcode and save, transcode and stream.

formtools note: Model conversion as a graph of source, filters, encoder, muxer, sink so remux is the zero-encode case.

## 2. Convert/Save wizard (GUI)

Media, Convert/Save: add input(s), choose destination file and a profile from a dropdown, Start. Profiles are editable and can be created (container, video codec, audio codec, subtitle options). Streaming wizard: Media, Stream: choose source, pick destination (display locally, File, HTTP, MS-WMSP/MMSH, UDP, RTP, IceCast), optional SAP/SLP announce, transcoding profile, then a editable "Stream Output MRL" string is shown. Containers named for profiles: MPEG-TS, MPEG-PS, Ogg, ASF, AVI, MP4, MOV. Known quirks from the wiki: a missing file suffix can silently pick FLV; MP4 is only supported for files, not live streaming; clients can fail below 5 fps.

Stock profile list (23 entries), read from the 3.0.x branch of the official VLC repository, file modules/gui/qt/components/sout/profiles.hpp, in dropdown order:
- Video: H.264 + MP3 (MP4); VP80 + Vorbis (Webm); H.264 + MP3 (TS); H.265 + MP3 (MP4); Theora + Vorbis (OGG); MPEG-2 + MPGA (TS); Dirac + MP3 (TS); WMV + WMA (ASF); DIV3 + MP3 (ASF).
- Audio: Vorbis (OGG); MP3; FLAC; CD (16-bit PCM in WAV).
- Device presets: MPEG4 720p TV/device; MPEG4 1080p TV/device; DivX compatible player; iPod SD; iPod HD/iPhone/PSP; Android SD Low; Android SD High; Android HD; Youtube SD; Youtube HD.
Each profile is a semicolon-separated key list (audio_codec, acodec_bitrate, acodec_channels, acodec_samplerate, video_codec, vcodec_bitrate, vcodec_framerate, vcodec_width/height, muxer_mux). Typical defaults are 128 kb/s stereo 44.1 kHz audio; the H.264 MP4 default leaves video bitrate at 0 while the TS variant uses 800 kb/s. This is the 3.0 branch; later versions may differ.

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
- https://raw.githubusercontent.com/videolan/vlc/3.0.x/modules/gui/qt/components/sout/profiles.hpp
