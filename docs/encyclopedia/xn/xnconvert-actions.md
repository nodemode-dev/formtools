# XnConvert actions catalog

Action names below come from the official forum's "Actions menu" listing (single source for the names). Parameter descriptions are mostly inferred from the matching NConvert flags (see `nconvert-cli.md`), because the official help text could not be fetched. Items marked (inferred) were not seen in a GUI source.

General behaviour: actions form an ordered list; each runs on the output of the previous one; the preview applies them to a sample image. Product page claims more than 80 operations, so the lists below (about 79 names) are consistent.

## Image group

| Action | What it does | Parameters (known or inferred) | Formtools note |
|---|---|---|---|
| Add mask | Applies an alpha/mask image or shape to the picture | mask file, mode (inferred) | alpha compositing with mask file |
| Automatic crop | Trims uniform borders | tolerance, background colour or corner position (NConvert -autocrop) | border detection with tolerance |
| Canvas resize | Changes canvas size, padding or cropping around image | width, height, anchor position, background colour; a longest/shortest-side mode exists in NConvert and in XnView MP, XnConvert availability unconfirmed | anchor grid + fill colour |
| Change color depth | Converts to other bit depth or palette | colours count (256..8), greyscale levels, 1-bit dither method, true colour, 32-bit | quantizer + dither (Floyd, pattern, halftone) |
| Clean metadata | Strips metadata groups | per-group removal: comment, EXIF, XMP, EXIF thumbnail, IPTC, ICC, other markers (bitmask in NConvert) | metadata group toggles |
| Crop | Rectangular crop | x, y, width, height (inferred, may include ratio presets) | rect crop with numeric entry |
| Extract channel | Outputs a single channel | channel choice (inferred) | channel split |
| ICC convert | Converts between colour profiles | input profile, output profile, rendering intent, black point compensation, ignore embedded (NConvert -icc_*) | lcms2 based transform |
| IPTC/XMP | Sets or edits IPTC/XMP fields | tag/value pairs; a "keep existing and add new value" option exists (forum) | tag editor with template variables |
| Mirror | Flip horizontal or vertical | direction | trivial |
| Replace Color | Swaps one colour for another | source colour, target colour, tolerance | colour-distance mask |
| Resize | Scales image | see below | core feature |
| Rotate | Rotates by angle | degrees, smooth option, background fill; EXIF-orientation auto rotate exists as an option elsewhere | EXIF auto-orient |
| Set DPI | Writes resolution metadata | X and Y DPI; NConvert can optionally rescale pixels to keep document size | dpi without resampling vs with |
| Text | Draws text overlay | string (variables allowed), font, size (px or percent of height), colour, background, position preset or offset, rotation, border | text renderer with variables |
| Vignetting | Darkens or lightens edges | strength/radius (inferred) | radial mask |
| Watermark | Overlays an image | file, position preset (9 grid positions) or x/y, opacity 0 to 100, stretch to fit, size percent | image overlay with opacity |

### Resize action modes (confirmed via XnResize guides, same engine)

- Fit (inside box), Fill (cover box, crops overflow), Longest side, Shortest side, Megapixels, Width only, Height only.
- Units: pixels, percent, inches, cm, mm.
- Keep aspect ratio toggle.
- Enlarge/Reduce policy: both, reduce only, enlarge only (Clemson guide shows "Reduce Only"; NConvert -rflag incr/decr).
- Resample filter: Bilinear, Lanczos, Mitchell mentioned; NConvert lists quick, linear, hermite, gaussian, bell, bspline, mitchell, hanning, lanczos, lanczos2.
- Gamma correction and orientation handling options exist in XnResize (details not verified).
- Known bug history: percent with longest side once applied to the wrong dimension (fixed in XnView MP 1.3.1, XnConvert status unconfirmed).

## Map group (tone and colour mapping)

Adjust, Align histogram, Automatic contrast, Automatic levels, Color balance, Conbright (combined brightness/contrast), Equalize, Exposure, Gammasat (gamma with saturation), HLS (hue, lightness, saturation), Levels, Logarithmic Lut, Negative, Normalize, Normalize Ex, Posterize, Saturation, Sepia, Shadow-Highlight, Solarize, Swap component, Temperature.

Known parameter ranges from NConvert equivalents (inferred for GUI): brightness and contrast -100..100, gamma 0.01..5.0, saturation -100..100 (per channel including cyan/magenta/yellow), temperature -100..100, posterize 2..256 levels, solarize threshold 1..255, levels with black and white points or full in/gamma/out form, sepia percent, channel swap permutations (rbg, bgr, brg, grb, gbr).

Curves: no action named "Curves" appears in the Map list. Adjust and Levels cover tone. (Could not verify that a curve editor exists; likely inside Adjust, unconfirmed.)

Formtools note: implement as 256-entry LUT per channel where possible so Map actions compose into one pass.

## Filter group

Average, Blur, Edge detect, Emboss, Emboss more, Enhance detail, Enhance edges, Enhance focus, Focus restoration, Gaussian blur, Maximum, Median box, Median cross, Minimum, Reduce noise, Sharpen, Soften.

Inferred parameters from NConvert: blur percent 1..100; gauss and average kernel sizes 3,5,7,9,11,13; median box and cross, min, max with kernel size; edge detect intensity light/medium/heavy; enhance edges percent; unsharp mask exists in CLI (radius, amount, threshold) though not in this GUI list; noise reduction.

Formtools note: convolution and rank filters; unsharp mask should be added anyway.

## Misc group (effects and decoration)

Add noise (uniform, gaussian, laplacian, poisson in CLI), Bloom, Border, Border 3D, Crystalize, De-interlace (even/odd lines; duplicate or interpolate), Fantasy, Halftone, Lens, Mosaic (block size 1..64), Oil painting, Oil painting 2, Old camera, Photo Spread, Pointilite, Retro, Shear, Slice, Spread, Swirl (angle 1..360), Symmetry, Tile, Waves (wavelength, phase, amount).

Border and Border 3D (inferred): thickness, colour, 3D bevel style. Parameters for Bloom, Fantasy, Old camera, Retro, Photo Spread, Pointilite, Crystalize, Symmetry: not verified.

## Preview and ordering

- Preview pane shows the sample image with the stack applied; before/after comparison is available (vendor tutorials describe preview beside options; exact toggle UI not verified).
- Order is user-controlled; there is no automatic reordering. Practical rule: crop and resize before sharpen; colour-space and metadata actions early or late depending on the target format.

## Not verified

Full per-action parameter lists; existence of a curves editor; presence of selective per-action enable toggles; keyboard shortcuts; whether "Add action" has search.

## Sources

- https://newsgroup.xnview.com/viewtopic.php?p=106044 (action names by group, single source)
- https://forum.xnview.com/viewtopic.php?p=173031 (NConvert option list used for parameter inference)
- https://www.xnview.com/en/how-to-resize-images/ (resize modes)
- https://www.ghacks.net/?p=161080 (XnResize size modes, resample, units)
- https://digitalcollections.clemson.edu/digitization/digital-projects/instructions/batch-converting/ (Resize longest side, reduce only, Set DPI)
- https://newsgroup.xnview.com/viewtopic.php?p=180300 (resize percent bug, Lanczos2 request)
- https://newsgroup.xnview.com/viewtopic.php?p=163995 (canvas resize options)
- https://newsgroup.xnview.com/viewtopic.php?p=150592 (IPTC keep and add)
