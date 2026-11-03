# ImageGlass

Open-source viewer, now cross-platform. Stable line is 10.0.6.906 (2026-09-05), with a 10.1 beta (2026-10-21). Distinguishing idea: a rebuilt v10 with Classic and Pro editions, a "Turbo" browsing mode, HDR tone mapping, an SDK for codec plugins and external tools, and a layered JSON configuration.

## Facts

- License: core is GPLv3. Two editions arrived in 10.0.4 (Classic and Pro). Pro adds an HDR Tone Mapper, portable mode, projector features and mouse-button action binding; a 14-day Pro Business trial is offered.
- Platforms: Windows 10 1809+ (x64, arm64), macOS 14+ on Apple Silicon, Linux desktop on X11 x64 (Flatpak, then AppImage in 10.0.6). Version 9 is Windows only and depends on the WebView2 runtime.

## Features

- **Speed and how**: described as hardware-aware smart caching that preloads nearby images in the current folder, plus a default Turbo browsing mode for rapid advance (Sequential is the alternative). The exact Turbo algorithm is not documented on pages fetched. The 10.1 beta claims color-managed processing is about 7x faster generally and about 10x for HDR. These are vendor numbers. formtools note: copy the idea of two browsing modes (fast approximate versus exact), and benchmark color-managed paths separately.
- **Zoom and fit**: six zoom modes: auto, lock zoom, scale to width, scale to height, scale to fit, scale to fill. Zoom at cursor, custom zoom levels, selectable interpolation. A request for lock-pan (same idea as lock zoom, for position) was a highly reacted issue. formtools note: ship lock-zoom and lock-pan together.
- **Formats**: 90+ formats including WebP, GIF, SVG, HEIC, AVIF, RAW, JXL, HDR. Native SVG/SVGZ rendering and Motion Photo and multi-frame TIFF came in v10 betas. formtools note: native vector rendering (not rasterize once) keeps SVG sharp at any zoom.
- **Animated**: GIF, WebP and SVG animation plus a frame navigation tool for stepping through frames. APNG and animated WebP were among the most requested items on the tracker (both now closed). formtools note: frame stepping is a quiet but valued feature.
- **Color management and HDR**: color management is listed for Classic, with fixes for CMYK and monitor profile problems in the 10.0 line. Basic HDR in Classic. Pro adds a tone mapper with live controls for exposure, reference white, highlight compression and saturation. The SDK 1.2.0 extends HDR rendering to codec plugins. formtools note: expose tone-mapping sliders so users can tune HDR on SDR monitors.
- **Metadata**: viewed through a companion app, ExifGlass, not built into the main window (as of the pages fetched). formtools note: a built-in metadata panel is a gap here worth filling.
- **Basic edits**: rotate, flip, crop, resize, color picker, lossless compression. formtools note: keep edits to the same short list.
- **Slideshow**: random intervals and sound notifications. formtools note: random interval is a small but distinctive option.
- **Plugin and extension system**: ImageGlass.SDK for external tools that follow photo navigation and run host commands, and for native codec plugins using a C ABI with Native AOT. Plugin trust controls arrived in the 10 RC. Themes packs and layouts. Custom hotkeys and toolbar actions, and mouse binding in Pro. formtools note: a stable C ABI for codecs and trust prompts for plugins is a good model.
- **Configuration**: layered JSON files, locked settings for managed deployments, MSI/MSIX silent install and machine-wide policy. formtools note: layered config with lockable keys.
- **Open demand signals**: viewing images inside compressed archives (open, 19 reactions), star/flag/bookmark (open, 13), launch speed (closed, 18).

## Not verified

- Turbo mode internals, exact lossless rotate support, comic/archive support (requested, not shipped per the tracker at time of fetch), and the license of Pro code.

## Sources

- https://github.com/d2phap/ImageGlass
- https://imageglass.org/
- https://imageglass.org/docs
- https://imageglass.org/docs/features
- https://github.com/d2phap/ImageGlass/releases
- https://api.github.com/search/issues?q=repo:d2phap/ImageGlass+type:issue+sort:reactions-%2B1&per_page=15
