# Awake

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

Keeps the PC (and optionally the screen) awake without touching the Windows power plan. When Awake exits, normal power behaviour returns.

## Activation

No hotkey. Controlled from the Settings page, the tray icon (right click), or the command line `PowerToys.Awake.exe`.

## Modes

| Mode | settings.json `mode` | Behaviour | CLI |
|---|---|---|---|
| Keep using the selected power plan (passive) | 0 | Awake holds nothing | n/a |
| Keep awake indefinitely | 1 | until you stop it | no arguments |
| Keep awake for a time interval | 2 | hours and minutes, then returns to passive | `--time-limit <seconds>` |
| Keep awake until expiration | 3 | until a date and time | `--expire-at <time>` |

Editing hours or minutes while a timer runs restarts the timer. Source defaults: mode passive, keep display on false, interval 0 h 1 min, expiration now.

## Settings

- Enable Awake (module toggle).
- Mode (above) with interval or expiration fields.
- Keep screen on (`keepDisplayOn`, default off): only meaningful when a non-passive mode is active; does not stop manual sleep or hibernate.
- Tray shortcuts: `customTrayTimes` dictionary (label to seconds) in the Awake `settings.json` under `%LocalAppData%\Microsoft\PowerToys\Awake\`; the tray shows these as quick "keep awake for" entries. The docs present it as a file-level setting, with no UI editor mentioned.
- Tray icon states: passive, timed, expirable, indefinite (four icons).
- Lock screen: since 0.102, when the workstation locks Awake stops requesting the display to stay on so Windows can turn the screen off, while the system stays awake; it resumes on unlock and detects an already-locked state at start.

## Command line

`--use-pt-config` (read PowerToys settings.json, ignore every other argument, watch the file for changes), `--display-on[=true|false]`, `--time-limit`, `--expire-at` (time like 17:00:00 or full date-time), `--pid <id>` and `--use-parent-pid` (exit when that process ends). No arguments means indefinite. Short flags exist (`-c`, `-d`, `-t` per repo README).

## How it works internally

Calls the Win32 `SetThreadExecutionState` API from background threads: system-required, display-required and continuous flags. Resetting the state ends the request. Code layout: a WinExe app with CLI, a module-services layer and a native module bridge. Active only while the user is signed in.

## Limitations

- It overrides power-plan choices, so it is meant for attended use; for unattended machines Microsoft advises configuring the power plan and locking the PC.
- Keep screen on does not hold while locked.
- Timer edits reset the clock.
- The 0.103 roadmap mentions a new Awake flyout (README).

## Group Policy

`ConfigureEnabledUtilityAwake`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) macOS: `IOPMAssertionCreateWithName` (PreventUserIdleSystemSleep, PreventUserIdleDisplaySleep) or spawn `caffeinate -d -t N`. Linux: D-Bus `org.freedesktop.login1.Inhibit` for idle/sleep and `org.freedesktop.ScreenSaver.Inhibit` or the Wayland idle-inhibit protocol or portal Inhibit for the display; `systemd-inhibit` as a fallback. The mode, timer and expiry logic is portable; only the final "hold" call differs. Tray with timed entries maps to a menu bar item (macOS) or StatusNotifier icon (Linux).

## formtools note

Implement one `KeepAwake` trait with per-OS inhibitors, a four-state mode model and a CLI that can read the shared settings file, copying the `--pid` self-terminating pattern for script use.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/awake
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `src/modules/awake/README.md`, `doc/devdocs/modules/awake.md`, `src/settings-ui/Settings.UI.Library/AwakeProperties.cs`, `src/modules/awake/Awake/Core/Manager.cs`
