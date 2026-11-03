# NConvert (command line)

Version seen on product page: 7.300. Reads 500+ formats (incl. multipage and animated: APNG, TIFF, GIF), writes about 70. Platforms: Windows, macOS, Linux, plus FreeBSD, Solaris, AIX, QNX and others. License: free for private/educational/non-profit use; Business license 100 EUR + VAT (one per company or application) and Site license 300 EUR + VAT; selling it as a developer toolkit or running it as a server application is not allowed under either. The product page lists no flags and points to a wiki (excluded by rules). The list below is from the official forum post of the program's help output (versions 7.121 and 7.80 merged; some flags exist in one only).

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
Text: -text, -text_font name size, -text_color, -text_back, -text_flag, -text_pos, -text_rotation, -text_border.

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
| -new bpp w h | blank image |

## Colour and tone

-32bits, -colors n (256..8), -grey n, -binary dither (pattern, floyd, halft45, halft90, nodither), -dither/-floyd, -truecolors, -autocontrast, -autolevels, -normalize, -equalize, -autodeskew, -balance, -brightness, -contrast, -conbright, -exposure, -gamma, -gammasat, -levels, -levels2, -colorize, -hls, -saturation, -temperature, -sepia, -negate, -log, -posterize, -solarize, -swap, -replace, -replace_ex, -compare.

## Filters and effects

-blur, -gauss, -average, -maximum, -minimum, -medianb, -medianc, -mosaic, -oil, -lens, -spread, -swirl, -tile, -waves, -sharpen, -soften, -unsharp r amount threshold, -edetail, -efocus, -frestore, -eedge, -edgedetect, -emboss, -embossmore, -noise (reduce or add type), -deinter.

## Typical command shapes (illustrative, composed from the flags above)

- Resize and convert: `nconvert -out jpeg -q 85 -resize 1600 0 -ratio -rflag decr -o out/%_web *.png`
- Strip metadata, keep dates: `nconvert -out jpeg -rmeta -keepfiledate *.jpg`
Not verified by running; syntax of "0" meaning auto-dimension is conventional but not confirmed here.

## XnConvert interop

XnConvert's Export for NConvert writes a .bat with only action flags (see overview). Not all XnConvert options exist in NConvert.

Formtools note: a CLI should mirror this flag vocabulary for the 25 most common options and add JSON job input; support list files, placeholders, exit codes per file, and a dry-run.

## Not verified

Exit codes, glob handling per OS, behaviour of order of operations in one command (NConvert has a fixed internal order, not documented in sources), whether flags beyond 7.121 exist.

## Sources

- https://www.xnview.com/en/nconvert/
- https://forum.xnview.com/viewtopic.php?p=173031 (primary flag list; single source for flags)
- https://newsgroup.xnview.com/viewtopic.php?p=127388 (placeholder tokens)
- https://newsgroup.xnview.com/viewtopic.php?p=127958
- https://newsgroup.xnview.com/viewtopic.php?p=190508
