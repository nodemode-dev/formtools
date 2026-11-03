# PowerRename

## What it does
Bulk rename in File Explorer with literal or regex search and replace, counters, random values, dates and photo metadata, with live preview.

## Activation
Select items, right-click, Rename with PowerRename (default or extended context menu).

## Window options
- Search for / Replace with; Use regular expressions; Match all occurrences (off replaces only first match per name, and capture groups usually need it on); Case sensitive (default insensitive).
- Apply to: filename only, extension only (or both).
- Include files, Include folders, Include subfolders (default on).
- Text formatting: lowercase, UPPERCASE, titlecase, capitalize each word.
- Toggles to enable Enumerate items, Random string values, date/time from file creation, photo metadata.
- Per-file checkbox in the Original column; Renamed column header filters to changing items.
- Copilot can draft a regex from natural language (output must be verified).

## Tokens
- Counter: ${} start 0; ${increment=X}, ${padding=X}, ${start=X}, combinable like ${padding=4;increment=2;start=10}.
- Random: ${rstringalnum=X}, ${rstringalpha=X}, ${rstringdigit=X}, ${ruuidv4}.
- Date/time (file creation): $YYYY $YY $Y, $MMMM $MMM $MM $M, $DDDD $DDD $DD $D, $hh $h, $mm $m, $ss $s, $fff $ff $f.
- Photo metadata: $CAMERA_MAKE, $CAMERA_MODEL, $LENS, $ISO, $APERTURE, $SHUTTER, $FOCAL, $FLASH, $EXPOSURE_BIAS, $WIDTH, $HEIGHT, $ORIENTATION, $COLOR_SPACE, $AUTHOR, $COPYRIGHT, $LATITUDE, $LONGITUDE, $ALTITUDE, $DATE_TAKEN_YYYY/YY/MM/DD/HH/mm/SS.
- Capture groups $1, $2 in replacement.

## Regex
Default engine ECMAScript grammar from the C++ standard library; optional Boost for extras such as lookbehind. Sample patterns: ^foo, bar$, (.*).png to foo_$1.png, date reorder (\d\d)-(\d\d)-(\d\d\d\d) to $3-$2-$1.

## Settings
Show PowerRename in default or extended menu; Hide icon; Restore flags on launch; Enable auto-complete; Maximum suggestion count; Show recently used strings; Use Boost library.

## How it works
Devdocs: shell extension DLL (classic and Windows 11 sparse MSIX menus), WinUI 3 app, core C++/WinRT library with item tracking and a manager; preview updates as patterns change; rename applied on confirm. Undo is through Explorer Ctrl+Z (last operation).

## Limitations
Collision handling not documented; metadata tokens need EXIF/XMP present; docs list $ALTITUDE twice.

## Cross-platform note
Pure logic (regex, tokens) is portable; use a regex engine with documented dialect (ECMAScript-like, via Rust regex or JS engines; no lookbehind in Rust regex without fancy-regex). EXIF via exiv2 or libexif. Shell integration: Finder Quick Action, Nautilus/Dolphin actions. Provide own undo journal since Finder and Linux managers differ.

## formtools note
Highest-value rename engine: copy token grammar, flags and preview, and add a persistent undo journal plus collision detection.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/powerrename
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/powerrename.md
