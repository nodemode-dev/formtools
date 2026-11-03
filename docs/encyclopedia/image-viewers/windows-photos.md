# Windows Photos (Microsoft Photos), 2026

Microsoft's bundled viewer, editor and gallery for Windows 11 (some AI editing also on Windows 10 and Arm64). In October 2026 Microsoft announced a rebuilt Photos app; the older app remains as "Photos Legacy". License: proprietary, bundled with Windows, updated via the Store.

## Features

- **New viewer (2026)**: redesigned, photo-first layout with arrow-key navigation. Microsoft's own controlled tests (against version 2026.11060) report about 15% faster opening on average and up to 30% for HEIC, and an editor launch about 25% faster. These are vendor figures and vary by device. Opening an image from File Explorer launches the new Viewer. formtools note: publish comparable cold-open numbers for HEIC specifically.
- **HDR**: improved HDR display in the viewer, and the rebuilt editor preserves HDR color and contrast while editing. formtools note: HDR must survive an edit round-trip, not just display.
- **File types**: SVG viewing added (July 2026 build), HEIC and WebP can be edited and saved in the original format. Tiny images (for example 16 by 16 pixel art) zoom larger and stay sharp (June 2026 build). formtools note: nearest-neighbour upscaling for tiny images is a quick win.
- **Info panel**: file name, date, camera details, a map when location exists, a histogram, and visual search. formtools note: histogram plus map in one metadata panel is the target.
- **Text in images (OCR)**: text extraction in 160+ languages, with keyboard selection of detected text added in June 2026 (arrow, Shift, Home/End, Ctrl+A). formtools note: OCR copy-text is a cross-platform differentiator; use an offline engine.
- **AI editing**: the editor groups tools into Crop, Enhance, Repair and Stylize. Repair removes objects by circling or brushing over them (this is the evolution of Generative erase, which replaced Spot fix and had a mask-per-object mode). Background blur: one click detects the subject, with adjustable strength and a refining brush; remove and replace background also exists; these came to Arm64 and Windows 10 in 2024. Relight: up to three light sources with color, shared focus point, intensity and presets; first Copilot+ Snapdragon only, later all Windows 11 devices. Super resolution: up to 8x enlargement, runs on the device NPU, Snapdragon Copilot+ PCs with 24H2 at launch of the preview (October 2024). Social-media crop templates. formtools note: pick local models for erase, blur and upscale and be explicit about hardware needs and fallback.
- **AI provenance**: optional visible Copilot watermark on AI-generated or edited images, with Never, Always, Ask every time (off by default, June 2026 build). formtools note: ask-at-save is a clean pattern for AI disclosure. (single source)
- **File Explorer integration**: right-click AI actions (background blur, object erase), limited to JPG, JPEG and PNG in the 2025 Canary build. formtools note: a shell context-menu entry that opens straight into an edit mode.
- **Search and gallery**: natural-language search (Copilot+ hardware, local Pictures library), filters by location and people, albums, Favorites, Moments, "On this day", OneDrive and iCloud merged, offline for local and iCloud. Photos Legacy has a filmstrip and multi-view side-by-side compare; the new app's change page says the new app has filmstrip and multi-view. Albums became folders, the People tab, face grouping and tag search were removed in that app. formtools note: do not build cloud features; filmstrip and multi-view are the relevant viewer ideas.
- **Slideshow, animated, RAW, archive, batch, plugins, lossless rotate, shortcuts**: not covered in Microsoft sources fetched. HEIC and MOV from iPhones depend on installed codecs per Q&A threads (not fetched in detail).
- **Platforms**: Windows only; rollout starts with Windows Insiders, broader availability planned later in 2026.

## Not verified

- Final public GA date, a full supported-format list, whether editing is lossless for JPEG, shortcut list, and which AI features need Copilot+ hardware in the new app (Relight now broad, others unclear).

## Sources

- https://blogs.windows.com/windowsexperience/2026/10/15/meet-the-new-photos-app-on-windows-11/
- https://support.microsoft.com/en-us/windows/apps/photos/changes-in-the-new-photos-app
- https://support.microsoft.com/en-us/windows/apps/photos/what-is-photos-legacy
- https://learn.microsoft.com/en-us/windows-insider/release-notes/apps/photos
- https://blogs.windows.com/windows-insider/2024/02/22/windows-photos-gets-generative-erase-and-recent-ai-editing-features-now-available-on-arm64-devices-and-windows-10/
- https://blogs.windows.com/windows-insider/2024/10/22/microsoft-photos-update-with-super-resolution-begins-rolling-out-to-windows-insiders/
- https://blogs.windows.com/windows-insider/2023/09/14/windows-photos-gets-background-blur-search-motion-photo-support-and-other-enhancements/
- https://blogs.windows.com/windows-insider/2025/06/06/ai-powered-relight-and-search-now-available-in-microsoft-photos/
- https://blogs.windows.com/windows-insider/2025/09/08/announcing-windows-11-insider-preview-build-27938-canary-channel/
