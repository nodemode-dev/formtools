---
name: formtools-driving
description: Use formtools, the media and file utility belt, through its MCP tools. Use whenever the person wants to browse a folder, read a picture's or video's details, batch convert, resize or rename pictures, inspect or convert a 3D model, list or safely extract an archive, compute or verify checksums, read text, fonts or data files, find duplicates, measure disk usage, find empty folders, create files from templates, or move files to the trash, and formtools tools are available or formtools is mentioned. Explains how to start the server, the tool loop and the limits. Not for changing formtools' own source code (use formtools-harness).
---

# formtools-driving

formtools runs on this computer as an engine with a window. Its MCP server, named `formtools`, is started by `./formtools mcp` (a stdio bridge to the engine's `/mcp` on 127.0.0.1:8240). If the engine is not running the bridge starts it. `./formtools mcp --where` prints the address and the config for a client.

## Tools

| Group | Tools | Use them to |
| --- | --- | --- |
| Catalogue | `list_commands`, `describe_command`, `run_command` | see and run the window's commands |
| Folders | `fs_list` | list a folder: name, path, kind, extension, size, modified time and file type |
| Pictures | `image_info`, `image_meta_write`, `image_edit` | read size, format, profile, EXIF and GPS; set rating and label; crop, resize, rotate, flip into a new file |
| Batch | `batch_actions`, `batch_plan`, `batch_run`, `rename_plan`, `rename_apply`, `rename_undo` | plan before running; every run is a job |
| Media | `media_info`, `media_copy`, `media_snapshot` | streams and tags; lossless remux, trim and audio extraction; a still frame |
| 3D | `model_info`, `model_convert` | counts, bounds and materials; convert to GLB, OBJ, STL, PLY or OFF |
| Files | `archive_list`, `archive_extract`, `hash_files`, `hash_verify`, `text_read`, `font_info` | archives with safe extraction, eight checksum algorithms and sums files, text with encoding, font names and axes |
| Utilities | `dupes_scan`, `disk_usage`, `empty_folders`, `templates_list`, `template_create`, `trash_files` | duplicates, folder sizes, empty folders, new files from templates, moving files to the system trash |
| Jobs | `job_status` | follow any tool that returned a job id until its state is `done`, `failed` or `cancelled` |

## The loop

1. Use absolute local paths. Expand `~` yourself.
2. `fs_list` the folder to see what is there. Do not guess file names.
3. Read before acting: `image_info`, `media_info`, `model_info`, `archive_list` or `font_info` on the file.
4. Plan before writing: `batch_plan` before `batch_run`, `rename_plan` before `rename_apply`, `dupes_scan` before `trash_files`.
5. Long work returns a job; poll `job_status` and report its result and errors.
6. If a call returns `{"ok": false, "error": ...}`, say the sentence plainly and stop or change course; do not retry the same call.

## Limits

- Nothing deletes permanently. `trash_files` moves to the system trash and refuses drive roots and the home folder. Show the person the list and get a yes before calling it.
- New files never replace old ones: extraction, conversion, templates and edits add " (2)" and so on.
- Extraction refuses parent and absolute paths, skips links and stops on archives that expand too far; say so when it reports skipped members.
- Formats the window cannot show (RAW, PSD, EXR, HDR, TIFF, OFF) are handled by the engine. Unsupported formats come back as a 415 error with a plain sentence.
- Layered editing, transcoding, PDF editing, video and audio editing belong to sibling apps (formvis, formencoder, formpdf, formcut, formwav). Offer "Open in ..." instead of doing a worse version here.

## Troubleshooting

- The tools do not appear: run `./formtools doctor`, then `./formtools boot`, and reconnect.
- A call is refused with 403: the request did not come from 127.0.0.1 or localhost; use the bridge, not a remote address.
- The first call is slow: the bridge may be starting the engine; its log is `formtools-engine.log` in the temporary folder.
