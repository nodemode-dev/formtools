# Mouse Button Lock

## What it does
Keeps a mouse button logically held after a press-and-hold so you can drag or select without holding it down.

## Activation
Off by default. Hold an enabled button still for the hold duration, release, move to drag, press any mouse button to release.

## Settings
- Enable; Lock left (off, conflicts with Windows ClickLock); Lock right (on); Lock middle (off).
- Hold duration 1200 ms (range 200 to 2200); Drag threshold 5 px (range 0 to 100; moving more cancels the lock).
- Releasing a locked right button suppresses the context menu.

## Limitations
May fail in games using raw or exclusive mouse input; not over the on-screen keyboard; not over elevated-app windows unless PowerToys is elevated.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.

macOS has Mouse Keys/Drag lock options under accessibility; Linux (X11 and some desktops) has similar accessibility toggles. Synthetic button-down events require input injection permissions (macOS Accessibility, uinput on Linux).

## formtools note
Small state machine (hold timer, drag threshold, synthetic button-down); share the injection layer with other input features.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/ (index)
- https://learn.microsoft.com/en-us/windows/powertoys/mouse-utilities (single source)
