# Advanced Paste

Snapshot: PowerToys 0.102.x (Nov 2026). Part 1 (A to F).

## What it does

Takes whatever is on the clipboard (text, HTML, an image, a copied file) and pastes it in another form: plain text, Markdown, JSON, a file, OCR text, a transcoded media file, or the output of an AI prompt. Non-AI actions run locally. AI is opt-in and off by default.

## Activation

| Action | Default shortcut |
|---|---|
| Open the Advanced Paste window | Win+Shift+V |
| Paste as plain text directly | Ctrl+Win+Alt+V |
| Paste as Markdown directly | unset |
| Paste as JSON directly | unset |
| Every other action (image to text, fix spelling, file pastes, transcodes, each custom action) | optional per-action shortcut, unset |

Binding plain Ctrl+V as the window shortcut is allowed but the docs advise against it. Defaults confirmed in `AdvancedPasteProperties.cs`.

## Actions and options

Text:
- Plain text: strips all formatting.
- JSON: converts XML, CSV or INI to JSON; existing JSON passes through; other text becomes an array of lines (CLI description).
- Markdown: converts rich or HTML text to Markdown; plain text passes through.
- Paste as .txt file and Paste as .html file: write the clipboard to an auto-named file when the target accepts files (for example File Explorer).

Image:
- Image to text: local Windows OCR, no AI provider needed.
- Paste as .png file: converts a bitmap on the clipboard to a PNG file.

Audio and video (runs locally via Windows media transcoding APIs; keeps dimensions, bitrate and container metadata where possible; cancel button; progress ring):
- Transcode to .mp3 (works on audio or video, extracts audio).
- Transcode to .mp4 (H.264 video, AAC audio if present).

AI (requires Paste with AI enabled and a provider):
- Free-form prompt box in the window (can be hidden).
- Fix spelling and grammar (built-in), with optional Coaching mode that previews an explanation of the corrections; each has its own optional shortcut, model, prompt and system prompt.
- Custom actions: saved prompts with name, description, prompt, optional model override, optional shortcut, and a flag for showing in the window.
- Advanced scenarios chain actions (for example image to text, then translate, then save as .txt) using Semantic Kernel; documented as OpenAI-only.

## Settings

| Group | Setting | Default / note |
|---|---|---|
| Paste with AI | Enable Paste with AI | Off |
| | Model providers: add, edit, remove, set default | none configured |
| | Show the AI paste input box | On |
| Behaviour | Window shortcut | Win+Shift+V |
| | Show a preview of the current clipboard content | On |
| | Access clipboard history in the window | option |
| | Close the window automatically when it loses focus | Off |
| | Custom format preview (AI formats and Image to text) | On |
| | Use selected text for all hotkeys (tries to copy the current selection first, falls back to clipboard) | Off |
| Actions | One toggle and optional shortcut per built-in action (plain text, Markdown, JSON, image to text, fix spelling and grammar, coaching, paste as .txt/.png/.html, transcode mp3/mp4) | see above |
| Custom actions | Add/edit/delete, per-action model | needs AI |

Supported providers per Learn: OpenAI, Azure OpenAI, Mistral, Google, Azure AI Inference (online, need keys, may bill), plus local Foundry Local, Ollama, and Phi Silica (needs a Copilot+ PC NPU). Provider fields vary: model name, endpoint URL, API key, deployment name, API version, system prompt. API keys are kept in the Windows credential vault (CLI documentation mentions credential-vault entries).

Discrepancy worth knowing: the Group Policy ADMX in the repo defines `AllowAdvancedPasteAnthropic` (a Claude endpoint policy) and a policy per provider, but the `AIServiceType` enum in the settings library at this commit has no Anthropic member and Learn does not list it. Treat Anthropic as planned or partially landed (single source: repo).

## Command line (new in 0.102)

`PowerToys.AdvancedPaste.CLI.exe` (on `PATH`): headless, no UI, no runner connection.
- Commands: `transform`, `actions list`, `providers list`. Global `--json`, `--help`.
- `transform` picks `--action <built-in>` or `--custom-action <id-or-name>`, optional `--prompt`, `--provider <id>`.
- Built-in action ids: plain-text, markdown, json, fix-spelling-and-grammar, image-to-text, paste-as-txt-file, paste-as-png-file, paste-as-html-file, transcode-to-mp3, transcode-to-mp4, paste-with-ai.
- Input (one of): `--input <path>`, `--stdin`, `--clipboard` (default). Output (one of): `--output <path>`, `--stdout`, `--output-clipboard` (default). File-generating actions cannot go to stdout.
- Text input cap 16,777,216 characters. Exit codes 0 success, 1 runtime or provider failure, 2 invalid arguments. Clipboard modes need an interactive session. It honours the same Group Policies; raw input and output are never logged (repo devdoc).

## Group Policy

`ConfigureEnabledUtilityAdvancedPaste` (enabled state) and `AllowPowerToysAdvancedPasteOnlineAIModels` (since 0.81.1; when disabled users cannot enable Paste with AI or configure a key; restart needed). The ADMX also carries per-provider allow policies.

## How it works internally

Not documented in detail (the repo devdoc has a TODO for implementation). Known: a shared action engine used by both the UI and the CLI; settings, policy, credential vault, provider layer, OCR and transcoding are shared; the UI is a separate WinUI process launched by the runner; AI orchestration via Semantic Kernel for the chained scenarios.

## Limitations

- Semantic Kernel chaining is OpenAI only.
- Phi Silica needs specific hardware; Foundry Local and Ollama need their apps installed.
- Online providers need credit and send clipboard content off-device; Learn tells users to review output and provider terms.
- Progress ring only for transcoding.
- Ctrl+V as activation is discouraged.

## Cross-platform note

(Analysis, not from PowerToys sources.) macOS: read `NSPasteboard` types (RTF, HTML, file URLs, images), convert with Foundation and a Markdown library, OCR through the Vision framework, transcode through AVFoundation; a global hotkey needs Carbon `RegisterEventHotKey` or an event tap, and "paste into the target app" needs Accessibility permission to synthesize Cmd+V. Linux: X11 selections with multiple targets (`text/html`, `image/png`, `text/uri-list`) and Wayland `wl-clipboard`; OCR via Tesseract; transcode via ffmpeg; Wayland blocks synthesized paste keystrokes, so fall back to copy-then-notify or use a portal/compositor-specific path. The AI provider layer (OpenAI-compatible HTTP plus local Ollama) is fully portable.

## formtools note

Build the clipboard-transform engine as a platform-neutral library with a CLI front end first (like the PowerToys CLI), and put the pasting and hotkey layer behind a per-OS adapter.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/advanced-paste
- https://learn.microsoft.com/en-us/windows/powertoys/grouppolicy
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (shallow clone, commit bd745f4): `doc/devdocs/modules/advancedpaste.md`, `src/settings-ui/Settings.UI.Library/AdvancedPasteProperties.cs`, `src/settings-ui/Settings.UI.Library/AIServiceType.cs`, `src/gpo/assets/en-US/PowerToys.adml`
