# Audio converters: fre:ac, plus Permute (macOS) in brief

## fre:ac

Snapshot 2026-11-03. Latest release on GitHub: v1.1.7 (2023-03-05); the project looks slow-moving since then (observation). Website news is stale; the 2023 release notes are the freshest official text. Repo carries a GPL v2 text in COPYING (single source; per-file headers not checked).
Platforms: Windows (standalone or Store), macOS, Linux (AppImage, Flatpak, Snap), FreeBSD, Haiku. Portable mode stores config beside the app. UI in 43 languages. Free, no adware.

### Features (from official pages)
- Converter between MP3, M4A/AAC, FLAC, WMA, Opus, Ogg Vorbis, Speex, Monkey's Audio (APE), WavPack, WAV and others, any-to-any.
- Integrated CD ripper with CDDB/GNUdb lookup, tags written to ID3v2 or the format's native tags; AccurateRip verification notifications.
- Whole-library conversion that preserves folder and filename structure.
- Multi-core optimized MP3, M4A/AAC, Opus and Speex encoders.
- Full Unicode in tags and file names.
- 1.1.7 additions: output splitting tool (by duration, file count, metadata), dithering when reducing bit depth, matrix surround decoder, volume adjustment DSP, WavPack hybrid with correction files, MPEG-4 DASH decode, `.weba` open, 6.1 downmix, MusicBrainz and sort-order and rating tag fields, release-year column, option to name output from source file name, `freaccmd` command-line tool with negative exit codes on error, KDE dark mode support.
- Companion command-line front end `freaccmd` exists (named in release notes).

formtools note: an audio tab needs: format/quality presets, tag editor with MusicBrainz, folder-structure-preserving batch, optional split/DSP chain (volume, dither); CD ripping is a separate optional module.

formtools note: fre:ac's per-encoder codec zoo comes from many third-party libraries; formtools can get 90 percent of value from FFmpeg's encoders (mp3lame, aac, libopus, flac, vorbis) and add APE/WavPack only on request.

## Permute (macOS only, commercial)

Snapshot: Permute 4.1 requires macOS 26 and Apple Silicon; Permute 3 serves macOS 11 to 15 and Intel. Price on the vendor site: 14.99 USD permanent license (direct, Mac App Store, or Setapp subscription); the App Store build omits some features due to sandbox limits.
- Converts video, audio, images, PDFs, text; vendor claims 100+ formats (AVI, WMV, MP4, HEVC, ProRes, WebM, AV1, MP3, AAC, FLAC, HEIC, AVIF, WebP).
- Editing: trim, crop, resize, rotate, flip, add subtitles, swap audio tracks, change speed and volume, target output file size.
- Combine/split/extract: stitch files, split by time or EDL/CUE, export individual audio/video/subtitle tracks.
- Smart tools: text-to-audio narration, OCR to text, ringtone maker, audio-backed slideshow, frame export at intervals.
- Advanced video: HLS manifests, hardware ProRes, camera file repair, raw FFmpeg commands via an Advanced Custom preset.
- Image filters (blur, color, sepia, vignette, sharpen and so on), on-device transcription to text or SRT, PDF pages to images, drop zones, automation, custom groups.
- Native queue with precision crop and trim editors.

formtools note: Permute is the UX benchmark: drag, pick a format preset, convert, with a bulk edit panel; its drop-zone and "target file size" ideas are worth copying.

## Sources

- https://www.freac.org/
- https://github.com/enzo1982/freac/releases
- https://raw.githubusercontent.com/enzo1982/freac/master/COPYING
- https://software.charliemonroe.net/permute/
