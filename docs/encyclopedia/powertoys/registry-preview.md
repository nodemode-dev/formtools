# Registry Preview (PowerToys)

## What it does
Visualizes and edits Windows Registry export (.reg) files before they are applied. Shows file text beside a tree of keys; selecting a key shows its values. Optionally writes the file into the registry.

## Activation
No hotkey. In File Explorer, select one or more .reg files, right-click, choose Preview (on Windows 11, under "Show more options" first). Also launchable from PowerToys Settings.

## Settings and options
- Setting: make Registry Preview the default app for .reg files (default off). This is the only documented setting.
- In-app controls: tree node selection (values below), Edit (opens Notepad), Reload (re-reads after external change), Write to registry (Registry Editor confirms first), Open key (jumps Registry Editor to selected key).

## How it works
Built with WinUI 3 and embeds the Monaco web editor in a WebView for syntax highlighting and line numbers. A parser (ParseRegistryFile) reads the text and builds tree nodes (AddTextToTree); the tree refreshes as editor text changes. Nothing touches the registry until Write to registry is used.

## Limitations
- Files over 10 MB cannot open.
- Invalid content shows a message.
- Docs do not cover CLI args, undo after write, elevation needs, or non-.reg types. No UI automation tests exist per dev docs.
- Release notes fetched did not mention it for 0.102.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

No registry on macOS or Linux, so the .reg semantics are Windows-only. The transferable idea is a safe preview-then-apply viewer for config formats: plist (macOS defaults) and dconf/gsettings keyfiles (Linux), with tree view, diff and explicit apply.

formtools note: Generalize into a "config file previewer" (plist, dconf, .reg import as read-only) with an explicit apply step; skip registry writing.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/registry-preview
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/registrypreview.md
- https://github.com/microsoft/PowerToys/releases
