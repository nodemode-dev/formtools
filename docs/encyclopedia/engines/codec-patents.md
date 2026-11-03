# Codec and format patent notes for formtools

Status: research snapshot, 2026-11-03. This is engineering research, not legal advice. Patent exposure is a separate question from copyright license: a permissive or LGPL codec library can still require patent licenses from pools or individual holders. Get counsel review before shipping any encoder or decoder for the formats below.

## Principle

formtools ships software that decodes and encodes. Where the format is covered by a patent pool, the party that ships the end-user encoder/decoder is the one a pool targets. There are three ways to reduce exposure:

1. Use an OS-provided codec (macOS ImageIO/AVFoundation/VideoToolbox, Windows Media Foundation/WIC). The OS vendor holds the license. Caveat: Windows may need an optional store extension for HEVC, which I did not verify here.
2. Use royalty-free codecs (AV1, VP9, Opus, Vorbis, FLAC, WebP, JPEG XL) by default.
3. For patent-encumbered formats, ship nothing by default and make the user opt in to a download, or defer to the OS. Also limit to decode where possible.

## Summary table

| Codec or format | Patent status (verified source) | formtools stance |
|---|---|---|
| H.264 / AVC | Via LA pool licenses AVC use in media player software and codecs. For PC encoders/decoders, end-user personal and internal business use is covered without extra payment, while the codec maker pays per unit (first 100,000 units free per affiliated group, then $0.20, then $0.10 per unit above 5 million, capped yearly). The page says the license agreement itself is the only definitive statement. Source: Via LA AVC page. | Do not bundle x264 (also GPL). For playback use the OS decoder. For encode use OS hardware encoders (VideoToolbox, Media Foundation) through FFmpeg's LGPL-compatible hooks, or Cisco's OpenH264 binary. |
| OpenH264 | BSD code. Cisco says it pays the AVC pool royalties only for the binary module that Cisco itself builds and distributes, downloaded at install; if you compile the source yourself you owe the fees, and Cisco does not guarantee other holders' fees. Source: openh264.org FAQ. | Only acceptable if the app downloads Cisco's binary at install or runtime. Do not compile it into formtools. |
| H.265 / HEVC (and HEIC, HEIF with HEVC) | Patents sit in more than one pool; Access Advance's HEVC Advance program says it licenses patents essential to the HEVC standard. I could not retrieve its scope pages (who is licensed, software distribution, thresholds), so the details are unverified. Other pools (Via LA HEVC/VVC) exist, unverified here. | Highest risk item. Avoid shipping libde265 or x265 builds that you distribute. Prefer OS decode: macOS ImageIO and Windows WIC for HEIC. x265 is GPL anyway and is banned. For Linux, treat HEIC as optional. |
| HEIF container | HEIC (HEVC) and AVIF (AV1) both use the HEIF container. libheif's README describes HEIC as HEVC based and AVIF as AV1 based. Container-specific patent holders unverified. | Treat HEIC and AVIF separately; the container alone was not investigated. |
| AV1 (AVIF, AV1 video) | Alliance for Open Media Patent License 1.0: worldwide, royalty-free, irrevocable grant from licensors to anyone who implements it, conditional on you licensing your own necessary claims under it and including the license text, with defensive termination on patent suits. Source: aomedia.org patent license page. Third-party pool claims (Sisvel) exist, but I could not fetch Sisvel's page, so their scope is unverified. | Default modern format. Use dav1d/aom (BSD-2) and SVT-AV1 (BSD-3-Clause-Clear plus the AOM patent license). Ship the AOM patent license text with the notices. |
| VP8 / VP9 | WebM project patent grant; formal text not re-read in this pass. | Unverified in this pass; libvpx is BSD per its repo (not re-checked). Treat as low risk but cite before release. |
| AAC (AAC-LC, HE-AAC, xHE-AAC) | Via LA administers a joint license; developers of end-user encoder and/or decoder products need one. Per-unit fees start at $0.98 for the first 500,000 units and fall to $0.10 above 75 million; one-time $15,000 initial fee ($1,000 for small entities); no fees for distributing AAC-encoded content. Source: Via LA AAC page. | Biggest practical audio issue. Decode AAC via OS (AVFoundation, Media Foundation) only. Do not ship FFmpeg's native AAC encoder as a product feature without a license decision. Symphonia (MPL-2.0) can decode AAC but that does not remove the patent question. |
| MP3 | Fraunhofer and Technicolor ended their mp3 licensing program on April 23, 2017 (Fraunhofer IIS page). | Treat as free to decode and encode (LAME is LGPL, use via FFmpeg LGPL build as separate process). Residual third-party claims unverified. |
| Opus, Vorbis, FLAC | Designed royalty-free; no primary patent statement fetched in this pass. | Unverified; low risk, default for audio output. |
| AC-3, E-AC-3, DTS | Pool status not researched. | Unverified. Do not offer encode. Decode only via FFmpeg if at all, flag for counsel. |
| JPEG XL | Google grants a perpetual, worldwide, royalty-free patent license for the libjxl implementation, with termination if you sue over it (libjxl PATENTS). Third-party patent allegations around ANS entropy coding were not researched here: unverified. | Acceptable default. Ship libjxl or jxl-oxide with their LICENSE and PATENTS files. |
| WebP | libwebp ships with a Google patent grant file alongside its BSD-3-Clause COPYING (repo). Grant text itself not re-read here. | Low risk; unverified detail. |
| JPEG 2000 / HTJ2K | OpenJPH (BSD-2-Clause, repo LICENSE) implements HTJ2K; patent status not researched. | Unverified; leave decode-only. |
| GIF | LZW patents long expired (general knowledge, no primary source fetched). | Unverified but widely considered free. |
| Camera RAW | Not patented as a family; manufacturer formats are reverse engineered by LibRaw. | LibRaw dual license applies, see matrix. |
| EXR, PSD | OpenEXR is BSD-3-Clause; PSD specification is published by Adobe, patent terms unverified. | Read PSD only. |
| RAR | Not a patent matter but a license one: RARLAB's source terms forbid rebuilding the RAR compressor. | Read-only extraction. |

