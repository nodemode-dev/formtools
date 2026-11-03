# NConvert (command line)

Version seen on product page: 7.300. Reads 500+ formats (incl. multipage and animated: APNG, TIFF, GIF), writes about 70. Platforms: Windows, macOS, Linux, plus FreeBSD, Solaris, AIX, QNX and others. License: free for private/educational/non-profit use; Business license 100 EUR + VAT (one per company or application) and Site license 300 EUR + VAT; selling it as a developer toolkit or running it as a server application is not allowed under either. The product page lists no flags; its "NConvert Wiki" link now opens the vendor forum post "NConvert User Guide" (author post, 2025-10-14), which holds only the examples reproduced in the shipped Usage.txt, and the old wiki itself is gone. The list below was first taken from the official forum post of the program's help output (versions 7.121 and 7.80 merged) and has now been checked flag by flag against the help text inside the vendor's NConvert 7.300 Linux build (read as strings, never executed; the shipped Usage.txt and ReadMe still say 7.240 while the program and WhatsNew say 7.300). Corrections from that check are inline below. Flags that the program parses but the help text does not describe: -high_res, -lower, -extract, -align, -shadow, -framerate, -sharp_yuv, -resize_bw_grey (names only, behaviour unknown).

Invocation shape: `nconvert [options] files...`; wildcards and `-l listfile` for inputs.

## Input and general

| Flag | Meaning |
|---|---|
| -quiet, -v, -info, -fullinfo | silence, verbose, print info only, info plus metadata |
| -in fmt | force input format (-1 auto) |
| -page n, -xall | pick one page, extract all |
| -multi | write multipage (TIFF, DCX, LDF, PDF) |
| -l file | list of input files |
| -n start end step | numbered sequence |
| -older n | only files older than n days |
| -greater_than / -less_than type value | filter by height, width, filesize |
| -clipboard | read from clipboard |
| -size WxH | geometry for raw/YUV |
| -org_depth | keep original bit depth on load |
| -npcd, -ngrb | PhotoCD resolution, HP-48 grey levels |
| -no#, -noholder | disable # or $ placeholders |

## Output, naming, files

| Flag | Meaning |
|---|---|
| -out fmt | output format name (jpeg, png, ...) |
| -o name | output name template. Placeholders: `#` counter, `%` source name, `$` full source path, `$$` source folder name, `$EXIF:DateTaken[strftime]`, `$EXIF:DateModified[strftime]` |
| -t start step | counter start and step |
| -overwrite | replace existing output |
| -ignore_errors | keep going after failures |
| -no_auto_ext | do not append extension |
| -D | delete original after conversion |
| -recurse | recurse into folders; WhatsNew says it was added for Windows in 2021 (example `nconvert -o output/% folder`) and extended in a 2023 build; not in the help text of the Linux build |
| (default naming) | without -o and without -overwrite, an output that would equal the input file stops with the error "Can't overwrite file ... Use -overwrite to overwrite it" |
| -keepfiledate | copy source timestamps |
| -wflag | write flags (os2 BMP, gif87, hp49) |
| -ascii, -one_strip, -ctype, -corder | ASCII PPM, single-strip TIFF, raw channel type and order |

## Compression and quality

-q (JPEG/WebP/JPEG2K/PDF etc, default 85), -use_org_quality, -c / -c_bw / -c_grey / -c_rgb (format-specific compression number), -clevel (PNG, default 6), -i (interlace/progressive), -opthuff, -dct, -smoothingf (0 to 10), -subsampling (0 to 2), -comp_ratio and -max_filesize (JPEG2K), -jxr_color and -jxr_filter, -avif_format, -avif_speed, -avif_quant_color, -avif_quant_alpha.

## Colour management and alpha

-icc, -keep_icc, -icc_in, -icc_out, -icc_intent, -icc_bcp, -icc_ie (ignore embedded), -use_cie, -keepcspace, -cmyk_space, -ilut/-olut (DPX/Cineon LUTs), -gam (EXR/HDR gamma), -add_alpha, -merge_alpha, -set_alpha, -transparent, -transpcolor r g b, -bgcolor r g b, -bgcolor2 r g b a.

## Resolution

-dpi n sets resolution; -keepdocsize rescales bitmap so physical size stays when DPI changes.

## Metadata and lossless JPEG

-rmeta (strip all), -clean mask (1 comment, 2 EXIF, 4 XMP, 8 EXIF thumb, 16 IPTC, 32 ICC, 64 other), -rexifthumb, -buildexifthumb, -exif_orient 1..8, -iptc_print/-iptc_clear/-iptc_set/-iptc_add, -thumb w h, -jpegtrans (rot90, rot180, rot270, exif, vflip, hflip), -jpegcrop x y w h.

## RAW

-half_res, -embedded_jpeg, -raw_autobalance, -raw_camerabalance, -raw_autobright, -raw_gamma (0.6), -raw_brightness (0.8), -raw_redscale, -raw_bluescale.

## Watermark and text

Watermark: -wmfile (must come after the other -wm options), -wmpos x y, -wmflag (nine-position preset), -wmopacity 0 to 100, -wmstretch, -wmsize percent.
Text: -text, -text_font name size, -text_color, -text_back, -text_flag, -text_pos, -text_rotation, -text_border. The Linux 7.300 build contains none of these -text names, and the shipped Usage.txt states the add-text feature uses the Win32 API and exists on Windows only, so treat the text flags as Windows-only.

