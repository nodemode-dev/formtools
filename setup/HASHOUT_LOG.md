# setup HASHOUT_LOG

## 2026-11-03 · v0.2.0 · launcher, setup scripts, CI, agent kit

- The launcher and `setup/` follow formvis's shape (bash dispatcher, `.bat` twins, `lib.sh`) with the prefix `ft_` and the root variable `FORMTOOLS_ROOT`. formvis delegates installs and boots to `oc_install` and `boot_*` files inside `backend/` and `frontend/`; formtools does the work in `setup/` itself because the contract lists no such files there.
- `install_backend` creates `backend/venv`, then installs `requirements.txt`; on macOS it prefers `requirements_macos.txt` when present. `install_frontend` runs `npm ci` and falls back to `npm install` when there is no lock file. `install --lite` is accepted and does nothing yet, so release pipelines that pass it do not fail.
- `install_desktop` needs `backend/requirements_desktop.txt` (macOS: `requirements_desktop_macos.txt` if present). The Tauri CLI comes from frontend devDependencies, so `desktop dev` and `desktop build` call `npx tauri` from `frontend/`. A relative `--config` path is therefore resolved from `frontend/`; formcompiler should pass an absolute path.
- `freeze_backend` freezes `backend/formtools_engine.py` as `formtools-engine`. The variable `FT_EXTRA_HIDDEN_IMPORTS` (filled from the environment variable `FORMTOOLS_HIDDEN_IMPORTS`, space separated) takes the hidden imports the engine agent reports. The Windows twin reads the same environment variable. `src-tauri/entitlements.plist` is used for macOS signing only when the file exists.
- The macOS signing loop is formvis's: it skips Mach-O files PyInstaller already signed with a timestamp, hardened runtime and library validation disabled, signs the rest, then verifies all of them.
- `mcp_stdio.py` starts the engine only when no `--url` or `FORMTOOLS_MCP_URL` is given: `serve` when `frontend/dist` exists, else `backend`. Set `FORMTOOLS_MCP_AUTOSTART=0` to turn that off. The bridge writes only protocol lines to stdout.
- `cli.py` has `info`, `list` and `version` only; the engine must be running.
- `ci.yml` pins actions to commit SHAs read from the GitHub release pages: checkout v4.2.2 `11bd71901bbe5b1630ceea73d27597364c9af683`, setup-node v4.4.0 `49933ea5288caeca8642d1e84afbd3f7d6820020`, setup-python v5.6.0 `a26af69be951a213d495a4c3e4e4022e16d87065`. No `${{ }}` appears inside a run script; the engine port goes through `env`.
- The plugin manifest lists only the driving skill, because the harness skill is for changing code.
- The two skills are mirrored byte for byte into `.agents/skills/`.

## 2026-11-03 · v0.3.0 · cli.py batch commands

- `cli.py` gains `convert`, `resize` and `rename`, standard library only (argparse, urllib), talking to the engine like `info` and `list`. `get` now wraps a general `call(method, route, body)`; the request timeout is 600 seconds because a plan over a big folder can be slow.
- `convert` takes a preset from `GET /api/batch/presets` (`--preset`, name match ignores case) or a JSON file (`--config`, keys `actions`, `output`, `recursive`, `extensions`, optionally `inputs`); `--format`, `--quality`, `--out`, `--naming` and `--recursive` override either. `resize --longest N` runs one resize action that never enlarges; without `--out` it writes `<name>-resized.<ext>` beside the source, with `--out` it keeps the names.
- Each run prints `job jN: title`, a `done/total current` line when progress changes, a summary line and up to five written paths; failures go to stderr and the exit code is 1 when the job did not finish or any picture failed. Ctrl-C cancels the job and exits 130.
- `rename` builds a replace rule from `--find` and `--replace` (`--regex` for patterns) and a counter rule from `--counter` (start 1, pad 3, appended with `_`). Without `--apply` it prints the plan and changes nothing; with `--apply` it prints `undo: uN` for `POST /api/rename/undo`.

## 2026-11-03 · v0.3.0 · one-folder engine on every OS

- `freeze_backend` and `freeze_backend.bat` always run PyInstaller with `--onedir` and copy `backend/dist-engine/formtools-engine` to `src-tauri/engine/` (program `formtools-engine[.exe]` plus `_internal/`), replacing the whole folder each run. The one-file branch, the `src-tauri/binaries/formtools-engine-<triple>` copy and the target triple lookup (so `rustc` is no longer needed to freeze) are gone. `FORMTOOLS_TARGET` still matters for `tauri build --target` only.
- The Mach-O signing loop and the PyInstaller `--codesign-identity` and `--osx-entitlements-file` flags are unchanged and run on macOS only. Then `--selfcheck` runs on the copied program on every OS; the script stops if it fails.
- On Linux the freeze worked with PyInstaller 6.22.3 and the engine started (`--version`, and `FORMTOOLS_PORT=0` printed the Uvicorn port line), but `--selfcheck` exited 1 with "no tool registered" because `backend/app/tools` had no registered tool yet. That is a backend gap, not a freeze fault.
- `desktop_build` and `desktop_build.bat` needed no change. The Windows twin uses `xcopy /e /i` for the folder copy; it was not run here.
