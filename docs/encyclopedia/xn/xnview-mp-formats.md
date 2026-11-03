# XnView MP: supported formats

Source tags: see xnview-mp-overview.md. Primary source is the vendor's table at xnview.com/en/image-formats (fetched as raw HTML and counted by script).

## Counts

| Measure | Value | Source |
|---|---|---|
| Vendor headline | Reads 500+ formats, writes about 70 | SITE |
| Rows in the vendor table (2026-11-03 fetch) | 583 | counted from raw HTML |
| Rows flagged readable | 579 | counted |
| Rows flagged writable | 81 (many rows are variants or aliases of the same codec, which is why the headline says about 70) | counted |
| Read-only rows | 502 | counted |

Caveat: the table appears to lag behind the product. It shows HEIF/HEIC and AVIF as read-only, yet the vendor's own HEIC, AVIF and JPEG XL pages and the FAQ say they can be written with a quality setting, and release notes mention AVIF output fixes (1.11.x) and AVIF animation (1.11.2). Treat HEIC and AVIF write as supported (multiple vendor statements) while noting the table disagrees. SITE, REL.

## Notable formats

| Group | Format | Read | Write | Notes | Source |
|---|---|---|---|---|---|
| Web/common | JPEG/JFIF | yes | yes | progressive, chroma subsampling, quality; lossless transforms; libjpeg-turbo (libjpeg 3.x in notes); JPEG-li (XYB) setting in 1.8.4 | SITE, REL |
| | PNG / APNG | yes | yes | compression level, interlace, 8-bit alpha, cICP chunk | SITE, REL |
| | GIF | yes | yes | animated | table |
| | WebP | yes | yes | lossy and lossless, animated playback, libwebp 1.6.0 | SITE, REL |
| | AVIF | yes | yes per product pages (table says read) | animated and HDR work in 1.11.x; libavif 1.4.2, libde265 1.1.1, dav1d | SITE, REL |
| | HEIF / HEIC | yes | yes per product page (table says read) | libheif 1.23.x; primary image read of multi-image files | SITE, REL |
| | JPEG XL | yes | yes | animated, 48-bit, DNG with JXL; libjxl | SITE, REL |
| | BMP, ICO | yes | yes | ICO multi-size, ICNS read only | table |
| | TIFF | yes | yes | multi-page, 1 to 32 bit per channel, CMYK, ICC | SITE |
| | JPEG 2000 / JPEG XR / FLIF | yes | yes | OpenJPEG 2.5.4 | table, REL |
| | PSD | yes | yes | layered view as pages, 32 bit per channel; PSB large read-only | SITE, table |
| | SVG | yes | no | thumbnail support | table |
| Pro/science | OpenEXR | yes | no | OpenEXR 3.4.7 | table, REL |
| | DPX, Cineon, FITS, Radiance, SGI, Targa, DDS | yes | yes | | table |
| | DICOM | yes | no | multi-frame; not a certified medical viewer | SITE |
| Documents | PDF, PostScript/EPS | yes | yes | needs Ghostscript in older docs; PDFium now used for PDF (1.12.2); AI via Ghostscript; DjVu read; CDR preview only | table, REL, SITE |
| Camera RAW | CR2, CR3, CRW, NEF, NRW, ARW, SR2, ORF, RAF, RW2, PEF, DNG, SRW, 3FR, FFF, X3F, MRW, DCR, ERF, RWL, KDC and others (about 50 rows) | yes | no | decoder is LibRaw (0.22.x); renders or uses embedded preview; no RAW development tools; vendor says "over 50" variants | SITE, REL |
| Video/audio | MP4, MOV, AVI, MKV, WebM etc. | play | no | MDK based player; thumbnails | SITE, REL |
| Archive | zip and others via LibArchive | browse | no | single-source impression from release notes | REL |
| Legacy | Amiga IFF, Degas, PCX, Photo CD-style, Nokia logos, Psion, TI bitmaps, Wavefront, many ray tracer formats | most read | many write | long tail | table |

## Write list (representative, from the table)

PSD, GIF, DDS, DPX, FLIF, FlashPix, FITS, HD Photo/JPEG XR, JPEG, JPEG XL, JPEG 2000, WebP, PNG/APNG, TIFF, BMP, ICO, TGA, PCX, PBM/PGM/PPM/PNM, SGI RGB, Radiance, Cineon, EMF, XBM, XPM, YUV, PDF, PostScript, CSV, VRML2, Raw, and a long tail of obscure formats.

## Libraries named in release notes (version drift shows upkeep)

LibRaw 0.22.2, libheif 1.23.4, libjxl (0.10.3 to 0.11.2 named; one item reads 1.12.0, likely a typo), libwebp 1.6.0, libavif 1.4.2, libde265 1.1.1, LCMS2 2.19.1, OpenJPEG 2.5.4, OpenEXR 3.4.7, libpng 1.6.55, zlib 1.3.2, libjpeg 3.2.0, LibArchive 3.8.9, MDK 0.38, ExifTool 13.51, MediaInfo 24.06, PDFium. REL.

## Plugins

* No user-installable plugin system was found in non-wiki sources. Adobe Photoshop filter (8BF) support is listed as a vendor feature, and a "RIOT" (JPEG optimizer) menu entry and plugin was mentioned in one fix (1.11.2). Codecs are compiled in, with Ghostscript as the only named external requirement. SITE, REL.

formtools note: build a codec registry with capability flags (read, write, multipage, animated, alpha, bit depth, ICC, metadata round trip), and render the table from it; mark RAW as decode-only via LibRaw.

## Sources

* https://www.xnview.com/en/image-formats/
* https://www.xnview.com/en/faq/
* https://www.xnview.com/en/raw-viewer/
* https://www.xnview.com/en/heic-viewer/
* https://www.xnview.com/en/avif-viewer/
* https://www.xnview.com/en/jpeg-xl-viewer/
* https://www.xnview.com/en/dicom-viewer/
* https://www.xnview.com/en/tiff-viewer/
* https://www.xnview.com/en/webp-viewer/
* https://www.xnview.com/en/png-viewer/
* https://www.xnview.com/en/jpeg-viewer/
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=50659
* https://newsgroup.xnview.com/viewtopic.php?t=51261
* https://newsgroup.xnview.com/viewtopic.php?t=51356
* https://newsgroup.xnview.com/viewtopic.php?t=51463
