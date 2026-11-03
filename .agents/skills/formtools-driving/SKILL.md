---
name: formtools-driving
description: Use formtools, the media and file utility belt, through its MCP tools (list_commands, describe_command, run_command, fs_list, image_info). Use whenever the person wants to browse a folder, read a picture's size, format, colour profile, EXIF or GPS data, or run a formtools command on files, and formtools tools are available or formtools is mentioned. Explains how to start the server, the tool loop and the limits. Not for changing formtools' own source code (use formtools-harness).
---

# formtools-driving

formtools runs on this computer as an engine with a window. Its MCP server, named `formtools`, is started by `./formtools mcp` (a stdio bridge to the engine's `/mcp` on 127.0.0.1:8240). If the engine is not running the bridge starts it. `./formtools mcp --where` prints the address and the config for a client.

## Tools

| Tool | Use it to |
| --- | --- |
| `fs_list` | list a folder: name, path, kind, extension, size, modified time and file type, folders first |
| `image_info` | read a picture: width, height, format, colour mode, frames, alpha, ICC profile, bit depth, EXIF and GPS |
| `list_commands` | see the command catalogue; narrow it with a group or text |
| `describe_command` | read one command's parameters before running it |
| `run_command` | run one command by id with its parameters |

## The loop

1. Use absolute local paths. Expand `~` yourself.
2. `fs_list` the folder to see what is there. Do not guess file names.
3. `image_info` on a file before acting on it: check the format, size and whether it has an alpha channel or an unusual profile.
4. `list_commands`, then `describe_command`, then `run_command`. Never run a command whose parameters you have not read.
5. Report what the tool returned. If a call returns `{"ok": false, "error": ...}`, say the sentence plainly and stop or change course; do not retry the same call.

## Limits

- Only the five tools above exist; anything else the person asks for may be a command in the catalogue, so look before saying it cannot be done.
- Formats the window cannot show (RAW, PSD, EXR, HDR, TIFF) are handled by the engine; `image_info` still works on them.
- Unsupported formats come back as a 415 error with a plain sentence.
- Layered editing, transcoding, PDF, video and audio editing belong to sibling apps (formvis, formencoder, formpdf, formcut, formwav). Offer "Open in ..." instead of doing a worse version here.
- Writes (a rotate or flip, a command that saves) change real files. Say what will change and on which path before running it.

## Troubleshooting

- The tools do not appear: run `./formtools doctor`, then `./formtools boot`, and reconnect.
- A call is refused with 403: the request did not come from 127.0.0.1 or localhost; use the bridge, not a remote address.
- The first call is slow: the bridge may be starting the engine; its log is `formtools-engine.log` in the temporary folder.
