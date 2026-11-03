# Keyboard Manager

## What it does
Remaps keys and shortcuts, maps them to text, app launches or URIs, optionally per application.

## Activation
No hotkey; runs in the background while PowerToys runs and the module is enabled. Remaps apply immediately after OK. Since 0.100 a WinUI 3 editor is default, with a toggle back to the legacy editor.

## Settings and remap types
- Use the new editor (toggle); Remap a key; Remap a shortcut. Rows have a Select (input) and To send (output) column.
- Key to key (A to B; add B to A to swap).
- Key to shortcut (remap persists when the key is part of another combo; order of presses matters).
- Key to text.
- Shortcut to shortcut: must start with a modifier (Ctrl, Shift, Alt, Win), end with a non-modifier, at most four keys (five for chords).
- Chords: modifiers plus two non-modifier keys, enabled by Allow chords in the recording dialog.
- Shortcut to single key, with Exact Match option (fire only when nothing else is held).
- Shortcut to text (Unicode ok).
- Shortcut to start an app: App path (env vars expanded), Args, Start in, Elevation (Normal, Elevated, Different User), If running (Show Window, Start another instance, Do nothing, Close, End task), Visibility.
- Shortcut to open a URI or path.
- Target app: per-app remaps matched by process name (for example msedge, not the display name).
- Key capture: hold Enter to confirm, Esc to cancel, or use the drop-down with type-to-search.
- Orphaned key warning when a key's output becomes unreachable.

## Special cases
Win+L and Ctrl+Alt+Del cannot be remapped; Fn generally cannot; F1 to F24 can; Pause sends one key-down only; Win+G may still open Game Bar; Office and Copilot keys send composite shortcuts; AltGr equals Left Ctrl + Right Alt so remapping those breaks it.

## How it works
Installs a low-level keyboard hook (source: devdocs). Event order: pass-through during table updates, drop events tagged as its own, capture for the editor, single-key remaps first, then shortcut matching (app-specific before global). Single-key remaps run first so a remapped modifier is already translated for shortcut matching. Output uses SendInput with extended-key flags, scan codes filled from virtual keys (some apps drop zero scan codes), and a dummy 0xFF key between modifier changes to stop Start menu or menu-bar side effects. Injected events carry a marker in extra-info; NumLock is corrected by sending a compensating press. Remaps follow the character of the active layout, not the physical position, and are not per-device.

## Limitations
No effect on sign-in or secure screens or elevated windows unless PowerToys is elevated; poor fit for games; other keyboard hooks can interfere; certain media/calculator keys cannot be injected into elevated windows (UIPI); no per-keyboard mappings; no Mac or Linux profiles.

## Cross-platform note
macOS: CGEventTap (needs Input Monitoring and Accessibility permissions), or IOKit HID remapping (hidutil) for plain key swaps. Linux: evdev/uinput grabbing (needs input group or root) works on X11 and Wayland; compositor-level hooks are not portable. Per-device mapping is feasible on Linux and macOS HID, unlike on Windows.

## formtools note
Model remaps as rule records (input chord, output action, optional app filter); engine ordering (single keys, then shortcuts, app before global) is worth copying.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/keyboard-manager
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/keyboardmanager/keyboardmanager.md
