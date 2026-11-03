# XnConvert actions catalog

Action names below come from the official forum's "Actions menu" listing, now corroborated by the UI strings and dialog class names inside the vendor's XnConvert 1.118.0 Linux build (gap pass, 2026-11). The vendor's wiki at xnview.com/wiki no longer exists: every wiki URL now redirects to the forum index, so no wiki page could be fetched. Parameters marked "(binary)" come from widget labels and class names read out of the shipped program file (static inspection only, never run); they give control names but not value ranges. Items still marked (inferred) come from the matching NConvert flags (see `nconvert-cli.md`) and were not seen in a GUI source.

General behaviour: actions form an ordered list; each runs on the output of the previous one; the preview applies them to a sample image. Product page claims more than 80 operations, so the lists below (about 79 names) are consistent. Each action has a panel with enable, move up, move down and delete controls (binary), and the Add action menu is grouped by category: the vendor guide shows the path Add action, Image, Resize; the binary adds the submenu names Channel, Enhance, Noise, Pixelate, Stylize and Transform alongside the older Image, Map, Filter and Misc groups used below.

Actions present in the 1.118.0 binary but missing from the older forum list (names as in the binary): Aspect Pad, Automatic deskew, Black/White Points, Blurred frame, Clear transparent pixels, Curves, Desaturate, Film simulation, Inner Frame, Mono Mixer, Offset, QR Code, Remove alpha channel, Transparent color, Unsharp Mask, White balance, Band. The forum's "Pointilite" appears as "Pointillize" in the binary, and the forum's "Replace Color" as "Replace color".

## Image group

| Action | What it does | Parameters (known or inferred) | Formtools note |
|---|---|---|---|
| Add mask | Applies an alpha/mask image or shape to the picture | (binary) mask file path with browse button, preview, opacity, Stretch or Repeat placement, blur, "Use mask as alpha"; the program ships mask images in an AddOn/Masks folder | alpha compositing with mask file |
| Automatic crop | Trims uniform borders | (binary) mode choice of pixel, colour or edges; tolerance; horizontal and vertical toggles with left, right, top, bottom edge checkboxes; a "zealous" option. NConvert -autocrop takes tolerance plus colour or corner | border detection with tolerance |
| Canvas resize | Changes canvas size, padding or cropping around image | (binary) preset list: Original size, Photo 4x6, 5x7, 6x8 and 8x10 inches, Square by longest side, Square by shortest side; units including inches; Keep ratio; Follow orientation; background colour or "color of pixel at" a chosen position; nine anchor positions. The longest/shortest modes therefore exist in XnConvert | anchor grid + fill colour |
| Change color depth | Converts to other bit depth or palette | colours count (256..8; official NConvert help lists 256, 216, 128, 64, 32, 16, 8), greyscale levels (256 down to 4), 1-bit dither method, true colour, 24-bit and 32-bit; (binary) dither list is Floyd-Steinberg, HalfTone 45, HalfTone 90, Bayer; a "replace alpha for 32-bit images" background colour | quantizer + dither (Floyd, pattern, halftone) |
| Clean metadata | Strips metadata groups | (binary) checkboxes: comment, EXIF, XMP, EXIF thumbnail, IPTC, ICC (NConvert also has an "other markers" bit) | metadata group toggles |
| Crop | Rectangular crop | (binary) two modes, "from position" (x, y, width, height) and "from edge" (top, bottom, left, right), all in pixels | rect crop with numeric entry |
| Extract channel | Outputs a single channel | (binary) radio buttons R, G, B and A | channel split |
| ICC convert | Converts between colour profiles | (binary) input profile (sRGB by default) and output profile (sRGB by default) with file pickers, rendering intent (Perceptual, Relative colorimetric, Absolute colorimetric), "Ignore embedded profile", "Black point compensation" | lcms2 based transform |
| IPTC/XMP | Sets or edits IPTC/XMP fields | tag/value pairs; (binary) mode choice of IPTC-IIM only, XMP only, IPTC-IIM with XMP updated or created, XMP with IPTC-IIM updated or created; "Replace all values", "Keep and add new value" (keywords and supplemental categories), load template; the label warns it works only for JPEG, TIFF and PNG output | tag editor with template variables |
| Mirror | Flip horizontal or vertical | (binary) two radio buttons, vertical and horizontal | trivial |
| Replace Color | Swaps one colour for another | (binary) source colour and target colour, each as a swatch plus R, G, B fields; tolerance (NConvert -replace_ex) | colour-distance mask |
| Resize | Scales image | see below | core feature |
| Rotate | Rotates by angle | (binary) angle slider and spin box, EXIF-orientation mode, smooth, background colour, "Auto crop", orientation filters "Only portrait" and "Only landscape"; quick menu entries for 90 left, 90 right, 180 | EXIF auto-orient |
| Set DPI | Writes resolution metadata | (binary) X and Y DPI fields and a "Keep print size" checkbox (NConvert -keepdocsize) | dpi without resampling vs with |
| Text | Draws text overlay | (binary) string with placeholders, font name, size with a unit choice, bold, italic, underline, strike, anti-alias, text colour and opacity, fill (colour, opacity, full width), border (size, opacity), outline (colour, size), shadow (colour, x and y offset, blur), position and rotation. NConvert maps part of this to -text flags, Windows only | text renderer with variables |
| Vignetting | Darkens or lightens edges | (binary) vignette strength ("power") plus X-Offset and Y-Offset sliders | radial mask |
| Watermark | Overlays an image | file, position preset (9 grid positions) or x/y, opacity 0 to 100, stretch to fit, size percent (matches the official NConvert -wm help) | image overlay with opacity |

