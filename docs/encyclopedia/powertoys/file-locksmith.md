# File Locksmith

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

Shows which processes hold open handles on selected files or folders, and lets you end them. A shell extension plus a small WinUI window, with a CLI added recently.

## Activation

Enable it in PowerToys, select files or folders in File Explorer, right click, and choose "Unlock with File Locksmith" (on Windows 11 this sits under "Show more options" unless the modern menu entry applies). Selecting a folder scans everything inside it. No hotkey.

## Behaviour

- On open it scans the processes it can access and lists the ones using the selected paths, with icon and details; expand a row for more.
- "End task" kills a process; ended processes disappear from the list; "Reload" rescans.
- Processes belonging to other users or the system only appear when you choose "Restart as administrator".
- Warning visuals for system processes exist in the UI (converter in source).

## Settings

- Enable File Locksmith (module toggle).
- Source also exposes "show only in extended context menu" (`bool_show_extended_menu`, default false), meaning the entry appears only on Shift-right-click when enabled (single source: repo; not on the Learn page).

## Command line (new)

`PowerToys.FileLocksmith.CLI.exe <path>...` on `PATH`. Options: `--kill` (terminate all lockers), `--json`, `--wait` (block until released), `--timeout <ms>` (with `--wait`; exit code 1 if still locked), `--help`. Works from any terminal folder as of 0.102.

## How it works internally

Repo devdoc: two shell extensions (a classic COM `FileLocksmithExt` for Windows 10 and below, registered through the registry, and `FileLocksmithContextMenu` registered through a sparse MSIX package for the Windows 11 menu), a library for file-based IPC (the extension writes the selected paths to a temp file, then launches `PowerToys.FileLocksmithUI.exe`, which reads them), an interop library that walks system handles using undocumented NT calls (`NtQuerySystemInformation` through `NtdllExtensions`) to map process ids to files, and the WinUI 3 MVVM UI. Same architecture family as Image Resizer and New+. The 0.102.1 hotfix (v0.102.3001) fixed crashes when the handle scan stalls, and 0.102 stopped the context-menu host process lingering during updates and uninstalls.

## Limitations

- Visibility limited to processes you can open unless elevated.
- Directory scans can be slow.
- It lists lockers by handle, so it cannot explain why a process re-opens a file after being ended; auto-restarting processes are not handled (not documented).

## Group Policy

`ConfigureEnabledUtilityFileLocksmith`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) Linux: scan `/proc/*/fd` (and `/proc/*/maps`) or call `fuser` or `lsof`; seeing other users' processes requires root. macOS: `lsof` or libproc (`proc_pidinfo` with `PROC_PIDLISTFDS`, `proc_pidfdinfo`), also limited to your own processes without root. Neither platform has mandatory file locking like Windows, so "locked" usually means "open"; advisory locks (`flock`, `fcntl`) can also be reported. Context-menu integration: macOS Finder Sync or Quick Actions; Linux Nautilus extensions, Dolphin service menus, Thunar custom actions. A CLI with `--json`, `--wait` and `--kill` ports almost one to one.

## formtools note

Build the scanner as a CLI first (`--json`, `--wait`, `--kill`) with per-OS probes, then wrap it with file-manager integrations; remember that elevated scanning needs a clear prompt on each OS.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/file-locksmith
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.3001
- Repo (commit bd745f4): `doc/devdocs/modules/filelocksmith.md`, `src/settings-ui/Settings.UI.Library/FileLocksmithProperties.cs`
