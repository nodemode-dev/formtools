# FFmpeg as an engine

Snapshot 2026-11-03. The download page lists 9.0.2 "Lei" (2026-09-18) and 8.1.3 (2026-09-21) as current releases, so "latest" depends on branch. FFmpeg ships source only; prebuilt binaries come from third parties (Linux distro/static builds, gyan.dev and BtbN for Windows, evermeet.cx for macOS), whose licensing must be checked individually.
Tools: `ffmpeg` (transcode), `ffprobe` (inspect), `ffplay` (play); libraries libavformat, libavcodec, libavfilter, libswscale, libswresample.

## 1. Pipeline model
- Each `-i` input has a demuxer producing packets per stream; decoders make raw frames; filtergraphs transform frames; encoders produce packets; the muxer interleaves and writes the output.
- Stream copy (`-c copy`): packets go straight from demuxer to muxer; fast and lossless, but no filters and the target container may reject some streams.
- Automatic selection with no `-map`: best video (highest resolution), audio with most channels, one matching subtitle; data/attachment streams never auto-picked. Any `-map` switches to explicit selection. `-vn -an -sn -dn` disable stream types. Stream specifiers like `a:1` or `v` address streams.

formtools note: build every job as (inputs, stream map, per-stream codec/filters, muxer) so one schema covers convert, rewrap, extract and replace-audio.

## 2. Trimming and seeking
- `-ss` as input option seeks to the previous seek point; with transcoding it decodes and discards the gap (accurate); with stream copy the gap is kept (starts on keyframe, so copy-cuts are not frame accurate). As output option it decodes and discards until the time.
- `-to` end time, `-t` duration; `-t` wins if both are set.

formtools note: UI should tell users whether a cut is "fast (keyframe)" or "exact (re-encode)".

## 3. Filtergraphs
- Simple graphs via `-vf` / `-af` (one in, one out, same type, bound to one output stream). Complex graphs via `-filter_complex` (global, multiple inputs/outputs, mixed types, labeled pads that must be mapped). Filter graphs can be loaded from a file.
- Common filters, with facts from the filter reference:
  - `scale`: resizes via libswscale; width/height expressions; `-n` for one dimension keeps aspect and rounds to a multiple of n; `force_original_aspect_ratio`, `force_divisible_by`; can convert pixel format; keeps display aspect by changing sample aspect ratio.
  - `crop`: out_w, out_h, x, y (default centered), `keep_aspect`, `exact`. (`cropdetect` helps find bars but is GPL-only code, see primer.)
  - `fps`: forces constant frame rate by duplicating or dropping; accepts constants like ntsc, pal, film; `start_time`, `round`, `eof_action`.
  - `loudnorm`: EBU R128 loudness normalization; targets integrated loudness (default -24), loudness range (7), true peak (-2); dynamic or linear mode; two-pass using `measured_*` values from a first pass with `print_format=json`; upsamples to 192 kHz internally in dynamic mode so set the output sample rate explicitly.
  - `subtitles`: burns subtitles via libass (requires `--enable-libass`); options filename, `force_style` (ASS style overrides), `fontsdir`, `charenc`, `stream_index`, `original_size`.
  - `concat` filter: joins segments of synchronized streams; all segments need same stream counts and compatible parameters; works on decoded frames so it re-encodes.
  - Others commonly used: `overlay`, `drawtext`, `yadif`, `zscale`, `tonemap`, `palettegen`/`paletteuse` (GIF palettes), `setpts`, `format`, `hwupload`/`hwdownload`.

formtools note: expose filters as typed nodes with validated parameters rather than free-form strings, and serialize to a filtergraph string in one place.

