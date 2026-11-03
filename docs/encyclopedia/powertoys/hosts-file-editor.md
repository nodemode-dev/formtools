# Hosts File Editor

## What it does
A GUI editor for the system hosts file (name to IP overrides consulted before DNS). Typical use: test a site on a new server before DNS changes propagate.

## Activation
No keyboard shortcut. Launched from the PowerToys tray icon or the Settings page. Must be enabled in Settings.

## Operations
- New entry: IP address, host name(s), optional comment, Active toggle.
- Filter by address, hosts or comment.
- Automatic backup before the first save of a session, named hosts_PowerToysBackup_ plus a timestamp (YYYYMMDDHHMMSS), default folder is the drivers\etc folder.

## Settings
- Open as administrator (default on): without elevation the editor is read-only and saving fails.
- Show a warning at startup (default on).
- Placement of additional content: Top (default, after the stock header comments) or Bottom; matters for precedence in conflicts.
- Consider loopback addresses as duplicates (blocks several 127.0.0.1 or ::1 entries for one host).
- No leading spaces on active lines (default off).
- Encoding: UTF-8 (default) or UTF-8 with BOM.
- Backups: on/off, location, automatic deletion mode (Never, Based on count, Based on age and count), count, and days. Default retention described as 15 days while always keeping the 5 newest.

## How it works
Reads and rewrites the plain-text hosts file, applying placement, whitespace and encoding rules, then enforces backup retention (single source, docs only).

## Limitations
Needs admin rights to save; edits are system-wide; no shortcut.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS and Linux both use /etc/hosts (same format), writing needs root: use a privileged helper (polkit on Linux, authorization services or a helper tool on macOS). Flush DNS cache differs per OS (dscacheutil/mDNSResponder on macOS, systemd-resolved or nscd on Linux).

## formtools note
Easy cross-platform win: parse/edit /etc/hosts with timestamped backups and an elevated-save helper.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/hosts-file-editor (single source)
