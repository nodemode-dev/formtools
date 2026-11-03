# Shutter Encoder feature encyclopedia

Snapshot 2026-11-03. Latest release seen on GitHub: v20.4 (published "September 28"; the year was not shown on the page, so treat the date as unverified).
License: GPL-3.0 (repo). Site calls it free with no feature limits, funded by donations. Built around FFmpeg (the site and repo description both say it is mostly FFmpeg-based); the repo build notes mention a custom Java runtime (jlink), so the GUI is Java (inferred).
Platforms: Windows 7 to 11 64-bit (installer or portable), macOS 10.14+ (Intel and Apple Silicon), Linux (.deb, AppImage, Flatpak). GPU acceleration advertised for NVIDIA, AMD, Intel, Apple.

Layout of the app (from the documentation index): Choose Files, Choose Function, Outputs, Progress, Settings (many panels), App Settings, Status bar and GPU. The user picks a function from a dropdown, then adjusts panels.

## 1. Functions list (as grouped in the official docs)

### Without conversion (stream copy)
- Cut without re-encoding, Replace audio, Rewrap (change container), Conform, Merge, Extract (streams), Subtitling (add/convert subtitle tracks), Video inserts.

formtools note: these are the highest-value, lowest-cost operations (no quality loss); build them first on top of `-c copy`.

### AI tools
- Audio separation (stems), Audio transcription (plugin-based per site), Translate text, Colorize, Background remover; site also mentions face blur via plugin.

formtools note: treat AI tools as optional plugins, since they pull heavy model downloads.

### Sound conversions
- WAV, AIFF, FLAC, ALAC (site), MP3, AAC, AC3, Opus, Vorbis, Dolby Digital Plus, Dolby TrueHD.

### Editing codecs
- DNxHD, DNxHR, Apple ProRes, QuickTime Animation, GoPro CineForm, Uncompressed.

### Output codecs
- H.264, H.265, H.266, VP8, VP9, AV1.

### Broadcast codecs
- XDCAM HD422, XDCAM HD 35, AVC-Intra 100, XAVC, XAVC Long GOP, HAP.

### Old codecs
- Theora, MPEG-2, MJPEG, Xvid, DV PAL, WMV, MPEG-1.

### Archiving codec
- FFV1.

### Images creation
- JPEG, JPEG XL, generic Image output.

### Burn and rip
- DVD, Blu-ray authoring, DVD rip.

### Analysis
- Loudness and true peak measurement, Audio normalization (peak normalization added in 20.4), Cut detection (exportable as EDL per site), Black detection, Media offline detection, VMAF scoring, FrameMD5.

### Download
- Web video (documented as yt-dlp based).

### Direct command
- A "Direct command" function lets power users supply their own FFmpeg argument string.

formtools note: Shutter's strength is breadth organized by user intent (editing codec, broadcast codec, analysis); mirror that grouping in the function picker instead of listing raw codec names.

## 2. Choose Files panel
Display, Add a mute audio track, Open file location, Watch folder, Total length of files, Approximate file size, File information, Rename files, Record screen/device, Copy a tree, Generate hash, GOP structure view, Send to FTP, Create ZIP, Unzip, Render queue, Star icon for presets.

formtools note: Watch folder plus Render queue gives unattended batch conversion; design the queue as a first-class panel.

## 3. Outputs panel
Up to three outputs (Output 1, 2, 3), open destination at end, change destination, prefix, suffix, subfolder, delete source file, FTP, Mail, Stream.

## 4. Settings panels (per docs)
- Image: scale, rotation, mirror, force display aspect, create an image sequence from video.
- Bitrates: video bitrate, maximum, audio bitrate, target file size, 2-pass, max quality.
- Audio: mix audio files, separate tracks, change sample rate, convert, up to 16 audio tracks, offset.
- Cropping/Overlay: crop (pixels or presets), overlay image/video with opacity/size/position, subtitles (burn or embed .srt, .vtt, .ass), watermark, burned-in clip name, text and timecode with offsets (site).
- Colorimetry: gamma, convert levels, colorspace conversion, apply LUT, color grading.
- Corrections: stabilize, deflicker, reduce banding, limit to 16-235, details, noise suppression, exposure smoothing; film grain added in 20.4.
- Transitions: video/audio fade in and fade out.
- Image sequence: frame blending, motion blur.
- Advanced: custom filter, force output/profile/preset/tune/quality/speed, fast start, GOP size, open GOP, remove duplicate frames, conform frame rate, force progressive/deinterlace/interlace/field inversion, enable alpha, preserve folder hierarchy, preserve metadata, preserve subtitles, OP-Atom source.
- Interpolation and deinterlacing options on the site: frame rate interpolation, duplicate frame detection.

## 5. App settings and GPU
Load at startup, wait for file ready, exclude extensions, process list as merge, disable updates/player/animations, use local ffmpeg, set strict mode, end action, scale mode, thread count, still image duration, language, default outputs. Status bar: GPU decoding, GPU filtering, hardware acceleration toggles.

formtools note: "use local ffmpeg" is a useful precedent; let power users point formtools at their own FFmpeg build.

## 6. Delivery and presets
- Ready-made presets for Vimeo, YouTube, Facebook, Instagram, Twitter (site). Saving and sharing own presets, My functions queue option (20.4), automatic FTP upload, emailed conversion summaries, batch renaming (prefix/suffix/numbering/find-replace), built-in subtitle editor with waveform, trimming with preview player.

## Observations
- Single developer project; GUI is dense (dozens of functions and many settings panels) which is both its selling point and its learning-curve problem.
- Almost every function is an FFmpeg command template, so it is largely reproducible by a good command builder (see ffmpeg-engine.md).

## Sources

- https://www.shutterencoder.com/
- https://www.shutterencoder.com/documentation/
- https://github.com/paulpacifico/shutter-encoder
- https://github.com/paulpacifico/shutter-encoder/releases
