# XnView MP: editing

Source tags: see xnview-mp-overview.md. Important limit: the complete lists of Adjust, Filter and Effect items live in the official wiki, which was excluded. Below, items marked (FAQ) come from one vendor FAQ answer; items without a tag come from the 2017 guide or release notes. Parameter ranges are NOT documented here.

## Model

Edits happen in View mode on an in-memory image; nothing is saved until Save, Save As or Export. Many dialogs have an "Apply to image" checkbox that must be ticked to commit. GUIDE.

## Tools by menu

| Menu / tool | What it does | Source |
|---|---|---|
| Image > Resize (Shift+S) | New size in pixels or percent, keep aspect, resample filter (Lanczos advised), gamma-correct option, orientation | SITE (FAQ, resize how-to) |
| Resize modes (shared with XnResize and batch) | Fit, Fill, Longest side, Shortest side, Megapixels, Width, Height; Enlarge/Reduce-only guards | SITE |
| Rotate > Rotate... | Free-angle rotation with grid lines for straightening and auto-crop of result | GUIDE |
| Rotate/flip 90, 180 | Standard; lossless for JPEG via "JPEG lossless transformations" | SITE |
| JPEG lossless transformations | Rotation, flip, crop without recompression; crop aligned to the MCU block grid (FAQ says 8x16); batch variant based on EXIF orientation. Optimize Huffman table also offered from metadata cleaner | SITE (FAQ), SEIBERT |
| Crop / selection | Drag selection, set exact size or ratio, Crop tool, optional crop toolbar; crop-and-rotate in one step; auto crop and "zealous crop" (remove uniform borders) and remove horizontal/vertical strip | GUIDE, REL |
| Canvas size | Resize canvas with fill color, used when pasting | REL |
| Image > Adjust | Brightness/contrast, gamma, levels, curves, hue/saturation, color balance, shadow/highlight, auto levels, auto contrast, enhance colors with presets, change color depth/palette, align histogram | SITE (FAQ), REL |
| Image > Filter | Blur, sharpen (unsharp mask), noise reduction, emboss, edge detection, stylised filters; "blur more", effect presets | SITE (FAQ), REL |
| Effects | Vignetting, "old camera" style, Spotlight (brighten selected area relative to the rest), more via presets | GUIDE, REL |
| Red-eye correction | Select area, Image > Red-eye | GUIDE, EDELIN |
| Draw tools (Image > Draw) | Foreground/background colors with picker, shapes (lines, circles, arrows, bubbles), text with outline and shadow, movable until committed, undo/redo, item rotation | SITE, GUIDE, REL |
| Text overlay | Placed by click, resizable, outline and shadow | GUIDE |
| Watermark | Text or image (PNG with transparency) with opacity, position, offset; applied in batch mostly | SITE (FAQ), EDELIN |
| Paste / New image | Paste clipboard into new image, resize canvas question on paste | REL |
| Adobe Photoshop filter plugins | Listed as a vendor feature ("Support for Adobe Photoshop Filters" on the product page, re-confirmed 2026-11); mechanism not documented anywhere reachable, because the xnview.com wiki now redirects to the forum | SITE (single source) |

## Notes for reimplementation

* Edits are bit-depth aware: 8, 16 and 32 bit per channel appear in release notes (PSD 32 bpc, TIFF 16/32). REL.
* Lossless JPEG is a transform of DCT blocks (libjpeg style transform), distinct from the pixel pipeline. A crop that is not block aligned either snaps or forces recompression. SITE.

formtools note: ship a pipeline of reversible "ops" with live preview and an explicit commit; share the same op library between viewer, batch and contact sheet. Provide lossless JPEG via a separate transform module.

## Sources

* https://www.xnview.com/en/faq/
* https://www.xnview.com/wiki/index.php/Filters (fetched 2026-11; redirects to the forum, no content)
* https://www.xnview.com/en/how-to-resize-images/
* https://www.xnview.com/en/xnviewmp/
* https://www.xnview.com/download/XnViewMP%20for%20Beginners.pdf
* https://www.xnview.com/download/GestionWorkflowPhotos_171119.pdf
* https://www.carlseibert.com/xnview-metadata-how-to/
* https://newsgroup.xnview.com/viewtopic.php?t=50905
* https://newsgroup.xnview.com/viewtopic.php?t=50191
* https://newsgroup.xnview.com/viewtopic.php?t=48493
* https://newsgroup.xnview.com/viewtopic.php?t=47669
