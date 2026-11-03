# HandBrake (GUI and engine) feature encyclopedia

Snapshot date: 2026-11-03. Latest stable seen: 1.11.2 (published 2026-06-07; it bumped bundled FFmpeg to 8.0.2 and SVT-AV1 to 4.1.0).
License: GPL-2.0 (GitHub repo page). Platforms: Windows, macOS, Linux (plus BSD build docs). Engine: libhb, which uses FFmpeg libavformat/libavcodec for demux/decode, plus x264, x265, SVT-AV1 and other encoders.

Legend: "(CLI-derived)" means the GUI control is inferred from the matching HandBrakeCLI flag because the GUI docs do not enumerate it. "(single source)" means only one fetched page supports the claim.

## 1. Source scanning and opening

- Open Source button or drag-and-drop onto the main window; a scan runs and then the file name and details appear. Title dropdown picks among multiple titles (DVD/Blu-ray). (single source: open-video-source page)
- Decoding is via FFmpeg libraries, so most things FFmpeg opens will open; DVD and Blu-ray are read directly, though copying the disc to disk first is advised. ISO usually opens; BIN+CUE, MDF+MDS and Toast images must be mounted first. AVCHD/HD-DVD playlists are only partly supported.
- Professional inputs named in docs: MXF, MPEG-TS, QuickTime; codecs CineForm, DNxHD/DNxHR, ProRes, XAVC, XDCAM. Consumer editor projects (iMovie, Shotcut) must be exported first. Analog (VHS) needs a capture step.
- No DRM or copy-protection circumvention; the project states it does not defeat copy protection.
- Opening a folder of files treats it as one source for batch use; subfolders are ignored.
- CLI scan controls (CLI-derived GUI equivalents): scan all titles (`-t 0`), `--main-feature`, `--min-duration`/`--max-duration`, `--previews` count, `--keep-duplicate-titles` (Blu-ray).

formtools note: scan-then-select-title is the right mental model for disc sources, but formtools should treat disc ripping as out of scope initially and focus on file and folder sources.

## 2. Presets

Built-in categories (docs list six; deprecated/legacy hidden): General, Web, Devices, Matroska, Hardware, Production.

| Category | Names (summarized) |
|---|---|
| General (MP4) | Very Fast / Fast / HQ / Super HQ tiers, each at 2160p60 4K (AV1 and HEVC variants), 1080p30, 720p30, 576p25, 480p30. HQ and Super HQ carry "Surround" in the name. The 2160p60 rows come in AV1 and HEVC flavors; the lower rungs are H.264. |
| Web (MP4) | Creator 2160p60 4K, 1440p60 2.5K, 1080p60, 720p60; Social 25 MB presets sized by clip length: 30 s at 1080p60, 1 min at 720p60, 2 min at 540p60, 5 min at 360p60 |
| Devices | Amazon Fire (2160p HEVC, 1080p30, 720p30), Android (1080p30 to 480p30), Apple (2160p60 HEVC, 1080p60, 1080p30, 720p30, 540p30), Chromecast (2160p60 HEVC, 1080p60, 1080p30), Playstation (2160p60, 1080p30, 720p30, 540p30), Roku (2160p60 HEVC in MKV, 1080p30, 720p30, 576p25, 480p30), Xbox 1080p30 |
| Matroska (MKV) | AV1 2160p60; H.265 at 2160p60, 1080p30, 720p30, 576p25, 480p30; H.264 same ladder; VP9 same ladder |
| Hardware (MP4) | AV1 QSV 2160p60; H.265 at 2160p60 and 1080p60 for each of NVENC, QSV, VCN (AMD), MF (Media Foundation), Apple VideoToolbox |
| Production (MP4) | Production Max, Production Standard, Production Proxy 1080p, Production Proxy 540p (proxies are intra-only) |

- Default recommendation in docs for general playback is Fast 1080p30. A preset can be set as startup default.
- Custom presets: "Save New Preset" snapshots the main window; export/import individually or in batches (JSON files; stored as `presets.json` on Windows and Flatpak, `UserPresets.json` on macOS).
- Presets store audio/subtitle selection RULES (languages, passthrough behavior), not specific track numbers, so they re-apply to each new source.
- CLI: `-Z/--preset`, `-z/--preset-list`, `--preset-import-file`, `--preset-export`, `--preset-export-file`, `--preset-export-description`.

formtools note: ship a small curated preset set (web, archive, mobile, proxy) as JSON that stores rules rather than track indexes, mirroring HandBrake's portable design.