Newer Image-group actions (binary labels only, behaviour partly inferred from the names): Aspect Pad (pads to a target ratio; ratio field, colour, mode choice), Blurred frame (fills the padding with a blurred copy; square or width-based, width and height, X and Y margin, blur slider), Inner Frame (distance and fill colour), Border (up to three frames each with width, colour and rounded-corner radius, plus a drop shadow with radius, depth, direction, colour and anti-aliasing, and a background colour with "enlarge"), Border 3D, Transparent color, Clear transparent pixels, Remove alpha channel, Automatic deskew, QR Code (text or GPS string, position, scale, border, X and Y margin), Offset (horizontal and vertical sliders with empty-area, repeat-edge or wrap-around fill).

### Resize action modes (confirmed via XnResize guides, same engine; the vendor's batch guide lists the same seven modes)

- Fit (inside box), Fill (cover box, crops overflow), Longest side, Shortest side, Megapixels, Width only, Height only.
- Units: pixels, percent, inches, cm, mm.
- Keep aspect ratio toggle.
- Enlarge/Reduce policy: both, reduce only, enlarge only (Clemson guide shows "Reduce Only"; NConvert -rflag incr/decr).
- Resample filter: Bilinear, Lanczos, Mitchell mentioned; NConvert lists quick, linear, hermite, gaussian, bell, bspline, mitchell, hanning, lanczos, lanczos2.
- Gamma correction and orientation handling options exist: the binary's resize parameters include a gamma-correct flag and a follow-orientation flag (NConvert -rflag orient); value ranges not shown.
- The vendor's batch guide describes the setting names as "Mode", "Keep ratio", "Enlarge/Reduce" (skip images larger or smaller than the target) and "Resample" (Lanczos suggested for photos).
- Known bug history: percent with longest side once applied to the wrong dimension (fixed in XnView MP 1.3.1, XnConvert status unconfirmed).

## Map group (tone and colour mapping)

Adjust, Align histogram, Automatic contrast, Automatic levels, Color balance, Conbright (combined brightness/contrast), Equalize, Exposure, Gammasat (gamma with saturation), HLS (hue, lightness, saturation), Levels, Logarithmic Lut, Negative, Normalize, Normalize Ex, Posterize, Saturation, Sepia, Shadow-Highlight, Solarize, Swap component, Temperature.

Known parameter ranges from the official NConvert help text (v7.300; the GUI is assumed to match): brightness and contrast -100..100, gamma 0.01..5.0, saturation -100..100 (per channel including cyan/magenta/yellow), temperature -100..100, posterize 2..256 levels, solarize threshold 1..255, levels with black and white points or full in/gamma/out form, sepia percent, channel swap permutations (rbg, bgr, brg, grb, gbr).

GUI panels seen in the binary (labels only): Adjust has brightness, contrast and gamma sliders each with its own reset button; Levels has a histogram, input and output sliders, and a channel selector that includes an "RGB+Luminance" entry; Black/White Points has black point and white point sliders with reset; Color balance and RGB-style panels use red, green, blue sliders; HLS uses hue, lightness, saturation; Temperature has a Cooler/Warmer slider; White balance has a "cut limit"; Posterize has "# of colors"; Mono Mixer has red, green, blue weights; Desaturate has red, green, blue, cyan, magenta, yellow sliders; Swap color has a target order choice; Shadow-Highlight has shadow and highlight sliders.

Curves: CLOSED. A Curves action exists in XnConvert 1.118.0: the program file contains a curves dialog (hint text says a right click removes a control point), a curves processing class and a curves toolbar icon. It sits next to Levels in the Map group; per-channel handling (luminosity, RGB, red, green, blue buttons) is likely but the exact set was not confirmed. Not part of NConvert's flags, so a curves node needs its own LUT model.

Formtools note: implement as 256-entry LUT per channel where possible so Map actions compose into one pass.

## Filter group

Average, Blur, Edge detect, Emboss, Emboss more, Enhance detail, Enhance edges, Enhance focus, Focus restoration, Gaussian blur, Maximum, Median box, Median cross, Minimum, Reduce noise, Sharpen, Soften.

Parameters from the official NConvert help text (v7.300): blur percent 1..100; gauss and average kernel sizes 3,5,7,9,11,13; median box and cross, min, max with kernel size; edge detect intensity light/medium/heavy; enhance edges percent 1..100; sharpen and soften percent 1..100; noise reduction. GUI side (binary): one shared "Filter size" panel with 3x3 up to 13x13 choices, and an edge-detect type choice.