## Resize, geometry

| Flag | Meaning |
|---|---|
| -resize w h | target size; accepts %, cm, mm, inches |
| -resize fill w h | cover the box |
| -resize longest/shortest n | by side |
| -resize dpi n | scale to a DPI |
| -ratio | keep aspect |
| -rflag | incr (enlarge only), decr (shrink only), orient (follow orientation) |
| -rtype | resampler: quick, linear, hermite, gaussian, bell, bspline, mitchell, hanning, lanczos, lanczos2 |
| -crop x y w h; -autocrop tol colour/pos | crop, auto-trim |
| -canvas w h pos; -canvas longest/shortest n pos | canvas size |
| -rotate deg, -rotate_flag smooth, -xflip, -yflip, -shear, -slice | rotate/flip/shear |
| -new w h bpp | blank image (the order is width, height, bits; the earlier "bpp w h" order was wrong) |
| -clear x y w h | fill a rectangle with the -bgcolor colour (missing from the first list) |

## Colour and tone

-32bits, -colors n (256..8), -grey n, -binary dither (pattern, floyd, halft45, halft90, nodither), -dither/-floyd, -truecolors, -autocontrast, -autolevels, -normalize, -equalize, -autodeskew, -balance, -brightness, -contrast, -conbright, -exposure, -gamma, -gammasat, -levels, -levels2, -colorize, -hls, -saturation, -temperature, -sepia, -negate, -log, -posterize, -solarize, -swap, -replace, -replace_ex, -compare.

## Filters and effects

-blur, -gauss, -average, -maximum, -minimum, -medianb, -medianc, -mosaic, -oil, -lens, -spread, -swirl, -tile, -waves, -sharpen, -soften, -unsharp r amount threshold, -edetail, -efocus, -frestore, -eedge, -edgedetect, -emboss, -embossmore, -noise (reduce or add type), -deinter.

## Typical command shapes (checked against the official usage text, not run)

- Resize and convert: `nconvert -out jpeg -q 85 -ratio -resize 1600 0 -rflag decr -o out/%_web *.png`. Every flag is in the 7.300 help text. Changes from the first draft: -ratio moved before -resize because every example in the vendor's Usage.txt puts it first (whether order matters is not documented), and "0" as the auto dimension is now confirmed by the vendor examples (`-ratio -resize 480 0`, `-ratio -resize 0 510`). The `%` stands for the source base name and the extension is appended automatically; whether the `out/` folder is created for you is not documented, so create it first.
- Strip metadata, keep dates: `nconvert -out jpeg -overwrite -rmeta -keepfiledate *.jpg`. The first draft lacked -overwrite; with jpg in and jpeg out the target name equals the input name and the program stops with a "Can't overwrite" error unless -overwrite or an -o pattern (for example `-o clean/%`) is given.
- Vendor examples that are confirmed as written: `nconvert -out tiff file1.pic file2.jpg file3.tga`, `nconvert -out jpeg -truecolors *.gif`, `nconvert -out gif -dither -colors 256 *.jpeg`, `nconvert -out png -resize 200% 200% *.jpeg`, `nconvert -out jpeg -n 1 10 1 -o res#.jpg file##.pic`, and `nconvert -out jpeg -o result_%.jpg file.tga` (gives result_file.jpg). On Windows batch files `%` must be written `%%`.
- Script files: a text file whose lines starting with `###` carry the options for the file names listed below them (the vendor example runs three option sets, for instance `### -out png -rtype lanczos -resize 200% 150%` followed by file names); run it with `nconvert nc.txt`. Avoid repeated spaces in the option lines, the vendor notes they confuse the parser.

## XnConvert interop

XnConvert's Export for NConvert writes a .bat with only action flags (see overview). Not all XnConvert options exist in NConvert.

Formtools note: a CLI should mirror this flag vocabulary for the 25 most common options and add JSON job input; support list files, placeholders, exit codes per file, and a dry-run.

## Not verified

Exit codes, glob handling per OS, behaviour of order of operations in one command (NConvert has a fixed internal order, not documented in sources). Flags beyond 7.121 are now checked: the 7.300 help includes -xyb (XYB colour space for JPEG-li output, WhatsNew 2025) and -clear (WhatsNew 2024), and WhatsNew also records AVIF and JPEG XL output (2022) and "multipage and delete" options (2024). The Windows build may carry flags (text, recurse) that the Linux help lacks; only the Linux build was inspected.

## Sources

- https://www.xnview.com/en/nconvert/
- https://forum.xnview.com/viewtopic.php?p=173031 (first flag list; now corroborated by the vendor build below)
- https://download.xnview.com/NConvert-linux64.tgz (vendor build 7.300: help text, Usage.txt and WhatsNew.txt read, not executed)
- https://newsgroup.xnview.com/viewtopic.php?t=49722 (vendor "NConvert User Guide" post, 2025-10-14)
- https://newsgroup.xnview.com/viewtopic.php?p=127388 (placeholder tokens)
- https://newsgroup.xnview.com/viewtopic.php?p=127958
- https://newsgroup.xnview.com/viewtopic.php?p=190508
