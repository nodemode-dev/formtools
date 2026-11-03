# Environment Variables

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

A friendlier editor for Windows User and System environment variables, with **profiles**: named groups of variables you can switch on and off together (for example one toolchain per project).

## Activation

Opened from the PowerToys Settings page (launch button). No default hotkey. By default it launches elevated so System variables are editable.

## Features and behaviour

- Two lists you can edit: User variables and System variables; plus an **Applied variables** view showing the effective environment with the evaluated Path on top.
- Precedence in the applied view: profile > User > System.
- Profiles: create with a name, optional enabled-on-create toggle, add new variables or pull in existing User/System ones, save. Only **one profile can be applied at a time**.
- Applying a profile writes its variables into the User variables. If a User variable of the same name exists, a backup variable is created and restored on un-apply. Backup naming pattern in the repo devdoc: `VARIABLE_NAME_PowerToys_PROFILE_NAME`.
- Edit or delete any variable or profile via the "more" menu.
- PATH editing: per-entry editing and **Remove duplicates** (new in 0.102). Duplicates ignore letter case, slash direction, trailing separators and `%VAR%` references that expand to the same folder; the first occurrence is kept with its original spelling and order is preserved.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Open as administrator | On (source `LaunchAdministrator = true`) | Off means only profile and User variables are editable |

## How it works internally

Repo devdoc: three projects (app and main window, module interface and packaging, shared UI library). Variables are read from and written directly to the registry (`HKCU\Environment` and the System environment key) instead of through the Environment API, for two reasons the devdoc gives: the API expands variables automatically (losing `%VAR%` references and registry value kinds) and broadcasting setting-change notifications can block for about a second (a no-notify write function exists). Profiles are stored as JSON in the module's settings folder (`profiles.json`, per the UI test notes). The UI is WinUI 3.

## Limitations

- One active profile.
- System edits need elevation.
- Changes written to the registry reach new processes only; running programs keep their old environment (standard Windows behaviour, inference).
- No hotkeys, no CLI documented.
- A UI test suite warns it temporarily replaces the user PATH, which shows how sensitive PATH edits are.

## Group Policy

`ConfigureEnabledUtilityEnvironmentVariables`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) There is no registry on macOS or Linux; "persistent User variables" become shell startup files (`~/.zprofile`, `~/.zshenv`, `~/.profile`, `~/.config/fish/conf.d`), `systemd --user` `environment.d` fragments (Linux GUI sessions), and `launchctl setenv` or a LaunchAgent (macOS GUI apps), while "System variables" map to `/etc/environment`, `/etc/paths` and `/etc/paths.d` needing root. A profile can become a sourced snippet file that formtools injects between marker comments. A cleaner cross-platform angle is a direnv-like per-folder profile, which PowerToys lacks.

## formtools note

Model profiles as ordered variable sets with backup-and-restore semantics and a PATH deduplicator; the writer backend per OS (shell snippet, systemd environment.d, launchctl) is the real work.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/environment-variables
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `doc/devdocs/modules/environmentvariables.md`, `src/settings-ui/Settings.UI.Library/EnvironmentVariablesProperties.cs`
