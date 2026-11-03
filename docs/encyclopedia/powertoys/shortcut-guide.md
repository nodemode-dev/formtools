# Shortcut Guide (PowerToys)

## What it does
A searchable keyboard-shortcut reference window. Ships manifests for Windows, PowerToys and many apps; shows shortcuts for the focused app plus PowerToys and matching background apps. In its current form it is a normal window (the older overlay model is superseded per the current docs).

## Activation
- Win+Shift+? (default): toggle. Press again, Esc, or the close button to dismiss.
- Hold a Windows key (default 900 ms): by setting, shows taskbar indicators (default), opens the guide, or does nothing. Indicators always close on key release.

## UI
Sidebar of active apps; sections like File/Edit/View; recommended shortcuts on top; pinning of frequent shortcuts; title-bar search over names, descriptions, modifiers and keys. Ctrl+F focuses search, first Esc clears it, second closes the guide.

## Settings
Enable; Activation shortcut; Hold Windows key action (Off, Show taskbar indicators, Open Shortcut Guide); Hold duration 100 to 5000 ms (default 900); Close on Windows key release (only for Open mode, default on); App theme (Light, Dark, Windows default); Window position (Left or Right); Exclude apps (one per line).

## Manifests
Built-in apps include the Windows shell, File Explorer, Notepad, Paint, Microsoft 365 apps, Edge, Chrome, Firefox, Brave, Teams, Slack, Discord, VS Code, Windows Terminal, Photoshop, Figma, Blender, 1Password, Obsidian and more (list changes per release; authoritative copy is the Manifests folder in the repo). Custom YAML manifests load from %LOCALAPPDATA%\Microsoft\WinGet\KeyboardShortcuts. Fields: PackageName, Name, WindowFilter (process/window for focus detection), BackgroundProcess, SectionName/Properties with Name, Recommended, and Shortcut entries (Win/Ctrl/Shift/Alt flags plus Keys). Release 0.102 added Claude Desktop and Ableton Live and made indexing tolerant of malformed manifests.

## Limitations
- Only apps with a manifest show content.
- Needs PowerToys running and the module enabled.
- Dev doc page for internals could not be fetched; internals not verified.

## Cross-platform note
The manifest format (YAML, window filter, modifier flags) is OS-neutral and reusable. Foreground-app detection needs NSWorkspace on macOS and, on Linux, X11 properties or compositor-specific APIs (limited on Wayland). Hold-modifier triggers need a global key listener (Accessibility permission on macOS).

formtools note: Adopt the YAML manifest schema, with per-OS modifier mapping (Cmd for Ctrl/Win), and a searchable window fed by foreground-app detection.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/shortcut-guide
- https://github.com/microsoft/PowerToys/releases