## 4. Concat, segment and sequence muxing
- Concat demuxer: text script with `file`, `duration`, `inpoint`, `outpoint`; first line version header; `safe` mode rejects unsafe paths by default; lossless when inputs share codec parameters. Good for stream-copy joins; the concat filter is for mismatched inputs.
- Segment muxer: splits output into nearly fixed-duration files, each starting on a keyframe of the reference stream; optional segment list; accurate splitting needs keyframes aligned to the desired times. `stream_segment` variant suits MPEG-TS style outputs.
- HLS and DASH muxers write playlists/manifests and segments (DASH confirmed in the formats doc; HLS section exists, details not read).
- image2 demuxer: reads numbered images (`%04d` pattern, glob) as video with `framerate`, `start_number`; image2 muxer writes frames out.

formtools note: "image sequence in/out" and "split into N-minute parts" map directly to image2 and segment; implement both with copy where possible.

## 5. Hardware acceleration
- `-hwaccel` is a per-input decode option (values documented: none, auto, vdpau, dxva2, d3d11va, vaapi, qsv, videotoolbox; the QSV value is for full QSV transcoding without filters); `-init_hw_device` and `-filter_hw_device` set up devices. The docs warn most hardware decode paths target playback and may be no faster than software on modern CPUs because frames get copied back to system memory.
- Hardware encoders in the encoder docs: NVENC (`h264_nvenc`, `hevc_nvenc`, `av1_nvenc`; needs nv-codec-headers), VAAPI encoders (need `hwupload` for software frames), QSV (MPEG-2, H.264, HEVC, MJPEG, VP9, AV1), MediaFoundation (`h264_mf`, `hevc_mf`, `av1_mf`; D3D11 for hardware scaling), AMF (AMD), VideoToolbox (Apple).
- Encoder availability depends on how the binary was built, not just on the GPU.

formtools note: probe `ffmpeg -encoders` and try a 1-frame test encode at startup to confirm a hardware encoder really works before offering it.

## 6. Software encoders worth exposing
libx264 and libx265 (GPL), libsvtav1 and libaom-av1 (AV1), libvpx-vp9 (VP9), libopus, native `aac`, libmp3lame, flac, plus libjxl, libwebp, libtheora, libvvenc (H.266) and libopenh264 (BSD, Cisco) in the encoder list.

## 7. Licensing and build configurations
- FFmpeg is LGPL-2.1-or-later by default; optional GPL parts activate only with `--enable-gpl`, which makes the whole build GPL-2.0-or-later.
- GPL external libraries named in the license file include libx264, libx265, libxvid, libvidstab, librubberband, frei0r, avisynth; they require `--enable-gpl`.
- `--enable-version3` upgrades to (L)GPL v3 and is needed for libraries such as OpenCORE, VisualOn, mbedTLS, gmp, libaribb24.
- `--enable-nonfree` is for libraries incompatible with GPL/LGPL redistribution (Fraunhofer FDK AAC, OpenSSL in older terms); the resulting binary is not redistributable.
- LGPL compliance checklist from the legal page: no `--enable-gpl`, no `--enable-nonfree`, dynamic linking, ship matching source and configure line, attribution text and about box mention, EULA must not forbid reverse engineering, do not rename DLLs to obfuscated names.
- Filters that live in GPL source files (so absent from LGPL builds) include hqdn3d, cropdetect, eq, pullup, delogo, boxblur, blackframe, mpdecimate, nnedi.
- FFmpeg states it does not know whether it uses patented algorithms and is not legal advice; patents are a separate matter from copyright license (see codec-container-primer.md).

formtools note: ship an LGPL-config FFmpeg (no x264/x265) by default and offer an optional GPL build or user-supplied binary; select AV1/VP9/Opus/FLAC and platform hardware encoders as defaults.

## 8. ffprobe
Used for stream/format inspection with JSON output; central to a pre-flight "what is in this file" step (not deeply verified from sources in this pass, tool is listed in the official docs index).

## Sources

- https://ffmpeg.org/ffmpeg.html
- https://ffmpeg.org/ffmpeg-all.html
- https://ffmpeg.org/ffmpeg-filters.html
- https://ffmpeg.org/ffmpeg-formats.html
- https://ffmpeg.org/legal.html
- https://ffmpeg.org/download.html
- https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
