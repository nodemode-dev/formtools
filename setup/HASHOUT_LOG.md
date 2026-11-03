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
