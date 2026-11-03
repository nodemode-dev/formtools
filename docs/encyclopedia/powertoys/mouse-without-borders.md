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
- Shortcuts: the Learn page says toggle Easy Mouse, lock all machines (pressed twice) and reconnect are Ctrl+Alt+letter, with multiple-machine mode (input mirrored to all) and switch machine (Ctrl+Alt+number, F1 to F4). Defaults in source (MouseWithoutBordersProperties.cs): toggle Easy Mouse E, lock machines L, reconnect R, multiple-machine mode unset, switch machine base key F1. The source default constructor sets Win, Ctrl and Alt flags together for E, L and R, which differs from the docs' Ctrl+Alt wording; which one the hook enforces at runtime was not tested.
- Show the original UI (needs restart).
- Connection status colors: dark grey N/A, yellow Resolving, orange Connecting, blue Handshaking, red Error, purple ForceClosed, brown InvalidKey, pink Timeout, maroon SendError, green Connected.

## How it works
Ports (from source): the default TCPPort setting is 15100. The module opens a clipboard server on that port and a message (input and control) server on port + 1, so 15100 carries clipboard and file data and 15101 carries messages (SocketStuff.cs, MouseWithoutBordersProperties.cs). The port is a setting, so it can change. Encryption (Core/Encryption.cs): AES-256 in CBC mode with zero padding, key derived from the shared security key with PBKDF2 (SHA-512, 100,000 iterations) and a random salt. The Learn pages and devdocs do not state the protocol or cipher. Also: a pairing key plus peer name, pipe IPC between Settings and the module, and a machine matrix of up to four slots. The module runs only in the active console session.

## Limitations
Clipboard and drag-drop: one file only, no folders (zip first), no network files; fullscreen RDP/VM windows may not receive keys; settings may not sync across machines; no support on locked or secure desktops in the devdoc pilot.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

Comparable open tools: Barrier, Input Leap, Synergy, Deskflow (cross-platform; license varies by project). macOS needs Accessibility and Input Monitoring; Wayland input capture/injection needs libei and portals. A key-based pairing over mDNS discovery plus TLS is the sensible design.

## formtools note
Large effort; consider integrating or interoperating with an existing open-source KVM project rather than reimplementing.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-without-borders
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/mousewithoutborders.md
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/MouseWithoutBorders/App/Class/SocketStuff.cs
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/modules/MouseWithoutBorders/App/Core/Encryption.cs
- https://raw.githubusercontent.com/microsoft/PowerToys/main/src/settings-ui/Settings.UI.Library/MouseWithoutBordersProperties.cs
