# New+

## What it does
Adds a New+ submenu to the Explorer right-click menu that creates files or folders from user-defined templates (including shortcuts and full folder trees).

## Activation
Enable in Settings; right-click a folder or the desktop, choose New+, pick a template. The new item is selected and in rename mode. Choose New+ then Open templates to edit the Templates folder.

## Settings
- Templates location: default %localappdata%\Microsoft\PowerToys\NewPlus\Templates (local, not roaming); can point to a synced folder.
- Hide the file extension in template names (on).
- Hide leading digits, spaces and dots in template names (off), so numeric prefixes can order menu entries.
- Hide the built-in New menu (off; per-user; can be locked by Group Policy).
- Replace variables in template filename (off).
- Menu order: alphabetical with folders first.

## Template variables (case-sensitive, same as PowerRename)
Date/time: $YYYY $YY $Y, $MMMM $MMM $MM $M, $DDDD $DDD $DD $D, $hh $h, $mm $m, $ss $s, $fff $ff $f. Special: $PARENT_FOLDER_NAME (inside template subfolders only). Environment variables as %NAME% (case-insensitive). Illegal filename characters produced by substitution become spaces. Substitution applies to names only, not file contents.

## How it works
Copies the template object (recursively for folders) to the target and expands variables in names at copy time (single source).

## Limitations
Names only; templates are device-local by default; variables are exact-case.

## Cross-platform note
macOS Finder has no New+ menu hook besides Quick Actions or an extension; Linux file managers have Templates folders (Nautilus Templates, Dolphin Create New) that map directly.

## formtools note
Template folder plus name-token expansion is trivial and highly portable; share the token engine with the rename feature.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/newplus (single source)
