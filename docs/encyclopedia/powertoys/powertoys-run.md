# PowerToys Run

## What it does
Keyboard launcher (based on Wox and Window Walker) for apps, files, calculations, commands and more. Microsoft points users to Command Palette as the planned successor.

## Activation
Default Alt+Space. Esc hides. Ctrl+Shift+Enter run as admin, Ctrl+Shift+U run as different user, Ctrl+Shift+E open containing folder, Ctrl+C copy path, Tab moves through results and context buttons.

## General settings
Activation shortcut; Use centralized keyboard hook; Ignore shortcuts in full-screen mode; Input smoothing; Immediate plugins delay (ms); Background plugins delay (ms); Results shown before scrolling; Clear previous query on open; Results order tuning with Selected item weight (default 5, 0 disables); Wait for slower plugins before selecting top item; Tab through context buttons; Use Pinyin (experimental); Generate thumbnails; Preferred monitor position (primary, mouse, focused window); Theme; Plugin hints; Text size.

## Plugins and direct activation keywords
Calculator =; History !!; Windows Search ?; OneNote o:; PowerToys @; Program .; Registry :; Service !; Shell >; Time and date ); Unit converter %%; URI handler //; Value Generator #; VS Code Workspaces {; Web search ??; Windows settings $; Windows Terminal profiles _; Window Walker <. Also Folder (> inside folder, * mask, >* both) and System commands (shutdown, restart, sign out, lock, sleep, hibernate, recycle bin, UEFI settings, IP, MAC). Each plugin can be disabled, rekeyed, and excluded from global results. Keywords that collide with global query syntax (path characters, math characters) break other plugins.

## Plugin details
- Calculator: + - * / % ^, factorial, ceil, floor, round, exp, min, max, abs, log, ln, sqrt, pow, sign, rand, randi, pi, trig and hyperbolic functions, implied multiplication; follows system number format.
- Program: scans Start menu and similar for .exe, .lnk, .url; arguments after --, or a - / -- / / parameter.
- Time and date: custom formats Name=Pattern or Name=UTC:Pattern; tokens beyond .NET patterns include DOW, DIM, WOM, WOY, EAB, WFT, UXT, UMS, OAD, EXC, EXF.
- Unit converter: acceleration, angle, area, duration, energy, information technology, length, mass, power, pressure, speed, temperature, volume; sq prefix.
- Value Generator: GUID/UUID v1, v3, v4, v5, v7 with ns:DNS/URL/OID/X500; hashes MD5, SHA1, SHA256, SHA384, SHA512; base64 and base64d; url and urld; esc/uesc (data, hex).
- Service: filters !startup:automatic, !status:running. Window Walker: switch, close, kill (UWP kill closes all instances). Windows Search: uses Windows Search Index, Enhanced mode, excluded paths.

## How it works
Devdocs: WPF MVVM app named PowerLauncher; plugins implement IPlugin (Init, Query) and optionally IDelayedExecutionPlugin for slow queries; IPublicAPI offers host services; results have a Score used for ordering; plugin settings persisted in settings.json seeded from each plugin.json (ActionKeyword, IsGlobal). Queries are global (all enabled global plugins) or direct (keyword routed to one plugin). Plugin loading and ranking internals are not covered by the pages fetched.

## Limitations
Keyword conflicts; units not localized; Windows Search depends on index coverage; thumbnails may hurt speed; Pinyin experimental.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

Equivalents: Spotlight, Alfred, Raycast (macOS); Albert, Ulauncher, Rofi, KRunner (Linux). Plugin set maps well: calculator, units, hashes/UUID, web search, app launch (desktop entries and .app bundles), window switching (needs Accessibility or compositor APIs), file search (Spotlight index, plocate/Tracker).

## formtools note
Adopt the plugin contract (init, query, optional delayed query, score, keyword, is-global) and the direct-keyword model; choose a Tauri or similar window with a global hotkey.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/run
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/launcher/architecture.md
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/launcher/plugins/overview.md
