# Overlay page hashout log

## v0.5.0 (builder F1)

Built the second Vite entry `overlay.html` and `src/overlay/`.

Decisions:
- The head carries only the color-scheme meta, an inline transparent html and body rule, fonts.css, tokens.css and overlay.css. No theme boot, so nothing paints before the screenshot canvas. A sampled first-frame run showed no white corner pixels.
- The screenshot loads through `createImageBitmap` with colour conversion and premultiplication off, is drawn once to a canvas whose backing store is the physical image size, and its pixels are read once into a typed array. Picker and ruler read that array, never the canvas.
- Scale is image width divided by `innerWidth` (and height by `innerHeight`), which wins over `params.scale` and `devicePixelRatio`; those two are only the fallback when the window reports zero.
- Every canvas redraw goes through one `frameLoop` (requestAnimationFrame, coalesced). Hint, readouts and chips are built once and patched with setText, setClass and style vars. The loupe, readouts and brush ring move with transform only.
- Tools: picker (loupe, arrows 1 px, Shift 10 px, Enter or click, Esc), ruler (keys 1 to 4, wheel adjusts tolerance by 5, arrows, click copies), text (drag, `desk.ocr`, delayed spinner, empty result keeps the overlay open with a hint), zoom (wheel, plus and minus, arrows, view follows the pointer, D to draw keeping the view), draw (keys 1 to 6 for tools, R G B Y O P 0 9 for colours, T text, W K boards, Ctrl+Z, E, Ctrl+C, bracket keys and Ctrl+wheel for width, Shift, Ctrl and Tab as shape modifiers), timer (Up and Down add or remove a minute, overtime counts up).
- Outside the desktop app a result is logged with the `[overlay]` console prefix and the overlay stays open.
- Draw keeps strokes in physical pixels on a committed layer; undo replays the list; Ctrl+C composes the screenshot or board with the ink at full resolution.

Open: `desk.copyImage` has no browser fallback, so Ctrl+C in a plain browser only logs the result.
