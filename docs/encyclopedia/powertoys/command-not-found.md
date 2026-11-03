# Command Not Found

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

A PowerShell 7 module that, when you type a command that does not exist, suggests the WinGet package that provides it, for example a `winget install -e --id <Package.Id>` line.

## Activation

None. Install it once from its Settings page ("Install"), restart PowerShell, then it triggers on every failed command lookup.

## Requirements

- PowerShell 7 (the check script in the repo requires 7.4 or newer; Learn only says PowerShell 7).
- `Microsoft.WinGet.Client` PowerShell module (the enable script wants version 1.8.1133 or later and prints a warning if older or missing).
- `Microsoft.WinGet.CommandNotFound` module, which the enable script installs from the PowerShell Gallery if absent. Learn does not name this one; the repo devdoc and script do (discrepancy between sources).

## Settings

Only **Install** and **Uninstall** buttons on the module page, plus the usual enable toggle. No other options.

## What Install does

1. Enables two PowerShell 7 experimental features: `PSFeedbackProvider` and `PSCommandNotFoundSuggestion`.
2. Installs the CommandNotFound module if needed.
3. Creates your PowerShell profile if none exists, then appends a block, delimited by a fixed GUID marker comment, that runs `Import-Module` on `WinGetCommandNotFound.psd1` from the PowerToys install folder. Uninstall removes the block by finding the markers. An `UpgradeModule.ps1` script also exists for updates.

## How it works internally

PowerShell calls feedback providers when a command is not found; the WinGet module registers one that looks up the missing name in the WinGet catalogue and prints an install suggestion. Provider code lives in a separate repo (`microsoft/winget-command-not-found`). PowerToys contributes only the scripts and the settings shell (a small C++ module interface plus PowerShell scripts: Check requirements, Enable, Disable, Upgrade, InstallPowerShell7, InstallWinGetClientModule).

## Limitations

- Does not work in sessions that were open before install.
- PowerShell 7 only (not Windows PowerShell 5.1).
- Depends on experimental PowerShell features that may change.
- Known incompatibilities with some PowerShell configurations (issue #30818).
- Suggestions only cover WinGet packages.

## Group Policy

`ConfigureEnabledUtilityCmdNotFound`.

## Cross-platform note

(Analysis.) This idea already exists natively elsewhere: bash and zsh call `command_not_found_handle` / `command_not_found_handler`, which Debian/Ubuntu (`command-not-found`, PackageKit), Fedora, Arch (`pkgfile`) and Homebrew (`brew command-not-found-init`) hook. formtools could ship a shell-integration installer that appends a marked block to `~/.zshrc`, `~/.bashrc` or `config.fish`, with the same marker-based clean uninstall, and a lookup against the platform package manager.

## formtools note

Low priority as a feature, but the marker-delimited, reversible profile edit is a pattern worth copying for any shell integration formtools installs.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/cmd-not-found
- https://learn.microsoft.com/en-us/windows/powertoys/grouppolicy
- Repo (commit bd745f4): `doc/devdocs/modules/commandnotfound.md`, `src/settings-ui/Settings.UI/Assets/Settings/Scripts/EnableModule.ps1`, `.../CheckCmdNotFoundRequirements.ps1`, listing of `src/modules/cmdNotFound`, `src/gpo/assets/PowerToys.admx`