## 3. Main window tabs

The docs pages fetched do not enumerate every tab control, so control lists below combine documented behavior with CLI flags (CLI-derived).

### 3.1 Summary tab
- Container (format): MP4/M4V, MKV, WebM; MOV appears in CLI formats.
- Web Optimized (MP4 fast-start, CLI `-O/--optimize`), Align A/V start (`--align-av`), iPod 5G atom (`-I`) kept only for legacy.
- "Passthru common metadata": copies a standard tag set (title, episode/season, rating, description, credits, music tags, iTunes-style IDs) from source. CLI `--keep-metadata` / `--no-metadata`.
- Tracks and preset summary are shown here (inferred).

formtools note: expose "optimize for web streaming" and "keep metadata" as first-class toggles on the output settings panel.

### 3.2 Dimensions tab
- Resolution limit dropdown (caps output size), auto-crop with custom override and live preview, optional upscaling checkbox (still bounded by the limit).
- Anamorphic: Automatic (recommended), Off (manual width/height), Custom (full control). CLI maps: `--non-anamorphic`, `--auto-anamorphic`, `--loose-anamorphic`, `--custom-anamorphic`, `--display-width`, `--pixel-aspect`, `--itu-par`, `--keep-display-aspect`, `--modulus`.
- Crop: CLI `--crop-mode` (auto, conservative, none, custom), `--crop t:b:l:r`, smart-crop thresholds `--crop-threshold-pixels`, `--crop-threshold-frames`.
- Orientation (rotate/flip) and padding are filter-level in recent versions: `--rotate`, `--pad`. Docs page for resizing does not describe them.
- Color range/matrix signalling: `--color-range`, `-M/--color-matrix`.

formtools note: default to auto-crop and "keep aspect, mod-2/16 aligned" and hide anamorphic behind an Advanced toggle.

### 3.3 Filters tab
Filter list from the filters summary page plus the CLI reference:
- Detelecine (pullup), Comb Detect (drives conditional deinterlace), Deinterlace with Yadif or Bwdif, Decomb (adaptive; tunes: default, skip spatial check, EEDI2, bob).
- Deblock, Deband.
- Denoise: NLMeans (higher quality, slower; tunes film, grain, high motion, animation, tape, sprite) or HQDN3D (faster); BM3D appears in CLI.
- Chroma Smooth (for poor analog/DVD sources), Sharpen via Unsharp or Lapsharp, Colorspace conversion/tone-map (BT.2020, BT.709, BT.601 SMPTE-C, BT.601 EBU), Grayscale, Rotate/Flip, Pad.
- Hardware decode is turned off automatically when a CPU filter such as crop/scale is active (NVENC page), so filters interact with hardware paths.

formtools note: present filters as named presets (light/medium/strong) with a tune dropdown, because HandBrake's own filter presets are the most approachable part.

### 3.4 Video tab
- Video encoder (software): x264, x265 (8/10/12-bit variants), SVT-AV1 (8/10-bit), libvpx VP8/VP9, Theora (deprecated), MPEG-4, MPEG-2, FFV1. Hardware: see section 6.
- Framerate: "Same as source" or fixed; mode Variable, Constant or Peak (peak caps fast footage and leaves slower footage alone; presets since 1.0.0 use peak). CLI `--vfr/--cfr/--pfr`, `-r`.
- Quality: Constant Quality (RF slider; lower is better for x264/x265/SVT-AV1; reversed for some encoders such as VideoToolbox) or Average Bitrate with optional multi-pass and Turbo first pass. Suggested RF: x264/x265 18-22 (480p/576p), 19-23 (720p), 20-24 (1080p), 22-28 (2160p); SVT-AV1 22-32 (SD), 25-35 (720p/1080p), 25-40 (4K). RF values are not comparable across encoders.
- Encoder preset (speed/efficiency), tune (for x264/x265: animation, grain, etc.), profile, level, and an Additional Options string (CLI `-x/--encopts`, colon-separated).
- HDR: HDR10 static metadata carried for 10-bit-capable encoders; HDR10+ and Dolby Vision (profiles 5, 7 converted to 8.1, 8.1, 8.4) supported on x265, SVT-AV1 and VideoToolbox HEVC. Hardware NVENC and VCN write HDR10 data only at container level.
- Bit depth: 10/12-bit available for x264, x265, QSV, NVENC, VideoToolbox, SVT-AV1, VP9, FFV1 (per bit-depth page).

