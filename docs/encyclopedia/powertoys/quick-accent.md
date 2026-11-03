# Quick Accent (PowerToys)

## What it does
Lets you type accented and special characters on a keyboard layout that lacks them. You hold a base letter, trigger a small toolbar of variants, pick one, and the character is inserted. Derived from the community PowerAccent project by Damien Leroy. Formerly named Power Accent.

## Activation
No global hotkey. Enable in Settings, then use the Activation key mode:
- Trigger-key modes: Left/Right arrow, Space, or "Left, Right or Space" (default). Hold the letter, press the trigger, picker opens after the input delay (default 300 ms, minimum 100). Arrows/Space move the selection, release inserts it. Example: hold A then Space gives an accented a.
- Press-and-hold mode (opt-in, added in 0.102): the plain letter is typed immediately; if still held past the hold duration (default 500 ms, range 100 to 3000), the picker opens, and releasing replaces the letter with the pick. A tap yields only the plain letter.

## Settings and options
- Activation key (modes above)
- Do not activate when Game Mode is on
- Characters: restrict picker to chosen sets. About 40 language sets (Catalan, Czech, French, German, Greek, Hebrew, Polish, Vietnamese, Welsh, recent Belarusian Latin/Cyrillic, Pitjantjatjara/Yankunytjatjara) plus special sets (Special Characters, Currency, Greek Polytonic, IPA, Middle Eastern Romanization, Proto Indo European)
- Character reference guide: searchable window showing which sets give which characters per base letter; hover shows Unicode description, click copies
- Toolbar position: nine anchors (top center default, bottom center, left, right, four corners, center)
- Show Unicode code and name of highlighted character
- Sort characters by usage frequency
- Start selection from the left (applies to all activation keys)
- Input delay (ms), Hold duration (ms)
- Excluded apps: one name per line, partial match (Notepad matches Notepad.exe and Notepad++.exe), add .exe for exact

## How it works
Six projects per the dev docs: a common library with per-letter mappings and a LetterKey enum; a core library (accent logic, settings, nine-anchor positioning with per-monitor DPI, usage stats); a WinUI 3 overlay app (migrated from WPF) that is non-activating and always on top so the target app keeps focus; a WinRT keyboard service that installs keyboard hooks; and a native module interface DLL bridging to the PowerToys runner. Language data lives in a CharacterMappings source file.

## Limitations
- Does not intercept Ctrl, Alt, AltGr or Windows-key combinations.
- Toolbar may still appear after a quick tap (kept intentionally per devs). Rapid presses can spawn several background tasks.
- A 0.102.3001 hotfix addressed crashes with arrow-key activation after changing languages.
- Docs do not state where usage-frequency data is stored.

## Cross-platform note
macOS has a native press-and-hold accent popup (can be disabled per app), so the value there is custom sets and a unified picker. Linux has Compose key and IBus/Fcitx but no built-in hold-to-pick; a keyboard hook (evdev/X11 XInput, limited on Wayland, needs input-method protocol) plus a non-focus-stealing overlay is required. Character tables are portable data.

formtools note: Ship character-set data as plain JSON and build a hold-to-pick overlay per platform, preferring OS input-method APIs over raw hooks.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/quick-accent
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/quickaccent.md
- https://github.com/microsoft/PowerToys/releases (0.102 notes: press-and-hold, WinUI 3, hotfix)
