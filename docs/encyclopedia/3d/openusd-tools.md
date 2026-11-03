# OpenUSD tools (usdview, usdcat, usdzip, and friends)

## Summary

- OpenUSD (Pixar, now under the Alliance for OpenUSD ecosystem; general knowledge) is a scene description framework. License per the repository LICENSE: Tomorrow Open Source Technology License 1.0, a modified Apache 2.0 where the stated difference is the trademarks section.
- Platforms: developed primarily on Linux, built and supported on macOS and Windows. Embeddable libraries for iOS and visionOS (no Python/CLI). WebAssembly build exists (no CLI). usdview is not supported on Windows ARM64.

formtools note: OpenUSD is heavy to embed (large C++ build, Python for tools). Plan to call prebuilt tools or use lighter readers (three.js USDLoader, F3D, assimp's limited USD import).

## Tools (from the toolset page)

- usdview: interactive viewer with scenegraph browser, introspection tools and embedded Python interpreter. Needs Python bindings, PySide6 or PySide2 and PyOpenGL. Options: `--renderer` (Storm default, Embree, RenderMan), `--select PRIMPATH`, `--camera`, `--mask`, `--unloaded` (skip payloads), `--sessionLayer`, `--complexity` (subdivision level), `--viewportSize WxH`, `--mute`, `--norender`, `--numThreads`, `--quitAfterStartup`.
- usdcat: print any USD-readable file as text; `-o` output, `--usdFormat usda|usdc`, `-l` load check only, `-f` flatten, `--flattenLayerStack`, `--mask`, `--layerMetadata`. Also the converter between usda/usdc/usd and, via plugins, other formats.
- usdzip: creates and inspects usdz packages (builds valid 64-byte-aligned zero-compression archives). Options were not captured (toolset page truncated).
- Others listed: usdedit (edit via temp .usda), usddiff, usdchecker (compliance, general knowledge: validates ARKit-compatible usdz), usdtree, usdrecord (Hydra image/sequence capture), usdresolve, usdstitch, usdstitchclips, usddumpcrate, sdfdump, sdffilter, usdmeasureperformance, usdGenSchema, usdcrush and others.

### Scene graph and stats
usdview's prim tree, property inspector, composition arcs view and layer stack view are the reference for scene-graph UIs.
formtools note: our scene tree should show prim/node path, type, and visibility; USD adds composition info we can skip.

### Camera, render modes, screenshots
Hydra Storm viewport with shaded/wireframe/points/flat/smooth modes, purposes (render/proxy/guide), camera picker, headless capture via usdrecord (modes list is general knowledge; `usdrecord` purpose confirmed in docs).
formtools note: usdrecord is the model for headless thumbnails.

### USDZ packaging rules (spec 1.3)
Zero compression, no encryption; 64-byte data alignment; allowed content USD layers, png/jpeg/exr/avif, m4a/mp3/wav; first file should be a native USD layer.
formtools note: write USDZ with a dedicated routine, never a generic zip library.

## Sources
- https://openusd.org/release/toolset.html (read in two parts; usdzip section missing)
- https://openusd.org/release/spec_usdz.html
- https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt
- https://github.com/PixarAnimationStudios/OpenUSD