formtools note: lead with a three-position "quality" control mapped per encoder to the right RF/CQ range, and keep raw encoder options in an advanced field.

### 3.5 Audio tab
- Track selection rules: none, first matching track per chosen language, or all matching; language list; Unknown/Any options for untagged sources. These live in Preferences-like "audio defaults", applied on scan.
- Per track: encoder, mixdown (CLI `-6`), sample rate (`-R`), bitrate (`-B`) or quality (`-Q`), compression (`-C`), DRC (`-D`), gain (`--gain`), dither, track name (`-A`), Normalize mix.
- Passthrough ("Auto Passthru") of AC3, E-AC3, DTS, DTS-HD, TrueHD, AAC, MP3, Opus, Vorbis, FLAC, ALAC; if the source codec is not allowed in the output container a fallback encoder (`--audio-fallback`) re-encodes. `--audio-copy-mask` restricts which codecs may be copied.
- Encoding modes: average bitrate for all encoders except FLAC, ALAC, TrueHD; quality mode for AAC, MP3, Vorbis, Opus; lossless FLAC/ALAC only in MKV/MP4.
- Audio filters: compressor (voice/music tunes) and noise gate.

formtools note: default to "copy if compatible, else AAC/Opus" so users get no needless re-encodes.

### 3.6 Subtitles tab
- Add tracks from source (soft), import external SRT (with codeset selection and millisecond offset) or SSA/ASS.
- Burn In: permanently drawn; only one burned track allowed for MP4 and MKV. Forced-only mode, default flag, and "Foreign Audio Search (Bitmap)" scan that finds subtitles used 10 percent of the time or less plus forced ones.
- Passthrough limits: Blu-ray PGS cannot pass into MP4; CEA-608 captions pass to MKV/MP4; ASS/SSA to MP4 is simplified to bold/italic/underline.
- CLI: `-s`, `--subtitle-burned`, `--subtitle-default`, `-F`, `--srt-file/--srt-offset/--srt-lang/--srt-burn`, `--ssa-*`, `--subtitle-lang-list`, `--all-subtitles`, `--first-subtitle`.

formtools note: offer "burn in" and "keep as selectable track" as two clearly labeled choices and warn about MP4 limits.

### 3.7 Chapters tab
- Chapter markers from source carried to MP4, MKV, WebM; unnamed chapters get default names "Chapter n"; names are editable. Import/export list as CSV on Windows and macOS; XML on Linux (per docs). Cannot create chapters not in the source. CLI `-m/--markers`.

formtools note: chapter names import/export as CSV is cheap to implement and worth copying.

### 3.8 Point-to-point range
- Encode a portion by chapters, by seconds, or by frames; frame precision depends on source. CLI `--start-at`, `--stop-at`, `-c`.

formtools note: unify range as a start/end time pair with an optional "snap to keyframe, no re-encode" mode, which HandBrake lacks.

## 4. Queue, batch and process isolation

- "Add to Queue" captures source, title, preset and per-job settings; "Add all titles" exists (Windows Queue menu, macOS File menu dialog, Linux Add Multiple). Start from the Queue window or the main window.
- Batch advice: enable automatic file naming and include the title in the name format to avoid overwrites. Edit a queued job by reopening it in the main window (it leaves the queue) then re-adding.
- Process isolation: each encode runs in its own worker process, so a crash does not take down the UI or the queue; multiple simultaneous encodes possible on Windows and macOS (not yet Linux); Windows worker listens on localhost only. Always on, except a portable.ini opt-out (docs are internally inconsistent on whether it can be disabled).
- Save/load queue, pause and when-done actions are not covered in the fetched queue page (not verified).
- Preview: encode a short clip to test settings; Activity Log exposes the encode log.

formtools note: model the queue as a persisted list of job specs executed by isolated worker processes with a localhost-only control channel.

## 5. Containers and codecs supported (output)

- MP4/M4V: video H.264, H.265, MPEG-4, MPEG-2, VP9, AV1; audio AAC, MP3, AC3, E-AC3, TrueHD, Opus, FLAC, ALAC; soft text subtitles; chapters; fast-start.
- MKV: adds VP8, Theora, FFV1, Vorbis; soft bitmap (VobSub) and text subtitles; DTS/TrueHD passthrough from discs.
- WebM: VP8, VP9, AV1 with Vorbis or Opus; only burned subtitles.

formtools note: drive container choice from a compatibility table like this one so the UI can disable impossible codec/container pairs.

