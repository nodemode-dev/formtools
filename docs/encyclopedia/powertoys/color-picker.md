# Color Picker

Snapshot: PowerToys 0.102.x. Part 1 (A to F).

## What it does

System-wide screen colour picker with a magnifier, a history of picked colours, an editor for fine tuning, and configurable copy formats.

## Activation

- Default shortcut: Win+Shift+C.
- Activation behaviour (setting): "Open editor" (shortcut opens the editor, from which you can pick) or "Pick a color first" (shortcut goes straight to the picker overlay; source default is pick first).
- While picking: scroll up to zoom into the area under the cursor (the zoomed image freezes, which helps with hover-only states); mouse buttons do configurable actions.

| Button | Default action |
|---|---|
| Left click | Pick, copy, save to history, open editor |
| Middle (wheel) click | Pick, copy, save to history, close |
| Right click | Close without copying |

Each button can be set to: pick then open editor, pick and close, or close.

## Formats (the list)

Sixteen named formats exist in the settings model (source), each with an editable format string. Default-visible in the editor: HEX, RGB, HSL (the rest are off until enabled). Default copy format: HEX.

| Format | Default template (from source) |
|---|---|
| HEX | `%Rex%Grx%Blx` (lowercase two-digit hex, no #) |
| RGB | `rgb(%Re, %Gr, %Bl)` |
| HSL | `hsl(%Hu, %Sl%, %Ll%)` |
| HSV | `hsv(%Hu, %Sb%, %Va%)` |
| CMYK | `cmyk(%Cy%, %Ma%, %Ye%, %Bk%)` |
| HSB | `hsb(%Hu, %Sb%, %Br%)` |
| HSI | `hsi(%Hu, %Si%, %In%)` |
| HWB | `hwb(%Hu, %Wh%, %Bn%)` |
| NCol (natural colour) | `%Hn, %Wh%, %Bn%` |
| CIEXYZ | `XYZ(%Xv, %Yv, %Zv)` |
| CIELAB | `CIELab(%Lc, %Ca, %Cb)` |
| Oklab | `oklab(%Lo, %Oa, %Ob)` |
| Oklch | `oklch(%Lo, %Oc, %Oh)` |
| VEC4 (float RGBA) | `(%Reff, %Grff, %Blff, 1f)` |
| Decimal | `%Dv` |
| HEX Int | `0xFF%ReX%GrX%BlX` |

The enum also has CIELCh, but it is not in the visible-format dictionary at this commit (single source: repo). Users can add unlimited custom formats (name plus template), reorder, disable and delete.

Template parameters documented on Learn: Re, Gr, Bl, Al (channels), Cy, Ma, Ye, Bk (CMYK), Hu (hue), Hn (natural hue), Si, Sl, Sb (saturation variants), Br, Va, In (brightness, value, intensity), Ll (HSL lightness), Lc (CIE lightness), Wh, Bn (whiteness, blackness), Ca, Cb (CIELAB chromaticity), Xv, Yv, Zv, Dv (decimal), Na (colour name). Formatters apply to R/G/B/A only: none or b (byte), h/H (hex, one digit, lower/upper), x/X (hex, two digits, lower/upper), f/F (float with or without leading zero). Source adds parameters not on Learn: Lo (Oklab lightness), Oa, Ob (Oklab a, b), Oc, Oh (Oklch chroma, hue) and Dr (decimal in R-G-B byte order, whereas Dv is in B-G-R order). The colour name is substituted separately and localised (a code comment says the old Na parameter was removed from the formatter).

## Editor

- History of up to 20 colours (source `colorhistorylimit` 20; Learn says 20). 0.102 keeps adjusted and similar-colour picks inside the limit, trimming oldest and keeping the selected colour first.
- Copy any history entry in any enabled format.
- Colour bar: choose the central colour to fine-tune with HSV, RGB or HEX controls; segments above and below give similar lighter or darker colours.
- Right click a colour to remove it or export (grouped by colour or by format).

## Other settings

- Show colour name (default off): adds a rough name such as "Light Green".
- Colour formats list management.
- Activation shortcut.
- A hidden `changecursor` property exists (default false) which is excluded from the command-line configure tool (single source: repo).

## How it works internally

Repo devdoc (possibly stale after the 0.102 WinUI 3 rewrite): pick the cursor position, make a 1x1 bitmap, copy that pixel from the screen with GDI+ `CopyFromScreen`, read the pixel. A global mouse hook handles clicks and a zoom view renders the magnifier. 0.102 moved the picking overlay, editor and magnifier to WinUI 3 while keeping the same workflows. Colour history is stored separately in `colorHistory.json`. The picker is a separate process launched by the module interface.

## Limitations

- Cannot draw on top of the Start menu or Action Center, though picking there still works.
- If the focused app is elevated, the shortcut fails unless PowerToys is elevated too.
- No Wide Color Gamut or HDR colour support.
- Inference from the pixel-read approach: values are 8-bit desktop pixels with no colour-profile conversion.

## Group Policy

`ConfigureEnabledUtilityColorPicker`.

## Cross-platform note
(analysis, not sourced) The macOS and Linux mapping below is the researchers' own analysis, not taken from PowerToys or Microsoft documentation.


(Analysis.) macOS: `NSColorSampler` gives a native magnifying picker that returns an `NSColor` (colour-space aware; convert to sRGB first). Linux X11: grab one pixel with `XGetImage` plus a self-drawn magnifier. Linux Wayland: use the xdg-desktop-portal Screenshot `PickColor` method, which hands back RGB doubles and avoids needing screen capture rights. Format templating, colour maths (HSL, HWB, Oklab, Oklch and so on) and history are pure logic and portable. Global shortcut registration differs per OS.

## formtools note

Port the template-parameter system (percent codes plus formatters) as-is, since users can add arbitrary formats, and add colour-space tagging on macOS and Wayland that PowerToys does not do.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/color-picker
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `doc/devdocs/modules/colorpicker.md`, `src/settings-ui/Settings.UI.Library/ColorPickerProperties.cs`, `src/settings-ui/Settings.UI.Library/Enumerations/ColorRepresentationType.cs`, `ColorPickerActivationAction.cs`, `ColorPickerClickAction.cs`, `src/common/ManagedCommon/ColorFormatHelper.cs`
