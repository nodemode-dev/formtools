---
name: formtools-harness
description: Change formtools' own source code. Use whenever the task edits files in this repository, for example add or fix a tool in the frontend, add an engine route in the backend, change the Tauri shell in src-tauri, adjust the launcher or a setup script, update CI, or bump the version. Gives the repository layout, the hard rules (hand-made surgical edits, no flicker, tokens only, no emoji, no em dash in Markdown, near-zero comments) and routes to the frontend, backend, src-tauri or setup area. Not for using formtools to inspect or manage files (use formtools-driving).
---

# formtools-harness

formtools is the form* family's media and file utility belt: viewers, batch image tools, 3D viewing and conversion, file utilities and desktop utilities. This skill is for changing its code. To use the running app through MCP, load `formtools-driving` instead.

## Layout

| Path | What lives there |
| --- | --- |
| `frontend/` | vanilla TypeScript and Vite window; dev server `127.0.0.1:5240`, `/api` proxied to the engine; `src/version.ts` holds the version |
| `backend/` | Python and FastAPI engine; entry `formtools_engine.py` (`--selfcheck`, `--version`); routes under `app/`; dev port 8240 |
| `src-tauri/` | Tauri 2 shell: splash and main windows, commands the page may invoke, plugins, bundle config |
| `setup/` | launcher helpers: `lib.sh` (functions prefixed `ft_`), install, boot, build, freeze, desktop, doctor, clean, `mcp_stdio.py`, `cli.py`, each with a `.bat` twin |
| `docs/encyclopedia/` | research only: how other products work, paraphrased, with sources |
| `.github/workflows/ci.yml` | the check formcompiler waits for on `main` and `compile_v*` |
| `formtools`, `formtools.bat` | the launcher; `./formtools help` lists every command |

## Routing

| The change touches | Do this |
| --- | --- |
| Pages, panels, styling, icons, themes, boot sequence | Work in `frontend/`. Tokens for colour and z-index, inline `currentColor` SVG icons, render once then patch in place. Check with `npm run build` and `npx tsc --noEmit -p .` |
| An HTTP route, a file format, image decoding, the MCP tool list | Work in `backend/`. Keep every route behind the Host check, paths absolute and UTF-8, errors as `{"ok": false, "error": "plain sentence"}`. Check with `python backend/formtools_engine.py --selfcheck` |
| Windows, menus, tray, native dialogs, updater, bundle | Work in `src-tauri/`. A command the page invokes needs an `allow-<name>` permission because the page is a remote origin |
| Install, boot, freeze, packaging, doctor | Work in `setup/`. Change the `.bat` twin with the shell script. Check with `bash -n` on each shell script |
| The fixed interfaces (ports, API paths, launcher commands) | Stop. These are set by the scaffold contract; changing one needs the owner |

## Fixed values

- Vite port 5240 with `server.host: false` and `strictPort: true`; engine port 8240 from `FORMTOOLS_PORT`; `FORMTOOLS_PORT=0` in the desktop app picks a free port.
- Data lives in `FORMTOOLS_DATA_DIR` or the OS app-data folder, never beside the install.
- Frozen engine: PyInstaller from `backend/formtools_engine.py`, one folder on every OS (`src-tauri/engine`, program `formtools-engine` or `formtools-engine.exe` plus `_internal/`), `frontend/dist` bundled as `ui`.
- The release contract uses only `./formtools install`, `./formtools install-desktop` and `./formtools desktop build [--config F] [--target T]`.

## Rules

1. Surgical, hand-made edits: one region per change. No sed, patch, codemod or generator that writes source.
2. Zero DOM flash, flicker or re-render: render once, reserve space, then patch in place.
3. Colours and z-index come from tokens only. Icons are inline `currentColor` SVG. No icon library.
4. No emoji anywhere. No U+2014 in Markdown; use the interpunct.
5. Near-zero comments in code. Context goes in the nearest `HASHOUT_LOG.md`.
6. A new dependency is checked against `docs/encyclopedia/engines/engine-licensing-matrix.md` first and gets a `NOTICE.md` row in the same commit. Pin exact versions. GPL stays out of the distributed app, AGPL is used nowhere.
7. Versions are `v*.*.*` with dots. The version sites are `frontend/package.json`, its lock file, `frontend/src/version.ts`, `backend/app/__init__.py`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, `src-tauri/tauri.conf.json`, `setup/mcpb/manifest.json`, the fallback version strings in `setup/cli.py` and `setup/mcp_stdio.py`, and the README badge; bump them together.
8. Do not duplicate a sibling app's job (transcoding, libraries, layered editing, PDF, video, audio, sculpting, boards, launching, installing). Hand off with "Open in ...".
9. Never edit `.claude/settings.json`; it keeps Claude Code attribution off.

## Commits

One author and committer, `nodemode-ai <mackin@nodemode.ai>`. No `Co-Authored-By` or `Claude-Session` trailer and no "Generated with" line. Message style: `type(scope): plain sentence (X.Y.Z)`, with the version bump commit last.

## Before finishing

Run the checks for the area you touched, then `./formtools doctor`. Say plainly what was verified and what was not.
