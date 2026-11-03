# Power Display

## What it does
One flyout for external monitor control over DDC/CI: brightness, contrast, volume, input source, rotation, color temperature, power state, plus profiles and a CLI.

## Activation
User-set activation shortcut (default not stated) or Open Power Display in Settings; Esc closes.

## Controls and behavior
- Mouse-wheel on sliders; sliders debounce writes and rescale non-0-100 ranges.
- Linked brightness when two or more monitors support it; individual monitors can be excluded; applying a profile turns linking off.
- Tray icon wheel: Off (default), Primary, All.
- Risky controls off by default with confirmation: color temperature, power state, input source.
- Rescan on wake; monitor exclusion list for known-bad displays; if a crash is detected (malformed capability strings can trigger a Windows kernel bug), the module disables itself on next launch and excludes the monitor.
- Max compatibility mode probes all VCP features regardless of capabilities (can blank or hang a monitor).
- Profiles (brightness, contrast, volume, color temp for several monitors), reorder by drag or menu, restore on launch.
- Light Switch integration: one profile for dark, one for light.
- Custom VCP name mappings for color temperature and input sources, per monitor or global; VCP capabilities card.

## Settings
Enable (confirmation first time); Activation shortcut; Monitor refresh delay; Tray icon mouse wheel; Mouse wheel increment (default 5; 1,2,5,10,15,20,25); Max compatibility mode; Restore brightness and color temperature on launch; Show system tray icon; Show profile switcher; Show identify monitors button; Profiles; Custom VCP mappings; per-monitor toggles including Hide monitor.

## CLI
PowerToys.PowerDisplay.CLI.exe: list, capabilities, get, set, up/down (with --step), profiles, apply-profile. -n 1-based monitor numbers, -i stable ID (wins if both). JSON lines with --json, --quiet. Discrete values as hex from capabilities. Power-off requires --confirm-power-off. Needs PowerToys running.

## How it works
DDC/CI with VCP codes (for example 0x14 color temperature, 0x60 input source), capabilities read at startup; built-in panels handled separately and not probed. Page does not mention WMI (single source).

## Limitations
Hardware variability; input switching can lose software control; admin mode disables drag reorder.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

DDC/CI: ddcutil (Linux, i2c-dev access), m1ddc/MonitorControl style on macOS (Apple Silicon needs private APIs; built-in panel uses DisplayServices). Linux laptops use backlight sysfs. Windows-style risk warnings apply everywhere.

## formtools note
Use a DDC/CI abstraction with capability-driven UI, debounced writes and a monitor exclusion list; keep risky controls opt-in.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/power-display (single source)
