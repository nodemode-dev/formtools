# Mouse Without Borders

## What it does
Use one keyboard and mouse across up to four computers, with clipboard sharing and single-file transfer.

## Setup
1. On machine A open the module in Settings and choose New Key.
2. On machine B enter that key and machine A's name, then Connect.
3. Move the pointer past a screen edge to switch machines; drag device icons in the layout to set which edge leads where. Repeat for up to four machines.
A new key resets existing connections.

## Settings
- Connection: New key, Security key, Connect, local host name, Device layout, Refresh connections, Devices in a single row or 2x2 matrix.
- Service: Use Service (run under System account to control elevated apps and the lock screen; adds attack surface) and Uninstall Service.
- Mouse: Wrap mouse, Hide mouse at screen edge, Draw mouse cursor (for machines without a mouse), Move mouse relatively, Block mouse at screen corners.
- Clipboard and files: Share clipboard, Transfer file (100 MB limit), Show clipboard and network status messages.
- Network and security: Validate remote machine IP (reverse DNS), Same subnet only, Add a firewall rule, Block screen saver on other machines.
- Easy Mouse: edge switching, optionally requiring Shift or Ctrl; disable while a fullscreen app runs, with an ignore list of executables.
- Shortcuts (letters/defaults not listed in the page): toggle Easy Mouse (Ctrl+Alt+letter), lock all machines (pressed twice), reconnect, multiple-machine mode (input mirrored to all), switch machine (Ctrl+Alt+number, F1 to F4).
- Show the original UI (needs restart).
- Connection status colors: dark grey N/A, yellow Resolving, orange Connecting, blue Handshaking, red Error, purple ForceClosed, brown InvalidKey, pink Timeout, maroon SendError, green Connected.

## How it works
Devdocs mention TCP listeners on ports 15100 and 15101 (named only as readiness checks in tests, so roles not confirmed), a pairing key plus peer name, pipe IPC between Settings and the module, a machine matrix of up to four slots, and encryption/peer verification (details not documented). The docs do not specify the wire protocol or cipher. The module runs only in the active console session.

## Limitations
Clipboard and drag-drop: one file only, no folders (zip first), no network files; fullscreen RDP/VM windows may not receive keys; settings may not sync across machines; no support on locked or secure desktops in the devdoc pilot.

## Cross-platform note
Comparable open tools: Barrier, Input Leap, Synergy, Deskflow (cross-platform; license varies by project). macOS needs Accessibility and Input Monitoring; Wayland input capture/injection needs libei and portals. A key-based pairing over mDNS discovery plus TLS is the sensible design.

## formtools note
Large effort; consider integrating or interoperating with an existing open-source KVM project rather than reimplementing.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-without-borders
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/mousewithoutborders.md
