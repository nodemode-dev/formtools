# Microsoft PowerToys: index and split

Snapshot date: 2026-11-03. Part 1 of 3 (utilities A to F). Written for the formtools feature encyclopedia.

## 1. Current version and release cadence

- Latest stable on the GitHub releases page: v0.102.3001.0, published 27 Oct 2026. It is a hotfix over v0.102.2933.0 (21 Oct 2026) that fixes File Locksmith crashes during a stalled handle scan and Quick Accent crashes after a language switch.
- Newest pre-releases seen: dev previews v0.103.3006 (28 Oct) and v0.103.3012.0 (29 Oct). The source tree on `main` is on release train 0.103.
- The releases page shows day and month only, no year. The year 2026 is inferred from the build-number scheme: `src/Version.props` documents a `YDDDB` build number counted from 2026-01-01 (Y = years since the epoch, DDD = day of year, B = build of that day). Example: 2933 decodes to Y=0, day 293, build 3, which is 20 Oct 2026 (single source: repo, plus inference).
- Observed stable dates in 2026 (releases pages 1 and 2): v0.99.0 on 28 Apr, v0.99.1 on 29 Apr, v0.100.0 on 10 Jun, v0.100.1 on 24 Jun, v0.101.2362.0 on 25 Aug, v0.102.2933.0 on 21 Oct. So a new minor release train lands roughly every 6 to 10 weeks, followed by one or more patch releases within days or weeks, and a "Preview" or "Dev preview" channel in between. Older dates (v0.96 to v0.98) were not visible.
- Update channels: stable and preview. A Group Policy exists to disable preview updates (PowerToys 0.100.0 and later).
- Install: GitHub release assets, Microsoft Store, WinGet (`Microsoft.PowerToys`), plus community tools (Chocolatey, Scoop). Four installer flavours per release: per-user or machine-wide, each for x64 or ARM64 (asset names of the form `PowerToysUserSetup-<ver>-<arch>.exe` and `PowerToysSetup-<ver>-<arch>.exe`).
- Requirements (Learn install page): Windows 11, or Windows 10 version 2004 (build 19041) or newer; 64-bit x64 or ARM64; Edge WebView2 runtime installed by the bootstrapper.

## 2. License

MIT. The repo `LICENSE` file is the standard MIT text with "Copyright (c) Microsoft Corporation". The README states the application logs basic diagnostic data (telemetry) and points to a data-and-privacy document.

## 3. Architecture notes

Primary sources: `doc/devdocs/core/architecture.md`, `runner.md`, `modules/interface.md`, `core/settings/*` in the repo.

