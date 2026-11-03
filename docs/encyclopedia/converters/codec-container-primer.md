# Codec and container primer for formtools

Not legal advice; patent facts below are what the cited primary sources say, and anything else is marked unverified.

## 1. Containers versus codecs
- A codec compresses one kind of media (a video, audio or subtitle stream). A container (muxer format) interleaves several coded streams plus timing, chapters, metadata, attachments and an index into one file.
- File extension names the container, not the codec: an .mp4 can hold H.264, H.265, AV1 and more.
- Rewrapping changes the container without touching the codec data (stream copy); transcoding decodes and re-encodes (lossy generation loss). FFmpeg calls the first `-c copy`.
- Container limits are real: per HandBrake's container docs, MP4 takes H.264/H.265/MPEG-4/MPEG-2/VP9/AV1 video and AAC/MP3/AC3/E-AC3/TrueHD/Opus/FLAC/ALAC audio with soft text subtitles; MKV is the most permissive (adds VP8, Theora, FFV1, Vorbis, bitmap subtitles); WebM (a restricted Matroska profile) takes only VP8/VP9/AV1 with Vorbis/Opus and, in HandBrake, only burned-in subtitles.

formtools note: model "container" and "codec" as separate fields in the UI, and have a compatibility matrix that filters codec choices by container.

## 2. Common ones

| Kind | Name | Notes |
|---|---|---|
| Container | MP4 / M4V / MOV | Broadest device and web support; MOV is the QuickTime sibling |
| Container | MKV (Matroska), WebM | Open; WebM is the web subset |
| Container | MPEG-TS, MXF, AVI, FLV | Broadcast, pro, legacy |
| Container | OGG, FLAC, WAV, AIFF, M4A | Audio-centric |
| Video codec | H.264 / AVC | Universal playback; software encoder x264, hardware everywhere |
| Video codec | H.265 / HEVC | Better compression; strong hardware support; licensing pools |
| Video codec | AV1 | Royalty-free; newer hardware encode/decode; software SVT-AV1, libaom |
| Video codec | VP9 / VP8 | Royalty-free (WebM project); VP9 is libvpx |
| Video codec | H.266 / VVC | Very new; Shutter Encoder lists it; FFmpeg has libvvenc |
| Video codec | ProRes, DNxHR, CineForm, FFV1 | Editing, intermediate and archival |
| Audio codec | AAC | Default in MP4 ecosystem |
| Audio codec | MP3, AC3/E-AC3, DTS, TrueHD | Legacy and home theater |
| Audio codec | Opus, Vorbis | Open, efficient; Opus is IETF RFC 6716 |
| Audio codec | FLAC, ALAC, WAV | Lossless |

## 3. Patent status (sourced)

Encumbered (licensed through pools or companies):
- H.264/AVC: Via LA runs an AVC/H.264 portfolio license, with royalties apportioned along the value chain, annual caps and thresholds below which some royalties are not charged. FFmpeg's own legal page says the standards carry vague hints that implementations may be subject to patent rights, and the FFmpeg project cannot say what is patented.
- H.265/HEVC: Access Advance runs the HEVC Advance patent pool plus other programs (VVC Advance, Video Distribution Patent Pool and others), with fair-reasonable-nondiscriminatory terms stated.
- AAC: Via LA's program requires a license for makers of end-user encoder and/or decoder products across AAC-LC, HE-AAC, xHE-AAC and related profiles; distributing AAC-encoded bitstreams does not incur patent fees per that program page. Whether an open-source app that bundles an AAC encoder or decoder needs its own license is a question for counsel; the sources do not resolve it.
- MP3, MPEG-2 and others: current patent status not verified in this pass.

Royalty-free by the owners' own statements:
- AV1: the Alliance for Open Media Patent License 1.0 grants a no-charge, royalty-free, perpetual, irrevocable patent license to necessary claims, with defensive termination if the licensee sues over the implementation. (This is a license from AOMedia members; it does not guarantee that third parties hold no claims.)
- VP9/VP8, Vorbis, Opus (WebM): the WebM project describes the format as open and royalty-free.
- Opus: reference code BSD-3-Clause; Xiph.Org, Broadcom and Microsoft grant royalty-free patent rights, terminable if you sue over Opus; four other companies filed disclosures with possibly royalty-bearing terms, though the project says counsel advised Opus can be implemented without licensing those.
- FLAC: described by Xiph as open and unencumbered by patents; the page does not name the reference implementation's license.

formtools note: label codecs in the UI with a small "licensing" hint and make royalty-free outputs (AV1, VP9, Opus, FLAC in MKV/WebM) the safe defaults; keep H.264/AAC MP4 as the compatibility option.

## 4. Copyright license vs patent license
Software copyright license (GPL, LGPL, BSD) governs the code. Patents govern the algorithms regardless of code license. An LGPL FFmpeg can still implement patented codecs, and a GPL encoder such as x264 does not by itself grant patent rights. x264 is GPL (v2) with a commercial license option from VideoLAN; its page says nothing about patents. x265 is distributed under the GNU GPL by VideoLAN's page (multicoreware hosts the source; commercial license not covered by the fetched text).

## 5. FFmpeg LGPL versus GPL builds
- Default: LGPL-2.1-or-later. Passing `--enable-gpl` activates GPL-licensed optional code (some filters and external libraries) and flips the entire binary to GPL-2.0-or-later.
- Libraries that require `--enable-gpl`: x264, x265, xvid, vidstab, rubberband, frei0r, avisynth, and others.
- `--enable-version3` moves to (L)GPL v3; needed for Apache-2.0 libraries and LGPLv3 libraries.
- `--enable-nonfree` permits GPL-incompatible libraries (Fraunhofer FDK AAC, OpenSSL under older terms); the binary becomes non-redistributable.
- LGPL-safe codec set in the encoder docs: native `aac`, libopus, libvorbis, flac, libsvtav1/libaom (not on the GPL-required list), libvpx, libwebp, libopenh264, libmp3lame (LGPL), plus platform hardware encoders (NVENC, VAAPI, QSV, VideoToolbox, AMF, MediaFoundation). H.264/H.265 software encoding in an LGPL build is limited to openh264 and hardware paths (my reading of the encoder list), which is why distributors who want x264/x265 ship GPL builds.
- Compliance for dynamic linking under LGPL: ship matching source and configure line, use shared libraries, state use of FFmpeg in about box and EULA, allow replacement and reverse engineering.

formtools note: pick the app's own license and FFmpeg distribution model together: LGPL FFmpeg as shared libs or a separate executable keeps formtools free of GPL obligations; bundling a GPL build means distributing the combined work under GPL terms or keeping it a separate downloaded component.

## Sources

- https://ffmpeg.org/legal.html
- https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- https://ffmpeg.org/ffmpeg-all.html
- https://handbrake.fr/docs/en/latest/technical/containers.html
- https://www.via-la.com/licensing-programs/avc-h-264/
- https://www.via-la.com/licensing-programs/aac/
- https://www.accessadvance.com/licensing-programs/hevc-advance/
- https://aomedia.org/license/patent-license/
- https://www.webmproject.org/about/
- https://opus-codec.org/license/
- https://xiph.org/flac/
- https://www.videolan.org/developers/x264.html
- https://www.videolan.org/developers/x265.html