## Platform codec map (for the "use the OS" rule)

| Need | macOS | Windows | Linux |
|---|---|---|---|
| HEIC decode | ImageIO | WIC (HEVC extension availability unverified) | libheif with LGPL libde265 only, user opt-in; or omit |
| H.264 / HEVC video decode | AVFoundation / VideoToolbox | Media Foundation | system libavcodec if present, else omit; do not bundle |
| AAC decode | AVFoundation | Media Foundation | system or omit |
| AV1 | dav1d (bundled, BSD) | dav1d (bundled) | dav1d (bundled) |

(The OS API names are standard platform APIs; I did not fetch each vendor's licensing page, so treat the OS-license statement as a design assumption to confirm.)

## Rules for the engine

- Build FFmpeg with an explicit allow-list: no --enable-gpl, no --enable-nonfree, no libx264/libx265, no libfdk-aac. Record the configure line in the release notes.
- Never use a prebuilt FFmpeg binary or wheel (PyAV, imageio-ffmpeg, static builds) unless its configure line has been checked; PyAV's bundled FFmpeg includes x264 and x265.
- Keep a per-codec switch so a build can drop HEVC/H.264/AAC entirely for distributions where licensing is unresolved.
- Ship the AOM patent license text and libjxl PATENTS file in the notices bundle.

## Sources

- https://www.via-la.com/licensing-2/avc-h-264/
- https://www.via-la.com/licensing-2/aac/
- https://accessadvance.com/licensing-programs/hevc-advance/
- https://aomedia.org/license/patent-license/
- https://www.openh264.org/faq.html
- https://www.iis.fraunhofer.de/en/ff/amm/consumer-electronics/mp3.html
- https://raw.githubusercontent.com/libjxl/libjxl/main/PATENTS
- https://raw.githubusercontent.com/videolan/dav1d/master/doc/PATENTS
- https://raw.githubusercontent.com/strukturag/libheif/master/README.md
- https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/LICENSE.md
- https://raw.githubusercontent.com/PyAV-Org/pyav-ffmpeg/main/README.md
- https://raw.githubusercontent.com/webmproject/libwebp/main/COPYING
- Attempted but failed to load (details left unverified): Access Advance "what we license" page, Sisvel AV1 page.