- **Runner**: `PowerToys.exe`. Single-instance (mutex). Owns the tray icon, installs low-level keyboard hooks, loads each module DLL, starts the enabled ones, and runs the Windows message loop. It also forwards registered global hotkey events to modules and handles updates.
- **Module interface**: every utility exposes a DLL implementing `PowertoyModuleIface`: `get_name`, `get_events`, `get_config`, `set_config`, `call_custom_action`, `enable`, `disable`, `is_enabled`, `destroy`. The runner calls `powertoy_create()`, then `enable()`; settings edits arrive through `set_config`.
- **Four module shapes** (from the architecture doc): (1) simple modules living entirely inside the interface DLL (example: Mouse Pointer Crosshairs, Find My Mouse); (2) launchers of an external app (example: Color Picker, historically a WPF app, now WinUI 3), talking over named pipes or other IPC; (3) context-menu or shell-extension modules (example: PowerRename, File Locksmith, Image Resizer, New+), with Windows 11 menus delivered via a sparse MSIX package; (4) registry-based modules (File Explorer add-ons) that register preview handlers and thumbnail providers when toggled.
- **Settings app**: a separate WinUI 3 process (Settings v2) with a flyout (tray left click) and a dashboard. Runner and Settings talk over a two-way Windows named pipe carrying JSON messages (for example a "show yourself" message selecting flyout or dashboard). Per-module settings live as JSON under `%LocalAppData%\Microsoft\PowerToys\<Module>\`. Hotkeys are edited with a custom hotkey control.
- **Group Policy**: ADMX/ADML templates ship as `GroupPolicyObjectsFiles-<ver>.zip` in each release (since 0.64). Policies appear under Administrative Templates > Microsoft PowerToys, Computer Configuration beats User Configuration, per-utility enabled-state policies beat the global one (global policy since 0.75). Categories: global enabled state, per-utility enabled state, general (allow experimentation), installer and updates, Advanced Paste (online AI models, plus per-provider policies present in the ADMX), File Explorer preview (Markdown local images), Mouse Without Borders, New+, PowerToys Run plugins. In the settings UI a policy-managed control is locked and shows the policy value. Policy beats user setting, which beats default.
- **Other plumbing**: Desired State Configuration support (`src/dsc`, `doc/dsc`), per-utility command-line tools added to `PATH` by recent releases (Advanced Paste, FancyZones, File Locksmith, Light Switch, Peek, PowerDisplay, Settings), shared `common` library (JSON helpers, IPC primitives, logging via spdlog), mixed C++/WinRT and C#/.NET code, UI tests built on a custom `UITest.Next` harness.
- **Repo layout (top level)**: `src/modules/*` (one folder per utility; folder names do not always match product names, see section 6), `src/runner`, `src/settings-ui`, `src/gpo`, `src/common`, `src/dsc`, `installer`, `doc/devdocs`.

## 4. Complete current utility list

Source: Learn docs index (31 entries, page last updated 2026-10-14), cross-checked against the repo README grid and `src/modules`.

| # | Utility (Learn name) | Learn path | Part |
|---|---|---|---|
| 1 | Advanced Paste | advanced-paste | 1 |
| 2 | Always On Top | always-on-top | 1 |
| 3 | Awake | awake | 1 |
| 4 | Color Picker | color-picker | 1 |
| 5 | Command Not Found | cmd-not-found | 1 |
| 6 | Command Palette | command-palette/overview | 1 |
| 7 | Crop And Lock | crop-and-lock | 1 |
| 8 | Environment Variables | environment-variables | 1 |
| 9 | FancyZones | fancyzones | 1 |
| 10 | File Explorer add-ons | file-explorer | 1 |
| 11 | File Locksmith | file-locksmith | 1 |
| 12 | Grab And Move | grab-and-move | 2 |
| 13 | Hosts File Editor | hosts-file-editor | 2 |
| 14 | Image Resizer | image-resizer | 2 |
| 15 | Keyboard Manager | keyboard-manager | 2 |
| 16 | Light Switch | light-switch | 2 |
| 17 | Mouse utilities | mouse-utilities | 2 |
| 18 | Mouse Without Borders | mouse-without-borders | 2 |
| 19 | New+ | newplus | 2 |
| 20 | Peek | peek | 2 |
| 21 | Power Display (repo: PowerDisplay) | power-display | 2 |
| 22 | PowerRename | powerrename | 2 |
| 23 | PowerToys Run | run | 2 |
| 24 | Quick Accent | quick-accent | 3 |
| 25 | Registry Preview | registry-preview | 3 |
| 26 | Screen Ruler | screen-ruler | 3 |
| 27 | Shortcut Guide | shortcut-guide | 3 |
| 28 | Text Extractor | text-extractor | 3 |
| 29 | Window Hopper | window-hopper | 3 |
| 30 | Workspaces | workspaces | 3 |
| 31 | ZoomIt | zoomit | 3 |

Sub-utilities inside the "Mouse utilities" page (per the docs page description, the GPO table and `src/modules/MouseUtils`): Auto Hide Cursor (new name CursorHide in the 0.102 notes), CursorWrap, Find My Mouse, Mouse Button Lock (new in 0.102), Mouse Highlighter, Mouse Jump, Mouse Pointer Crosshairs. They are owned by part 2.

## 5. The split (for cross-checking)

Rule: assign by the first letter of the **title of the Learn docs page**, case-insensitive ("New+" counts as N). A sub-utility belongs to its parent page. Aliases and codenames never move a utility.

- **Part 1 (this file set): A through F**: Advanced Paste, Always On Top, Awake, Color Picker, Command Not Found, Command Palette, Crop And Lock, Environment Variables, FancyZones, File Explorer add-ons, File Locksmith. (11)
- **Part 2: G through P**: Grab And Move, Hosts File Editor, Image Resizer, Keyboard Manager, Light Switch, Mouse utilities (all seven sub-utilities), Mouse Without Borders, New+, Peek, Power Display, PowerRename, PowerToys Run. (12)
- **Part 3: Q through Z, plus digits and symbols**: Quick Accent, Registry Preview, Screen Ruler, Shortcut Guide, Text Extractor, Window Hopper, Workspaces, ZoomIt. (8) No utility currently starts with a digit or symbol.

Boundary cases to confirm between researchers:
1. **Mouse utilities sub-tools**: Auto Hide Cursor and CursorWrap start with A or C, Find My Mouse starts with F. By the page-title rule they are part 2. At the time of writing part 2 had already produced separate files for `auto-hide-cursor.md`, `cursor-wrap.md` and `find-my-mouse.md` in this folder, so part 1 deliberately writes nothing for them and there is no gap.
2. **Window Hopper**: the repo module folder, release-notes heading and settings key are `AltWindowCycle` ("Alt Window Cycle" in the 0.102 notes). The product is Window Hopper, so part 3 owns it. Part 1 does not cover it.
3. **Command Palette** (part 1) is the successor to **PowerToys Run** (part 2). Cross-reference, do not duplicate. Command Palette's Dock, extension model and built-in providers are in part 1's `command-palette.md`.
4. **Video Conference Mute** still appears in the Learn Group Policy table but not in the docs index or `src/modules`; treat as retired (inference; a `video-conference-mute.md` written by another researcher in this folder reports removal in 0.88, which I did not verify).
5. The ADMX file also names per-provider Advanced Paste policies including one for Anthropic; see `advanced-paste.md` for the discrepancy.

## 6. Name aliases and codenames seen in primary sources

| Product name | Alias or internal name |
|---|---|
| Always On Top | module key `alwaysontop` |
| Color Picker | `colorPicker` folder, setting keys `copiedcolorrepresentation` etc. |
| Command Palette | CmdPal, `cmdpal` folder, GPO value `...CmdPal`; README says it is the next iteration of PowerToys Run and currently in preview |
| Command Not Found | `cmdNotFound` folder, GPO value `ConfigureEnabledUtilityCmdNotFound` |
| File Explorer add-ons | Power Preview, `previewpane` folder, module key `File Explorer` |
| Environment Variables | formerly "Environment Manager" (icon name) |
| Window Hopper | Alt Window Cycle |
| Auto Hide Cursor | CursorHide |
| Screen Ruler | MeasureTool |
| Text Extractor | PowerOCR |
| Quick Accent | PowerAccent |

## 7. Files in this set (part 1)

`advanced-paste.md`, `always-on-top.md`, `awake.md`, `color-picker.md`, `command-not-found.md`, `command-palette.md`, `crop-and-lock.md`, `environment-variables.md`, `fancyzones.md`, `file-explorer-add-ons.md`, `file-locksmith.md`.

## 8. What changed recently in the A to F set (0.102.2933.0 notes)

Advanced Paste gained a headless CLI. Awake lets the display turn off while locked. Color Picker moved to WinUI 3. Command Palette gained the quick-access shelf, a richer Dock, Copilot-key support and virtualized lists. Crop And Lock fixed capture alignment on scaled displays. Environment Variables added Remove duplicates in the PATH editor. FancyZones added opt-in mouse-wheel layout switching with a layout-name indicator. File Explorer add-ons fixed failures in restricted folders. The 0.103 roadmap in the README mentions a new Awake flyout, Screen Ruler improvements, and more WinUI 3 modernization.

## formtools note

Treat PowerToys as a catalogue of Windows-specific shell integrations; formtools should copy the runner plus per-module toggle plus policy-locked settings pattern, and replace every Win32 hook with a per-OS adapter behind a common module interface.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/
- https://learn.microsoft.com/en-us/windows/powertoys/install
- https://learn.microsoft.com/en-us/windows/powertoys/grouppolicy
- https://github.com/microsoft/PowerToys/releases (page 1) and https://github.com/microsoft/PowerToys/releases?page=2
- https://github.com/microsoft/PowerToys/releases/latest
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.3001
- Repo files read from a shallow clone of https://github.com/microsoft/PowerToys at commit bd745f4 (3 Nov 2026): `README.md`, `LICENSE`, `src/Version.props`, `doc/devdocs/core/architecture.md`, `doc/devdocs/core/runner.md`, `doc/devdocs/modules/interface.md`, `doc/devdocs/core/settings/readme.md`, `doc/devdocs/core/settings/gpo-integration.md`, `doc/gpo/README.md`, `doc/devdocs/modules/alt_window_cycle.md`, `src/gpo/assets/PowerToys.admx`, `src/gpo/assets/en-US/PowerToys.adml`, directory listing of `src/modules`.