Unsharp Mask is a real GUI action in the 1.118.0 binary (radius, amount and threshold sliders, matching NConvert -unsharp), so it is no longer outside the list.

Formtools note: convolution and rank filters; ship unsharp mask as its own node.

## Misc group (effects and decoration)

Add noise (uniform, gaussian, laplacian, poisson in CLI), Bloom, Border, Border 3D, Crystalize, De-interlace (even/odd lines; duplicate or interpolate), Fantasy, Halftone, Lens, Mosaic (block size 1..64), Oil painting, Oil painting 2, Old camera, Photo Spread, Pointilite, Retro, Shear, Slice, Spread, Swirl (angle 1..360), Symmetry, Tile, Waves (wavelength, phase, amount).

Effect action controls read from the binary (labels and class names; value ranges are not visible there, so none are claimed):

| Action | Controls seen |
|---|---|
| Bloom | a method choice and a blur amount |
| Old camera | a Sepia checkbox and a Shadow checkbox, plus a picture-frame style mask; the program ships ten camera masks (Camera01 to Camera10) in its AddOn/Masks folder |
| Retro | a numbered effect list ("Retro 1", "Retro 2", and so on, thumbnails without descriptive names), plus a vignette group with a power value |
| Fantasy | its own panel; a nearby string group names PhotoBar, Pop, Hope, Charcoal, Thermal 1, Thermal 2, Tritone, Silver, XRay, Mars, Night vision (adjacent in the file, so probably this panel's presets, not confirmed) |
| Film simulation | a thumbnail list of looks, an intensity slider and a folder button (looks load from lookup-table image files) |
| Crystallize | shape choice: Hexagonal, Octogonal, Triangular; a "Fade edges" option |
| Symmetry | mode choice including "Vertical and Horizontal" and "Kaleidoscope", with a sides count |
| Photo Spread | count, method, edges, random, scale, fade, colorize and saturation controls, each with a reset; uses bundled PhotoFiltre-derived mask images |
| Halftone, Waves, Swirl, Mosaic, Tile, Lens, Spread, Shear, Slice, Oil painting, Pointillize, Band | mostly a single value; NConvert ranges apply: mosaic and tile 1..64, oil 1..16, spread 1..32, swirl 1..360, lens 1..100, waves wavelength 1..50, phase 0..360, amount 0..100 |
| Border 3D | up to four values (the binary builds a four-argument border3d call); names not shown |
| De-interlace | Eliminate Odd fields or Even fields, new fields by Duplication or Interpolation |
| Add noise | Uniform, Gaussian, Laplacian, Poisson, plus an amount |

Not verified: the exact effect names behind "Retro N", the Fantasy preset list, and every numeric range for Bloom, Old camera, Retro, Fantasy, Film simulation, Crystallize, Symmetry and Photo Spread.

## Preview and ordering

- Preview pane shows the sample image with the stack applied; before/after comparison is available (vendor tutorials describe preview beside options; exact toggle UI not verified).
- Order is user-controlled; there is no automatic reordering. Practical rule: crop and resize before sharpen; colour-space and metadata actions early or late depending on the target format.

## Not verified

Numeric ranges for the effect actions above and for the GUI panels generally (only widget labels were readable); keyboard shortcuts; whether "Add action" has search. Per-action enable toggles are now indicated by the binary (an "Enabled" checkbox on each action panel).

## Sources

- https://newsgroup.xnview.com/viewtopic.php?p=106044 (action names by group; now corroborated by the binary strings below)
- https://forum.xnview.com/viewtopic.php?p=173031 (NConvert option list used for parameter inference)
- https://www.xnview.com/en/how-to-resize-images/ (resize modes)
- https://www.ghacks.net/?p=161080 (XnResize size modes, resample, units)
- https://digitalcollections.clemson.edu/digitization/digital-projects/instructions/batch-converting/ (Resize longest side, reduce only, Set DPI)
- https://newsgroup.xnview.com/viewtopic.php?p=180300 (resize percent bug, Lanczos2 request)
- https://newsgroup.xnview.com/viewtopic.php?p=163995 (canvas resize options)
- https://newsgroup.xnview.com/viewtopic.php?p=150592 (IPTC keep and add)
- https://www.xnview.com/en/xnconvert/ (product page, version 1.118.0, "over 80 actions", watch folders)
- https://www.xnview.com/en/how-to-batch-convert-and-batch-process/ (vendor guide: tab names, Add action path, resize settings)
- https://download.xnview.com/XnConvert-linux-x64.tgz (vendor's 1.118.0 Linux build, strings inspected, not executed)
- https://download.xnview.com/NConvert-linux64.tgz (vendor's NConvert 7.300 build, help text read from the file, not executed)
- https://www.xnview.com/wiki/index.php/XnConvert (fetched 2026-11-03: redirects to the forum index, wiki gone)