## 6. Hardware encoders (docs-level requirements)

| Encoder | Codecs (docs/CLI) | Requirements and caveats |
|---|---|---|
| Apple VideoToolbox | H.264, H.265, H.265 10-bit, ProRes (CLI `vt_*`) | Encoding on most Macs from 2011; decoding needs macOS 13+; quality scale may be reversed vs software; scaler looks softer |
| NVIDIA NVENC | H.264, H.265, AV1 (8 and 10-bit variants in CLI) | RTX 2060 class (Turing) or newer officially; Windows 10+; limited Linux; enable in Preferences Video tab |
| Intel QSV | H.264 (per codec page), H.265, AV1 | Coffee Lake or newer with HD/Iris Xe/Arc; Windows drivers 31.0.x or newer; Linux/FreeBSD on modern distros; Arc needs kernel 6.2+ and HuC firmware |
| AMD VCN/VCE (AMF) | H.265 presets, AV1 (RX 7000 class), `vce_*` in CLI | RX 6000 class or newer; Linux requires amf-amdgpu-pro libs; AV1 on Navi 3 needs dimensions divisible by 64; no hardware decode noted on VCN page |
| Media Foundation | H.264, H.265, AV1 (CLI `mf_*`) | Windows ARM focus |
| VA-API (CLI only) | AV1, H.264, HEVC, VP8, VP9 | Linux; appears in CLI list, not in docs hardware pages |

- In all cases the CPU still does filters, audio, subtitles and muxing, so high CPU use is normal; advanced encoder options are limited and presets are recommended.
- Decoding: `--enable-hw-decoding` (amfdec, nvdec, qsv) and `--disable-hw-decoding`.

formtools note: detect available encoders at runtime, grey out unavailable ones with the reason, and never assume parity of quality settings across vendors.

## 7. Other facts

- Preferences exist (Video tab hosts hardware-encoder enablement, Advanced hosts simultaneous jobs on macOS); full preferences listing not verified because the preferences page is a stub.
- Automatic file naming is a documented feature with a format template.
- Related docs: Activity Log, Troubleshooting, Source formats, Container formats.

## Sources

- https://handbrake.fr/docs/en/latest/table-of-contents.html
- https://handbrake.fr/docs/en/latest/technical/official-presets.html
- https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
- https://handbrake.fr/docs/en/latest/cli/cli-options.html
- https://handbrake.fr/docs/en/latest/technical/filters-summary.html
- https://handbrake.fr/docs/en/latest/technical/video-codecs.html
- https://handbrake.fr/docs/en/latest/technical/source-formats.html
- https://handbrake.fr/docs/en/latest/technical/containers.html
- https://handbrake.fr/docs/en/latest/technical/hdr.html
- https://handbrake.fr/docs/en/latest/technical/video-bit-depth.html
- https://handbrake.fr/docs/en/latest/technical/video-cq-vs-abr.html
- https://handbrake.fr/docs/en/latest/technical/video-presets-tunes.html
- https://handbrake.fr/docs/en/latest/technical/frame-rates.html
- https://handbrake.fr/docs/en/latest/technical/audio-quality.html
- https://handbrake.fr/docs/en/latest/technical/process-isolation.html
- https://handbrake.fr/docs/en/latest/technical/video-nvenc.html
- https://handbrake.fr/docs/en/latest/technical/video-qsv.html
- https://handbrake.fr/docs/en/latest/technical/video-videotoolbox.html
- https://handbrake.fr/docs/en/latest/technical/video-vcn.html
- https://handbrake.fr/docs/en/latest/workflow/open-video-source.html
- https://handbrake.fr/docs/en/latest/workflow/select-preset.html
- https://handbrake.fr/docs/en/latest/workflow/adjust-quality.html
- https://handbrake.fr/docs/en/latest/advanced/queue.html
- https://handbrake.fr/docs/en/latest/advanced/point-to-point.html
- https://handbrake.fr/docs/en/latest/advanced/custom-presets.html
- https://handbrake.fr/docs/en/latest/advanced/audio-subtitle-defaults.html
- https://handbrake.fr/docs/en/latest/advanced/resizing-video.html
- https://handbrake.fr/docs/en/latest/advanced/subtitles.html
- https://handbrake.fr/docs/en/latest/advanced/chapter-markers.html
- https://handbrake.fr/docs/en/latest/advanced/metadata-passthru.html
- https://github.com/HandBrake/HandBrake
- https://github.com/HandBrake/HandBrake/releases
