# Converter feature matrix

Legend: Y = documented, P = partial or via plugin/option, N = not offered or not documented in fetched sources, "n/a" = not applicable. Based on the sibling files in this folder; see each for sources.

## Tools at a glance

| Tool | Domain | License | Platforms | Interface | Engine |
|---|---|---|---|---|---|
| HandBrake 1.11.2 | Video transcode | GPL-2.0 | Win, mac, Linux | GUI plus HandBrakeCLI | libhb over FFmpeg libs, x264, x265, SVT-AV1 |
| Shutter Encoder 20.4 | Video/audio/image, broadcast | GPL-3.0 | Win, mac, Linux | GUI (Java, inferred) | FFmpeg |
| FFmpeg 9.0.2 | Everything media | LGPL-2.1+ (GPL if enabled) | All | CLI and libraries | itself |
| ImageMagick 7.1.2-35 | Images | ImageMagick License | All | CLI and APIs | itself |
| libvips 8.18 | Images, high throughput | LGPL-2.1+ | All | CLI and bindings | itself |
| fre:ac 1.1.7 | Audio, CD ripping | GPL-2.0 text in repo | Win, mac, Linux, BSD, Haiku | GUI plus freaccmd | own plus third-party codecs |
| Permute 4.1 | Mixed media | Commercial | macOS only | GUI | not documented (offers a raw FFmpeg command preset) |
| gifski 1.35.0 | GIF | AGPL-3.0+ (commercial option) | All | CLI, C lib, GUIs | itself (pngquant tech) |

## Capability matrix

| Capability | HandBrake | Shutter Enc. | FFmpeg | ImageMagick | libvips | fre:ac | Permute | gifski |
|---|---|---|---|---|---|---|---|---|
| Video transcode | Y | Y | Y | N | N | N | Y | N |
| Rewrap / stream copy | N | Y | Y | n/a | n/a | n/a | Y | n/a |
| Cut without re-encode | N | Y | Y | n/a | n/a | n/a | P | n/a |
| Merge / concat | N | Y | Y | n/a | n/a | N | Y | n/a |
| Audio-only convert | P | Y | Y | n/a | n/a | Y | Y | n/a |
| Replace audio track | P | Y | Y | n/a | n/a | n/a | Y | n/a |
| Loudness / normalize | P (gain, DRC) | Y | Y (loudnorm) | n/a | n/a | P (volume DSP) | P | n/a |
| Subtitles burn-in | Y | Y | Y (subtitles/ass) | n/a | n/a | n/a | P | n/a |
| Soft subtitle handling | Y | Y | Y | n/a | n/a | n/a | Y | n/a |
| Chapters | Y | P | Y | n/a | n/a | N | N | n/a |
| Image sequence in/out | N | Y | Y (image2) | Y | P | n/a | P (frames) | Y (in) |
| Batch / queue | Y | Y | scripts | mogrify | scripts | Y | Y | scripts |
| Watch folder | N | Y | scripts | N | N | N | P (drop zones) | N |
| Hardware encoding | Y | Y | Y | n/a | n/a | n/a | Y | n/a |
| HDR (HDR10/DV) | Y | P | Y | P | P (CICP, 8.19 dev) | n/a | N | N |
| AI tools | N | Y | N | N | N | N | Y (OCR, transcribe) | N |
| Image resize/crop | N | P | Y (filters) | Y | Y | n/a | Y | Y (frames) |
| Contact sheet | N | N | P (tile filter) | Y (montage) | P | n/a | N | n/a |
| Image inspect | N | P | Y (ffprobe) | Y (identify) | Y (header ops) | n/a | N | n/a |
| GIF output | N | P | Y | Y | Y | n/a | P | Y (best) |
| Presets | Y (6 categories) | Y | n/a | n/a | n/a | Y (profiles) | Y | N |
| CLI/automation | Y | P (direct command) | Y | Y | Y | Y (freaccmd) | P (automation) | Y |

Cells marked P or N for tools whose documentation was only partly read are judgement calls; the weakest are Permute capabilities (vendor marketing page only) and HandBrake chapters/loudness details.

## Recommended formtools architecture (synthesis)

1. Core video/audio engine: FFmpeg, shipped as an LGPL build or user-supplied binary; typed job model (inputs, maps, filters, muxer).
2. Image engine: libvips for thumbnails, resize and batch; ImageMagick only for exotic formats and operations, behind a restrictive security policy.
3. HandBrake as an optional "friendly presets" source: borrow its preset taxonomy (General, Web, Devices, Production, Hardware) and RF ranges, but implement over FFmpeg; call HandBrakeCLI only if installed.
4. Fast operations first (copy-based): cut, rewrap, replace audio, extract, concat, per Shutter Encoder.
5. GIF: FFmpeg palette path default, gifski optional.
6. Audio: FFmpeg encoders plus tag editing and CD ripping as a later module (fre:ac as reference).

formtools note: the matrix shows nobody covers video, images and audio under one friendly UI with copy-mode ops and a queue; that is the gap formtools targets.

## Sources

Derived from this folder's files; primary URLs are listed in handbrake.md, shutter-encoder.md, ffmpeg-engine.md, imagemagick.md, libvips.md, audio-converters.md, gif-tools.md and codec-container-primer.md.
