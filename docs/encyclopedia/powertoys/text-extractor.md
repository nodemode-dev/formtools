# Text Extractor (PowerToys)

## What it does
Copies text from anywhere on screen, including images and video frames, via OCR. Based on Joe Finney's Text Grab. Internal module name PowerOCR.

## Activation
Win+Shift+T (customizable). A screen overlay appears; press and drag to select a region; recognized text goes to the clipboard and the overlay closes. Holding Shift while dragging switches from resizing to moving the region. Esc cancels.

## Settings
Only two documented: Activation shortcut and Preferred language. The default language follows the Windows system language and keyboard settings.

## OCR engine and languages
The docs never name the engine, but their PowerShell snippets use the Windows.Media.Ocr.OcrEngine API, so it is the built-in Windows OCR (inference; the dev doc does say OCR runs on the selected region after a language is chosen). Only languages with an installed OCR capability pack work. List them with AvailableRecognizerLanguages (Windows PowerShell, not PowerShell 7) or Get-WindowsCapability filtered on Language.OCR (admin); install with Add-WindowsCapability. Error "No OCR languages are installed" can occur when the system drive is not C: (docs suggest copying the Windows\OCR folder to C:).

## How it works (dev docs)
EventMonitor listens for a shared named event to start the flow; an overlay offers a language selector and selection canvas; the screen is captured with CopyFromScreen and used as overlay background; a setting can spread the overlay across all monitors. Dev doc says WPF, but release notes say the module moved to WinUI 3 in 0.102.2933, so the dev doc may be stale.

## Limitations
- Imperfect accuracy; proofread.
- Quality depends on installed language packs.
- No documented table or multi-line modes; no version or multi-monitor detail on the learn page.

## Cross-platform note
macOS: Vision framework (VNRecognizeTextRequest) gives on-device OCR, plus Live Text. Linux: Tesseract (traineddata per language) or PaddleOCR; Wayland capture goes through the portal. Region selection overlay is the same pattern as Screen Ruler and ZoomIt snip.

formtools note: Define an OCR provider trait (Vision, Windows OCR, Tesseract) behind one capture-region-to-clipboard flow, with a language selector listing installed packs.

## Sources
- https://learn.microsoft.com/en-us/windows/powertoys/text-extractor
- https://raw.githubusercontent.com/microsoft/PowerToys/main/doc/devdocs/modules/textextractor.md
- https://github.com/microsoft/PowerToys/releases
