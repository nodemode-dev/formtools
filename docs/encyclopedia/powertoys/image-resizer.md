# Image Resizer

## What it does
Batch-resizes images from the File Explorer context menu, by drag-and-drop with the right mouse button, or through a command-line tool.

## Activation
- Select images, right-click, choose Resize with Image Resizer.
- Right-drag selected files to a folder to resize into it.
- CLI: PowerToys.ImageResizer.CLI.exe (the PowerToys bin folder is on PATH).

## Settings
- Size presets: add, edit, delete; units are centimeters, inches, percent or pixels; leaving width or height empty derives it from aspect ratio.
- Fit modes: Fill (keep ratio, crop), Fit (keep ratio, no crop, fits inside), Stretch (exact size, may distort).
- Ignore the orientation of pictures: swaps preset width/height per image so portrait and landscape end up the same size.
- Fallback encoder (PNG, JPEG, TIFF, BMP, GIF, WMPhoto): used only when the source format cannot be encoded (for example WMF, which can be decoded only). Not a conversion tool.
- PNG interlacing: Default, On, Off.
- TIFF compression: Default, None, CCITT3, CCITT4, LZW, RLE, Zip.
- JPEG quality: no GUI control is described in the page; the CLI has --quality 1 to 100.
- Filename format tokens: %1 original name, %2 preset name, %3 selected width, %4 selected height, %5 actual height, %6 actual width. A path separator in the format creates subfolders. Illegal filename characters become underscores.
- Keep or reset last-modified date.
- settings.json is watched and reloaded live.

## CLI options
--help, --show-config, --destination/-d, --width/-w, --height/-h, --unit/-u (Pixel, Percent, Inch, Centimeter), --fit/-f, --size (0-based preset index), --shrink-only, --replace/-r (overwrite originals), --ignore-orientation, --remove-metadata, --quality/-q, --keep-date-modified, --filename/-n, --progress-lines (accessible progress at 0/25/50/75/100%). Explicit width or height overrides --size. Percent with Fill or Fit requires a width; height-only percent works only with Stretch. Bad --size index errors out without touching inputs.

## How it works
Developer docs: a shell extension DLL (context menu, registered via sparse MSIX on Windows 11, classic COM extension on Windows 10), a WPF UI app, and a core library built on the Windows Imaging Component (WIC) (source: devdocs, single source for internals). The menu appears only for image types (the extension checks perceived type). Output keeps the original codec when an encoder exists, else the fallback.

## Limitations
No full input format list in docs; default preset values not documented in the pages fetched; no format conversion.

## Cross-platform note
Replace WIC with libvips, ImageMagick or the platform codecs (ImageIO on macOS). Context menu integration: Finder Quick Actions / Services on macOS; Nautilus/Dolphin/Thunar scripts or actions on Linux. Keep the preset model, fit modes and token naming identical across OSes.

## formtools note
Core feature: presets plus Fill/Fit/Stretch, %1..%6 naming tokens, shrink-only, metadata strip, and a CLI mirroring these flags.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/image-resizer
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/imageresizer.md
