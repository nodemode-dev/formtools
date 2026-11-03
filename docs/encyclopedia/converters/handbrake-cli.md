# HandBrakeCLI reference (flags by group)

Source of truth: the official command line reference. Flags vary by OS and hardware; `HandBrakeCLI --help` on the target machine is authoritative. Version context: HandBrake 1.11.2 (2026-06-07).

## General
- `-h/--help`, `--version`, `--json` (machine-readable title/progress/version output), `-v/--verbose[=n]`.
- Presets: `-Z/--preset <name>`, `-z/--preset-list`, `--preset-import-file`, `--preset-import-gui`, `--preset-export`, `--preset-export-file`, `--preset-export-description`.
- `--queue-import-file` (import a GUI queue), `--no-dvdnav`.

formtools note: `--json` is the integration hook; parse its progress records instead of scraping text.

## Source
- `-i/--input`, `-t/--title` (0 scans all), `--min-duration`, `--max-duration`, `--scan`, `--main-feature`, `--keep-duplicate-titles`, `-c/--chapters`, `--angle`, `--previews n:bool`, `--start-at-preview`, `--start-at unit:n`, `--stop-at unit:n` (units: seconds, frames, pts).

formtools note: a scan-only call (`--scan -t 0 --json`) is the cheap way to populate a title picker.

## Destination
- `-o/--output`, `-f/--format` (mp4, mov, mkv, webm), `-m/--markers`, `-O/--optimize`, `-I/--ipod-atom`, `--align-av`, `--keep-metadata`/`--no-metadata`, `--inline-parameter-sets` (SPS/PPS before each IDR for adaptive streaming).

## Video
- `-e/--encoder`; `--encoder-preset`, `--encoder-tune`, `--encoder-profile`, `--encoder-level` each with a `-list` companion that prints valid values for that encoder.
- `-x/--encopts` raw encoder options; `-q/--quality` (constant quality), `-b/--vb` (kbps, default 1000), `--multi-pass`, `-T/--turbo`.
- Frame rate: `-r/--rate`, `--vfr`, `--cfr`, `--pfr`.
- HDR: `--hdr-dynamic-metadata <type>` / `--no-hdr-dynamic-metadata`.
- Hardware decode: `--enable-hw-decoding <type>` (AMD amfdec, NVIDIA nvdec, Intel qsv), `--disable-hw-decoding`.
- Encoder names listed in the reference: Intel `qsv_av1`, `qsv_av1_10bit`, `qsv_h265`, `qsv_h265_10bit`; NVIDIA `nvenc_av1(_10bit)`, `nvenc_h264(_10bit)`, `nvenc_h265(_10bit)`; AMD `vce_av1(_10bit)`, `vce_h264`, `vce_h265(_10bit)`; VA-API `vaapi_av1`, `vaapi_h264`, `vaapi_hevc`, `vaapi_VP8`, `vaapi_VP9`; Media Foundation `mf_av1`, `mf_h264`, `mf_h265`; Apple `vt_h264`, `vt_h265`, `vt_h265_10bit`, `vt_prores`. Software encoder names (x264, x265, svt_av1 and so on) are not enumerated on that page; use `-z`/help output (not verified here).

formtools note: build the encoder dropdown from `--help` output at runtime, never from a hard-coded list.

## Audio
- Selection: `--audio-lang-list`, `--all-audio`, `--first-audio`, `-a/--audio` (numbers or none).
- Encode: `-E/--aencoder` (incl. copy/passthrough), `--audio-copy-mask`, `--audio-fallback`, `-B/--ab`, `-Q/--aq`, `-C/--ac`, `-6/--mixdown`, `--normalize-mix`, `-R/--arate`, `-D/--drc`, `--gain`, `--adither`.
- Naming: `-A/--aname`, `--keep-aname`, `--automatic-naming-behaviour`.
- Audio filters: `--acompressor[=preset]`, `--acompressor-tune`, `--agate[=preset]`.
- Per-track options are comma-separated lists aligned by track position (standard HandBrakeCLI behavior; pattern shown by the `-E copy` example in the options page).

## Picture
- Size: `-w`, `-l`, `-X/--maxWidth`, `-Y/--maxHeight`, `--modulus`.
- Crop: `--crop-mode`, `--crop t:b:l:r`, `--crop-threshold-pixels`, `--crop-threshold-frames`.
- Aspect: `--non-anamorphic`, `--auto-anamorphic`, `--loose-anamorphic`, `--custom-anamorphic`, `--display-width`, `--keep-display-aspect`, `--pixel-aspect`, `--itu-par`.
- Color: `--color-range`, `-M/--color-matrix`.

## Filters
- Interlace: `--comb-detect`, `-d/--deinterlace` (yadif), `--bwdif`, `-5/--decomb`, `-9/--detelecine`.
- Noise/detail: `-8/--hqdn3d`, `--bm3d`, `--nlmeans` (+`--nlmeans-tune`), `--chroma-smooth` (+tune), `--unsharp`, `--lapsharp` (+tunes), `-7/--deblock` (+tune), `--deband`.
- Geometry/color: `--rotate`, `--pad`, `--colorspace`, `-g/--grayscale`.
- Each filter takes `=preset` or custom parameter strings and has a `--no-` form.

## Subtitles
- Selection: `--subtitle-lang-list`, `--all-subtitles`, `--first-subtitle`, `-s/--subtitle`, `-F/--subtitle-forced`, `--subtitle-burned`, `--subtitle-default`, `-N/--native-language`, `--native-dub`.
- Names: `-S/--subname`, `--keep-subname`.
- External: `--srt-file`, `--srt-codeset`, `--srt-offset`, `--srt-lang`, `--srt-default`, `--srt-burn`; `--ssa-file`, `--ssa-offset`, `--ssa-lang`, `--ssa-default`, `--ssa-burn`.

## Typical invocations (patterns, written fresh)
- Preset run: `HandBrakeCLI -i in.mkv -o out.mp4 -Z "Fast 1080p30"`.
- Custom CQ: `-e x265 -q 22 --encoder-preset medium`.
- Range: `--start-at seconds:60 --stop-at seconds:120`.

formtools note: wrap HandBrakeCLI as an optional engine behind the same job schema as FFmpeg, or skip it and implement presets over FFmpeg directly (see ffmpeg-engine.md).

## Licensing and embedding
- HandBrake is GPL-2.0; shelling out to HandBrakeCLI as a separate process keeps formtools' own license choice open, whereas linking libhb would make the combined work GPL-2.0.

## Sources

- https://handbrake.fr/docs/en/latest/cli/command-line-reference.html
- https://handbrake.fr/docs/en/latest/cli/cli-options.html
- https://github.com/HandBrake/HandBrake
