# Apple Reality Converter, Quick Look AR and USDZ

## Reality Converter status

- A free macOS app from 2019/2020 that converts and previews models as USDZ. From the WWDC 2020 session: imports FBX, OBJ, USD and glTF geometry plus PNG/JPEG textures; exports USDZ only.
- Status (2025-2026): appears withdrawn. An Apple Developer Forums thread shows an Apple engineer in June 2025 recommending Preview on macOS and the `usdcat` command-line tool instead, a beta 6 DMG circulating, a user reporting the beta rejected FBX, and a July 2026 post saying the download is gone from Apple's site. No official deprecation notice was found. (single source: forum thread)
- Apple's current content tool is Reality Composer Pro (requires a recent macOS, deep Xcode integration, visionOS-focused), which is an authoring tool rather than a converter.

formtools note: "convert anything to USDZ with material review" is now an unserved need on macOS; treat Reality Converter as legacy and do not depend on it.

## Reality Converter feature set (WWDC 2020, may be outdated)

### Material and texture inspection
Materials tab lists materials; missing materials get a default fallback; drag textures onto Base Color, Normal, Ambient Occlusion slots; dropping a folder auto-wires textures.
formtools note: folder-drop auto texture wiring is a high-value convenience.

### Environment (IBL) preview and scale grid
Preloaded image-based lighting environments with exposure control, optional solid background, and a grid that shows real-world scale (for example 1 m units).
formtools note: show scale grid with unit selection; wrong units (cm vs m) is the most common AR import bug.

### Units and metadata
Properties tab sets base units and copyright. Animated assets get an icon and play/pause/stop controls in the viewport.
formtools note: surface units and up-axis on import as explicit, editable settings.

### Batch export
Export per asset or File > Export All.
formtools note: batch queue with per-item status checkmarks.

## Quick Look AR and USDZ on the web

- Quick Look displays USDZ in Safari, Messages, Mail, News and Notes on iOS/iPadOS 12+ and visionOS 1+. On Mac a click downloads the file instead of opening AR.
- Capabilities shown: AR placement, audio, built-in behaviors and animation (via .reality files), Apple Pay and custom banners configured by URL fragment parameters (`callToAction`, `checkoutTitle`, `checkoutSubtitle`, `price`, `allowsContentScaling`, `custom`), and an inline model element in Safari on visionOS 26.
- Web embedding is an anchor with `rel="ar"` wrapping an image (general knowledge, not on the fetched page).
- Legacy CLI `xcrun usdz_converter` (general knowledge; Xcode-bundled; reportedly removed in newer Xcode, unverified).
- USDZ container rules (OpenUSD spec 1.3): zip with zero compression and no encryption; file data aligned to 64 bytes; allowed contents are USD layers, images (png, jpeg, exr, avif) and audio (m4a, mp3, wav); first file should be a native USD layer. Standard zip tools cannot add the padding, so use `usdzip` or Apple/Pixar tooling.

formtools note: "Export USDZ for AR Quick Look" should write a spec-valid package (64-byte alignment, USDC default layer, PNG/JPEG textures) and offer a copy-paste `rel="ar"` snippet.

## Sources
- https://developer.apple.com/augmented-reality/tools/ (returned Reality Composer Pro content only)
- https://developer.apple.com/videos/play/wwdc2020/10601/
- https://developer.apple.com/augmented-reality/quick-look/
- https://developer.apple.com/forums/thread/787674
- https://openusd.org/release/spec_usdz.html
