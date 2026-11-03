# formtools

![version](https://img.shields.io/badge/version-v0.2.0-f97316) ![licence](https://img.shields.io/badge/licence-Apache--2.0-blue) ![stage](https://img.shields.io/badge/stage-alpha-lightgrey)

The form* family's media and file utility belt: one desktop app for macOS, Windows and Linux that opens, previews and converts what the Form apps make, views almost any file, batch-processes images, and carries the desktop utilities people reach for every day.

**Stage: alpha.** v0.2.0 runs: the window shell, Home, a folder browser with thumbnails, the image and media viewer, and formvis project previews. The tools marked "planned" on Home arrive in later phases.

## Quick start

```bash
./formtools_oc_install     # backend venv, Python packages, frontend packages
./formtools                # engine on 127.0.0.1:8240 and the window on http://127.0.0.1:5240
./formtools desktop dev    # the desktop app (needs Rust; ./formtools install-desktop first)
./formtools mcp            # the MCP server on stdio, for Claude Code, Codex and Cursor
```

| Port | What | Set by |
| --- | --- | --- |
| 5240 | Vite dev server, 127.0.0.1 only | `frontend/vite.config.ts` |
| 8240 | engine (FastAPI), 127.0.0.1 only | `FORMTOOLS_PORT` |

The desktop app starts its own engine on a free port. Every file is read on this computer; nothing is uploaded.

## What it will do

| Area | In formtools |
| --- | --- |
| View | Images (RAW, HDR, EXR, PSD, JXL, AVIF, HEIC, animation), video and audio, 3D models and splats, fonts, text and code, CSV, JSON and SQLite, hex, archives; a folder browser; a Quick View hotkey |
| Batch images | Convert with an ordered action pipeline and live preview, resize, rename with tokens and regex, presets shared by the window, the CLI and agents |
| 3D | View, inspect, measure, convert and optimise to glTF, GLB and USDZ |
| File utilities | Archives (safe extraction), hashing, duplicate finder, disk usage, file lock finder, file templates |
| Desktop utilities | Colour picker, screen ruler, text extractor (local OCR), always on top, awake, crop and lock, quick accent, zoom and draw |

Work that belongs to a sibling app opens in that app: layered editing in formvis, transcoding in formencoder, PDF editing in formpdf, libraries in formdam and formlit, video editing in formcut, audio editing in formwav, sculpting in formsculpt.

## Family

| Repo | Role for formtools |
| --- | --- |
| `nodemode-dev/formcompiler` | builds, signs and releases formtools for the three OSes from a `compile_vX.Y.Z` branch |
| `nodemode-dev/formportal` | installs, opens and updates formtools; routes "Open in ..." hand-offs |
| `nodemode-dev/formMCP` | reaches formtools for agents through `./formtools mcp` |
| `nodemode-dev/formskills` | lists formtools' released skills |
| `nodemode-dev/formvis` | the UI, theme and shell formtools shares |

## Repository

| Path | Holds |
| --- | --- |
| `frontend/` | vanilla TypeScript and Vite window: Home, browser, viewer, Preferences, command palette |
| `backend/` | Python and FastAPI engine: file listing, image decoding (RAW, PSD, EXR, HDR, AVIF, TIFF and more), formvis project reader, MCP |
| `src-tauri/` | Tauri 2 desktop shell: splash, window, menus, file dialogs, drag and drop |
| `setup/` | the scripts behind `./formtools` |
| `docs/encyclopedia/` | 130 sourced pages on how XnView, XnConvert, PowerToys, Preview, VLC and many other tools work. Start at `INDEX.md`; open gaps are in `GAPS.md` |
| `docs/family-formats/` | how formtools reads each Form app's project files |
| `LICENSE` | Apache-2.0 |
| `NOTICE.md` | third-party components and trademark notes |
| `CLAUDE.md`, `AGENTS.md` | rules for agents working here |

Planning documents (DEV_PLAN, BUILD_NOTES, HASHOUT_LOG) ship in the planning sidecar zip, not in this tree.

## Licence

Copyright (C) 2026 NodeAgentc, Inc. Licensed under the Apache License, Version 2.0. Product names in the encyclopedia belong to their owners and appear only to describe what those products do.
