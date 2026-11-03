# Preview: Markup toolbar

Same toolset appears in Preview, Quick Look, Finder Markup quick action, Mail, Notes, TextEdit and Photos. Preview parity with Quick Look is not spelled out by Apple.

## Selection tools
- Rectangular, Elliptical, Lasso: choose regions to copy or delete.
- Smart Lasso: edge-snapping outline.
- Instant Alpha: color-range selection, Delete to make transparent.
- Text Selection (PDF): select text.
- Redaction Selection (PDF): hides chosen text; adjustable while editing, permanent once the document is closed. TOC entries pointing at redacted text are not removed.

formtools note: redaction must truly remove underlying text and flatten, not draw a black box.

## Drawing
- Sketch: one stroke, recognized shapes replace the drawing; palette lets you keep the raw stroke.
- Draw: freehand, pressure sensitive on Force Touch trackpads only.

formtools note: shape recognition for sketch is optional polish; pressure input should map to stylus pressure where available.

## Shapes menu
- Standard shapes with blue resize handles and green shape-parameter handles (e.g. arrow curvature, star points).
- Highlight shape (rectangular overlay).
- Loupe/Zoom: lens with green handle for magnification and blue for size; loupes can be stacked.

formtools note: handle model (resize vs shape parameter) is a good reusable convention.

## Text, note, sign
- Text box: type then drag. Text Style sets font, style, color.
- Note (PDF): sticky note, recolor with Control-click, listed under View > Highlights and Notes.
- Speech Bubble: Tools > Annotate > Speech Bubble (PDF).
- Highlight Selection: tinted highlight, underline, strikethrough via the arrow menu; "highlight mode" keeps applying the style to each new selection. Remove with Control-click.
- Sign: signatures created via trackpad, built-in camera (paper signature), or iPhone/iPad (finger or Apple Pencil). Stored with Markup, synced through iCloud Drive across Macs; delete via the X on hover. Optional VoiceOver description per signature (e.g. "Initials").
- Form Fill: type in fields; Text Box tool as fallback; AutoFill from Contacts "My Card".

formtools note: store signatures locally as transparent PNG/vector strokes; skip iCloud sync, but allow import from image and webcam.

## Style controls
- Shape Style (line thickness/type, shadow), Border Color, Fill Color, Text Style.
- Image Description: accessibility text for VoiceOver (VO-Shift-L reads it).
- Rotate Left/Right (Option for right), Crop, Adjust Color, Adjust Size on the same bar.

## Continuity Markup
Annotate button sketches from a nearby iPhone or iPad (Apple Pencil supported). Requires Wi-Fi, Bluetooth, and Continuity.

formtools note: Apple ecosystem only; no cross-platform equivalent planned.

## Editability rules
- PDF: annotations stay editable after Save/Export/Export as PDF; Print > Save as PDF flattens them.
- Image files: markup is baked on save (convert to PDF first to keep editable).
- Quick Look/Finder markup: cannot be undone after Done.
- Annotation author name is stamped from Preview settings.

## Sources
- https://support.apple.com/guide/preview/annotate-an-image-prvw1501/mac
- https://support.apple.com/guide/preview/annotate-a-pdf-prvw11580/mac
- https://support.apple.com/guide/mac-help/mark-up-files-mchl1fd88863/mac
- https://support.apple.com/guide/preview/fill-out-and-sign-pdf-forms-prvw35725/mac
- https://support.apple.com/guide/preview/highlight-underline-and-strike-out-text-prvw757d4d5b/mac
- https://support.apple.com/guide/preview/add-notes-and-speech-bubbles-to-a-pdf-prvw7450efd7/mac
