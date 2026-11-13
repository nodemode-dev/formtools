# backend HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## v0.8.0 (2026-11-13): no engine change; the sparkle check reads the demo pages

- setup/sparkle.py · `SCANNED` gains `demo` and `demos`, so `./formtools sparkle` also reads the browser demo pages. The engine process has no change in this release; `scripts/demo-record.py` (frontend log) only calls it over HTTP.

## v0.7.0 (2026-11-13): the window bridge, terminals and Claude Code, agents install, demos

- services/bridge.py :: `attach`, `detach`, `resolve`, `call`, `mirror`, `catalogue`, `find`; routers/live.py :: `live`, `mirror` · `/api/live` ported from formtxt (same message format, without its `versions.agent_mark`) and `POST /api/commands/catalogue`, which keeps the window's commands in memory. routers/mcp.py :: `do_run_command` now awaits the window through `anyio.from_thread.run(bridge.call, ...)`; `list_commands` and `describe_command` include the window's commands. Removed: `raise ApiError(409, WINDOW_MESSAGE)`. `WINDOW_ONLY` refuses `terminal-toggle`, `terminal-new`, `claude-code`, `claude-chat` to agents.
- services/agents.py :: `INAPP_TOKEN`, `is_inapp`, `caller`, `note`, `clients`; routers/mcp.py :: `dispatch(message, token=None)`, `status` · the `x-formtools-inapp` header marks the dock's own Claude Code ("Claude Code in formtools"); a client that only claims that name is recorded as outside. `SUPPORTED` gains 2025-11-25 ahead of `("2025-06-18", "2025-03-26", "2024-11-05")`. `GET /api/mcp/status`.
- services/terminal.py, services/claude_code.py, routers/terminal.py, routers/claude_code.py · formvis's routes and message formats (the window's dock calls them), with formlit's behaviour where the two differ: the terminal environment carries `FORMTOOLS_MCP_URL`, a new shell starts in the home folder, the Claude Code tab and Chat work in `<data>/Agent`, and the child environment drops `CLAUDE*`. One formlit choice not taken: the in-app token goes only in the environment (`FORMTOOLS_INAPP_TOKEN`), never in argv. The PTY library is imported softly. main.py :: `lifespan` binds the loop and stops Chat and terminals at shutdown.
- requirements.txt · ptyprocess 0.7.0 and pywinpty 3.0.5 with NOTICE rows; freeze flags as formlit's: `--hidden-import ptyprocess` in setup/freeze_backend and `--collect-all winpty` in the .bat.
- tools/demos/ (`art`, `pixelfont`, `photos`, `family`, `bench`, `service`, `router`) · three demo folders generated into `<data>/demos/<id>` on first open with a `.demo-<version>` marker; nothing ships but generator code. `Demo Pixel.ttf` is the generator's own 5x7 pixel font built with fontTools and draws every word in the demos, so no bundled font is used. `service.ensure` builds into `.<id>-building` and swaps into place; an older version is replaced; a folder without a marker is moved aside, never deleted. Routes `GET /api/demos`, `POST /api/demos/{id}`, `GET /api/demos/{id}/cover.png`; MCP tool `demo_open` (35 tools now). The bench demo adds a WebM only when ffmpeg is present and retries on the next open.
- setup/agents.py :: `install [--dry-run] [--user] [claude|codex|cursor]` ported from formvis (backs files up, a second run changes nothing). Removed: `parser.add_argument("action", choices=["sync", "check"])` and `return sync() if args.action == "sync" else check()`. Skills gain `terminal` and `terminal-operator` sub-skills. setup/sparkle.py (`./formtools sparkle`, in CI's lint job) is formvis's `SPARKLE_BANNED` check, extended.
- Open: core/runtime.py `alive` on Windows; AGENTS.md and the manual do not yet describe the terminal dock; the backend's `image.*` commands are not window commands, so `run_command` with one answers that there is no such command.

## v0.6.4 (2026-11-13): review fixes, second pass

One line per fix: file and symbol, what changed and why. The commit of the same subject carries the reasoning and what was run. Windows-only fixes were not run on Windows.

Batch, image, media, MCP:

- tools/image/transform.py :: `run` · a JPEG that Pillow reports as MPO takes only the lossless orientation patch (`patch_orientation` then `write_beside`) and answers 415 when that is not possible; re-encoding would drop the extra pictures.
- tools/media/copy.py :: `pick` · a mov_text subtitle track is left out of an MKV remux; Matroska cannot hold it and the default remux of such an MP4 always failed.
- tools/batch/rename.py :: `paths_from` · a folder listed together with an item inside it answers 400; one order failed part way and the other left an undo that could not run.
- tools/media/preview.py :: `snapshot` · `-update 1` before the output, so a `%d` in the video's name is not read as a frame pattern that overwrites another file.
- tools/batch/service.py :: `source_size` (new), `predicted_size`, `preview` · RAW extensions take their size from `image.info.raw_info`; Pillow reads the embedded thumbnail of TIFF-based RAW files. Removed: the inline `with Image.open(source) as probe: original = max(probe.size)`.
- routers/mcp.py :: `rpc` · a POST that is not `application/json` answers 415; `setup/mcp_stdio.py` already sends that type and the window never posts to `/mcp`.

Files, desktop, model, utilities:

- tools/files/hashing.py :: `BY_NAME` (new), `BY_LENGTH`, `BY_EXTENSION`, `parse_sums` · the sums file name chooses the algorithm when the extension does not (B3SUMS, SHA3-256SUMS, XXH64SUMS and the rest), 16 hex digits are xxh64, and a BSD line needs a known tag with that tag's digest length. Removed: `BY_TAG.get(tag) or BY_LENGTH.get(len(digest))`.
- tools/model/service.py :: `absolute_obj` (new), `load` · negative OBJ indices are rewritten to absolute ones before trimesh parses, which resolves them against the whole vertex list; :: `mtl_notes` · an `mtllib` line is split only when every part ends in `.mtl`.
- tools/desktop/hosts.py :: `Snapshot.version`, `read`, `save(entries, version=None)`, tools/desktop/router.py :: `HostsBody.version` · the read reply carries a sha256 of the file and a save with a stale version answers 409 and writes nothing; a save without one behaves as before.
- tools/utilities/walk.py :: `walk`, `inside` (new), `folder_roots(raw, recursive=True)`; diskusage.py; tidy.py; service.py · junctions are skipped like links, Windows takes identity from `os.stat` because `DirEntry.stat` leaves it zero there, and roots are deduped by real path and containment in a recursive scan.
- tools/files/fonts.py :: `register_windows` · passes `None` for lParam; `envvars.broadcast` leaves `c_wchar_p` argtypes on the shared `SendMessageTimeoutW`, which refused the int 0.
- tools/desktop/envvars.py :: `windows_kind` · an existing REG_SZ becomes REG_EXPAND_SZ when the new value holds `%`. Removed: `return kind`.
- tools/desktop/elevate.py :: `powershell_literal` · doubles the four typographic single quotes as well as the ASCII one.

Engine entry and scripts (setup has its own log for older entries):

- formtools_engine.py :: `watch_parent` · runs on every OS; the loop is `os.getppid() == parent and runtime.alive(parent)`, because Windows keeps the old parent id after the parent exits. Removed: `if os.name != "posix": return`.
- setup/mcp_stdio.py :: `data_dir`, `find_engine`, `forward`, `main` · when the default address does not answer, the bridge reads `engine.port` from the data folder and uses that engine if its health check answers; stdin and stdout are reconfigured to UTF-8.
- setup/desktop_dev · tests `src-tauri/engine/formtools-engine` instead of the pre-0.3.0 one-file sidecar; setup/agents.py · `tomllib` is imported inside `check_agent_files`, so `agents sync` runs on Python 3.9.
- setup/mcpb/manifest.json · `python3`, with a win32 override to `python`.

Open, recorded and not changed in 0.6.4:

- core/runtime.py :: `alive` on Windows uses `OpenProcess` alone, which also succeeds for an exited process while a handle to it is open; checking the exit code would make the parent watch firmer.
- tools/desktop/hosts.py :: `build` answers 400, not 409, for a line number that no longer exists; tools/desktop/__init__.py does not mention `version` in the `hosts_read` tool description.
- `.mcp.json` cannot start the bridge on Windows.

## v0.6.3 (2026-11-12): review fixes

Five fixes from a full review. The commit of the same subject carries the reasoning and what was run.

- core/guard.py :: `HostGuard`, `origin_allowed`, `WINDOW_PORTS` · the guard also reads `Origin` and refuses one that is not this computer's own window: loopback at the engine's own port, or at 5240 and 5241 (the dev and preview windows, whose requests arrive through Vite's proxy with the page's Origin). Requests without `Origin` pass as before, since agents and the MCP bridge send none. Reason: a page on any site could POST `text/plain` JSON to `/mcp` with no preflight and run every tool, `rename_apply` and `trash_files` included; the Host check stops DNS rebinding only. Checked against a live engine: 200 with no Origin, its own origin and `http://localhost:5240`; 403 for a foreign origin, another local port and `null`.
- tools/image/transform.py :: `run` · a file with more than one frame that is not an animated GIF, WebP or PNG is refused with 415. A multi-page TIFF fell into `still()`, which saved page one over the file and reported a lossless result.
- tools/batch/rename.py :: `same_file` · compares the two entries with `lstat` and requires the names to differ only by case. `os.path.samefile` follows links, so renaming a symlink onto its target planned with no conflict and replaced the target with a link to itself. The function exists for case-only renames on case-insensitive disks. Removed: `return os.path.samefile(first, second)`.
- tools/utilities/dupes.py :: `collect` · `seen` is keyed by device and inode for single-link files, path otherwise. One file reached through two roots (a folder and a link to it, `/tmp` and `/private/tmp`) was listed as its own duplicate, and trashing the extra copy removed the only one. Overlapping roots are still walked twice.
- tools/desktop/formtools.thumbnailer · `TryExec` and `Exec` name `/usr/lib/FormTools/engine`; the bundler installs under the product name, which became FormTools in 0.6.1.

Found in the same review and not changed in 0.6.3, so the next pass starts here:

- tools/image/transform.py refuses JPEGs that Pillow reports as MPO (many phone and camera files); tools/media/copy.py copies a mov_text subtitle track into MKV, which always fails; tools/media/preview.py snapshots of a video named with `%d` overwrite another file (needs `-update 1`); tools/batch/rename.py renames a folder together with items inside it and then cannot undo; tools/batch/service.py probes TIFF-based RAW files at thumbnail size.
- tools/files/hashing.py verifies its own `B3SUMS`, `SHA3-256SUMS` and `XXH64SUMS` files with the wrong algorithm; tools/model/service.py reads OBJ negative indices wrongly through trimesh and reports a missing material library for names with spaces; tools/desktop/hosts.py saves by line number with no check that the file changed; tools/utilities/walk.py follows Windows junctions and cannot see hard links there; tools/desktop/envvars.py leaves `argtypes` on the shared `SendMessageTimeoutW`, which breaks font registration afterwards, and keeps REG_SZ for a value that now holds `%`; tools/desktop/elevate.py doubles only the ASCII quote for PowerShell.
- setup/mcp_stdio.py and the .mcpb extension cannot reach the desktop app's engine (it listens on a random port and nothing reads `engine.port`), and the bridge does not set UTF-8 stdio on Windows; formtools_engine.py watches its parent on POSIX only, so an orphaned Windows engine blocks later launches; src-tauri `read_port` waits forever for the port line; setup/agents.py imports `tomllib` at the top and fails on Python older than 3.11.

## v0.2.0 (2026-11-03): engine skeleton and image tool

### Layer 1, engine skeleton

- Entry `formtools_engine.py`: `--version` prints `formtools 0.2.0`; `--selfcheck` imports every required library and the whole app (which discovers the tool modules) and prints `ok`, exit 0. It exits 1 and names the problem on stderr if a required library, a tool module or (when frozen) the bundled `ui/` folder is missing. `rawpy` is optional in the self check because it has no macOS x64 wheel; the capabilities endpoint then lists no RAW extensions.
- Serving: binds `127.0.0.1` only, port from `FORMTOOLS_PORT` (default 8240, 0 picks a free port). uvicorn's log config is rewritten so its "Uvicorn running on http://127.0.0.1:PORT" line goes to stdout, as the contract says the shell reads it there (uvicorn's default sends it to stderr).
- The data folder is claimed with `engine.lock` (process id). A second engine on the same folder exits 2 with a sentence. `engine.port` holds `{pid, port}` while running. uvicorn re-raises SIGTERM after a graceful stop, which skips a `finally`, so a SIGTERM handler releases both files before exiting.
- The parent watcher (exit when the launching process disappears) runs only when frozen or when `FORMTOOLS_WATCH_PARENT=1`. formvis ran it always; that kills a dev engine started from a shell that then exits. The formvis sweep of stale `_MEI` folders is left out: it is only needed for the one-file Windows/Linux build and was judged the freeze script's job to decide; flag for the lead.
- Host guard (`app/core/guard.py`): pure ASGI middleware, refuses with 403 JSON unless the Host header is `127.0.0.1:<port>` or `localhost:<port>`, where `<port>` is the port the server really listens on (taken from the ASGI scope, so port 0 works). Websockets are closed with code 4403. CORS is not enabled. Consequence for the frontend: the Vite proxy must send `Host: 127.0.0.1:8240` (`changeOrigin: true`), otherwise every proxied call is a 403.
- Errors always have the shape `{"ok": false, "error": "sentence"}` (400, 404, 415, 403; 409 only inside MCP). Request validation errors become 400.
- Registry (`app/core/registry.py`): a tool is a module under `app/tools/` that calls `registry.register(Tool(...))` at import. A `Tool` carries id, routers, a `formats()` callable (evaluated per request so it reports what really loads), commands for MCP `list_commands`, extra MCP tools, and startup/shutdown hooks. `discover()` walks `app.tools` with `pkgutil`; a module that fails to import is recorded and logged, the engine still starts, and `--selfcheck` fails. Adding a tool means adding a package under `app/tools/`.
- Static UI: `frontend/dist` in dev (when it holds `index.html`), `<bundle>/ui` when frozen, `FORMTOOLS_DIST` overrides. Mounted last so API routes win.
- fs: `ext` is lower case without the dot; `mtime` is epoch seconds as a float; directories report `type: other` and `size: 0`. Hidden means a leading dot, or the Windows hidden attribute. Natural, case-insensitive name order with folders first. Volumes: `/Volumes` on macOS, `/media/$USER`, `/run/media/$USER`, `/media`, `/mnt` on Linux, drive letters on Windows. `family` type covers `.fvd .fmv .formvis .fc .fmw .fsc .fequeue .fldb`.
- file/raw uses Starlette `FileResponse`, which answers `Range` (206, `Accept-Ranges`, ETag, Last-Modified).
- MCP: JSON-RPC 2.0 over `POST /mcp` (single or batch; notifications get 202), `GET /mcp` returns a small description. Protocol versions 2025-06-18, 2025-03-26, 2024-11-05. `run_command` always returns `isError` with "The window runs commands. Open formtools, then ask again." because the contract defines no window attach mechanism yet; when one exists, `do_run_command` is the single place to change. The commands listed are the five image transforms.
- `capabilities.formats`: `video`, `audio`, `model` and `text` are empty lists because no tool registers them yet; the contract asks for exactly what works.

### Layer 2, image tool (`app/tools/image/`)

Libraries (all exact pins in `requirements.txt`):

| Library | Version | Licence | Use |
| --- | --- | --- | --- |
| fastapi | 0.141.1 | MIT | web framework |
| uvicorn[standard] | 0.53.0 | BSD-3-Clause | server (httptools, uvloop off Windows, watchfiles, websockets, PyYAML, python-dotenv) |
| Pillow | 12.3.0 | MIT-CMU | common formats, ImageCms (lcms2, MIT), WebP/PNG encode |
| numpy | 2.5.3 | BSD-3-Clause and bundled permissive libs | 16-bit scaling, tone map |
| rawpy | 0.27.1 | MIT; LibRaw 0.22.1 inside, CDDL-1.0 elected | RAW |
| psd-tools | 1.23.0 | MIT | PSD and PSB composite |
| OpenEXR | 3.5.2 | BSD-3-Clause (PyPI licence field empty; the repo LICENSE is the source) | EXR |
| pyinstaller | 6.22.3 | GPL-2.0-or-later with bootloader exception | build tool only, `requirements_desktop.txt` |

Transitive licences read from installed metadata: starlette BSD-3, pydantic and pydantic_core MIT, anyio MIT, h11 MIT, click BSD-3, httptools MIT, uvloop MIT, watchfiles MIT, websockets BSD-3, PyYAML MIT, python-dotenv BSD-3, idna BSD-3, typing_extensions PSF-2.0, annotated-types MIT, annotated-doc MIT, attrs MIT, typing-inspection MIT. `pyinstaller-hooks-contrib` carries Apache-2.0 and GPLv2 classifiers (build time; check it in the licence scan of the frozen bundle).

Native libraries seen inside a Linux onedir freeze, for NOTICE.md: libavif (Pillow AVIF), libwebp, libjpeg-turbo, lcms2, openjpeg, libtiff, zstd, xz, libraw_r (LibRaw), libjasper (rawpy), libgomp (GCC runtime library exception), libgfortran and libquadmath (numpy; libquadmath is LGPL-2.1-or-later, so keep it as a separate shared file, which the contract's Linux one-file build would hide; the recommended stack says onedir everywhere, the contract says one-file off macOS: lead to decide). No x264, x265 or libheif in the bundle.

Decisions:

- AVIF: the pinned Pillow 12.3.0 wheel decodes AVIF natively (`features.check("avif")` true, libavif 1.4.2). Verified on a generated file. AVIF is listed under `engine`, not `native`, so the window always asks the engine and never depends on the webview's support.
- `native` image list (the webview shows these without the engine): jpg jpeg jpe jfif png apng gif webp bmp svg. `engine` is computed at request time from what loads: tif tiff ico icns tga qoi dds pcx ppm pgm pbm pnm hdr always; avif avifs and jp2 j2k jpf jpx by Pillow feature checks; psd psb with psd-tools; exr with OpenEXR; the 26 RAW extensions with rawpy; heic heif heics heifs only on macOS where `sips` exists.
- Thumbnails and views of the native formats also work (the engine decodes them), but they are not repeated in `engine`.
- Left out on purpose: SVG decode (the window shows it; resvg is a Rust-side job), colour PFM (Pillow reads grey PFM only), CUR and DIB (not exercised), EPS/PS/PDF/WMF/EMF (Pillow would call Ghostscript, which is GPL/AGPL; an allow list of Pillow format names blocks them), JPEG XL.
- JXL: 415 with a plain message. `pillow-jxl-plugin` 1.3.8 has no licence metadata (matrix says FLAG), `jxlpy` has Linux wheels only, `imagecodecs` is a FLAG and its PyPI list shows no CPython 3.13 wheel. No cleared decoder exists for both pinned Python versions on all four targets.
- HEIC: macOS converts through `sips -s format png` into a temp folder, then decodes that PNG (so EXIF orientation carried into the PNG is applied). Elsewhere 415 with a sentence. Not run here (no macOS); the code path is untested.
- RAW: for thumbs the embedded preview is used when its longest side is at least the requested size (orientation from the preview's EXIF, else LibRaw's flip), else a half-size demosaic with camera white balance; views demosaic fully (half-size when the cap allows). Verified with the DNG fixture formvis ships (no preview inside it, so the demosaic path ran); the embedded-preview branch is unexercised because no RAW file with a JPEG preview was available.
- PSD: `PSDImage.composite()` (uses the stored merged preview when present). ICC from image resource 1039 when readable. 16 and 32 bit PSDs were not tested. EXIF in PSD is not read.
- EXR and Radiance HDR: linear float, then if the 99.9th percentile is 1.0 or less the image is treated as display-referred (plain sRGB encode); otherwise auto exposure (0.18 over the log-average luminance, clamped to 1/16 to 16) and the Narkowicz ACES filmic fit, then sRGB encode. Alpha is kept linear. EXR reads RGB, RGBA, separate R/G/B(/A), or Y; multi-part files show part 0. The Radiance reader is hand written (flat and new run-length scanlines, standard `-Y +X` orientation only).
- ICC: embedded profiles convert to sRGB with ImageCms (relative colorimetric with black point compensation; perceptual for CMYK); profiles whose description contains sRGB are left alone. CMYK without a profile uses Pillow's plain conversion. Bit depth: 16-bit grey (I;16, I) scales by 1/257; floats are normalised.
- 16-bit colour: Pillow decodes 16-bit RGB TIFF and PNG to 8 bit for display. `info` still reports the real depth (PNG IHDR, TIFF BitsPerSample), and `transform` refuses those files (415) because re-saving would drop to 8 bit. `tifffile` was not added: it is not in the licensing matrix.
- Thumbnail cache: `<data>/cache/thumbs/<2 hex>/<sha1 of path|size|mtime_ns|bytes>.webp`, quality 82, written to a temp file then renamed. A background prune at start trims to 80 percent of 512 MB by last use. At most 4 decodes run at once. Views are not cached. `size` is clamped to 64..512; `max` outside 0..30000 is a 400. Pictures over 400 megapixels are refused with 400.
- View output: PNG when the result has real transparency or is wider than WebP's 16383 limit, else WebP at quality 92.
- `info` extras beyond the contract: `orientation`. Width and height are as displayed (swapped for EXIF orientations 5 to 8). EXIF values are reduced to JSON primitives; MakerNote, XMP and TIFF structure tags are skipped.

### JPEG rotation: deviation from the brief

The brief asked for a Pillow pixel-exact transpose when dimensions are multiples of the MCU, else an EXIF orientation edit. Pillow cannot do that: every Pillow JPEG save decodes and re-quantises, so no transpose is bit-exact, whatever the dimensions. A true DCT-domain transform needs libjpeg `jpegtran`/`tjTransform`, which no cleared Python wheel exposes. So:

- `lossless: true` (default): the file bytes are never decoded. The EXIF Orientation value is composed with the operation (proved by transposing a 3 by 2 probe, so all eight orientations and all five operations compose correctly) and written in place (same length) into the existing IFD0 entry. A JPEG with no EXIF gets a 32-byte APP1 segment inserted after JFIF. Entropy-coded data is untouched, for every size, so `lossless_used: true`. Cost: viewers that ignore EXIF orientation show the old rotation, and the contract's "orientation reset plus pixel-exact transform" is not met.
- Fallback (`lossless: false`, or an EXIF block without an Orientation entry, or an unreadable one): decode, apply stored orientation, transpose, re-encode with the original quantisation tables and subsampling (4:4:4, 4:2:2 or 4:2:0; other layouts become 4:4:4), orientation set to 1, ICC and EXIF kept. `lossless_used: false`.
- Other formats re-encode at full quality with orientation baked in: PNG (compress 6, text chunks, ICC, transparency kept), WebP (lossless), TIFF (deflate, ICC and non-structural tags kept), BMP, GIF. `lossless_used` is true when no pixel value changes (only positions), false for animated files (GIF/WebP/APNG frames are rebuilt as RGBA). RAW, PSD, EXR, AVIF, HEIC, ICO and JXL are view-only (415).
- The file is replaced through a temp file in the same folder and `os.replace`, with the original permissions.

### Verification run (this log's author, Linux x64, CPython 3.12, venv outside the repo)

- `pip install -r requirements.txt` clean; `--selfcheck` printed `ok`; engine started on 8240.
- Passed: health, capabilities (51 engine extensions on Linux), fs/home, fs/list (natural order, folders first, hidden toggle, family and other types, 404 and 400 cases), file/raw with Range (206), thumb and view for JPEG with EXIF orientation 6, PNG with alpha, 16-bit grey TIFF, WebP, AVIF, CMYK JPEG, ICC JPEG, animated GIF, BMP, ICO, flat and run-length Radiance HDR (identical output), PSD made with psd-tools, RGB and RGBA EXR made with OpenEXR, DNG fixture, TGA, QOI, PCX, PPM, PGM, DDS, JP2, ICNS; 415 for JXL, HEIC on Linux, a corrupt RAW and an empty JPEG. info for the same set including EXIF and GPS. transform on JPEG (lossless, orientation composed correctly; lossy fallback), PNG, WebP, GIF, 16-bit TIFF, BMP, CMYK JPEG; PSD refused. MCP initialize, notifications, tools/list, list_commands, describe_command, run_command (error), fs_list, image_info, unknown method. Wrong Host values (`evil.com`, `attacker.example`, `127.0.0.1:9999`) got 403 on HTTP and on `/mcp`; `localhost:8240` got 200.
- Not run: macOS `sips` HEIC path, a RAW file with an embedded preview, 16-bit RGB TIFF files (Pillow cannot write them; none made), PSB, multi-part EXR, a Windows or macOS freeze.
- Freeze check (Linux onedir): see the flags below; the frozen engine passed `--selfcheck`, served the bundled `ui/`, and decoded PSD, EXR, DNG, HDR and AVIF. Without `PYTHONPATH` set to the backend folder the `--collect-submodules app` step in the generated spec runs in an isolated child that cannot import `app`, collects nothing, and the tool module is left out of the bundle (the self check then fails with "no tool registered").

### PyInstaller flags for the freeze script

Run from the repo root with `PYTHONPATH` set to the `backend` folder (required, see above):

```
PYTHONPATH=backend pyinstaller --noconfirm --clean --onedir --name formtools-engine \
  --distpath <dist> --workpath <work> --specpath <spec> --paths backend \
  --add-data "frontend/dist:ui" \
  --collect-submodules app --collect-submodules uvicorn \
  --hidden-import OpenEXR --hidden-import rawpy --hidden-import psd_tools \
  backend/formtools_engine.py
```

Windows uses `;` in `--add-data`. The data path inside the bundle must be `ui` (the engine looks for `<bundle>/ui/index.html`). Use `--onefile` instead of `--onedir` for the Windows and Linux sidecar if the contract's one-file rule stays. On macOS x64 install without `rawpy` (the marker in `requirements.txt` skips it) and pass no `--hidden-import rawpy` there, or the build warns. Add `--target-arch` and `--codesign-identity` as the formvis script does.

### Wheel check (PyPI file lists, CPython 3.12 and 3.13; macOS arm64 and x64, Windows x64, Linux x64)

Complete for fastapi, uvicorn, pillow, numpy, psd-tools, OpenEXR, pyinstaller and the uvicorn extras (httptools, watchfiles, websockets, PyYAML, pydantic_core). Gaps: rawpy 0.27.1 has no macOS x64 wheel (the requirements marker skips it there, RAW is then unavailable and capabilities say so; building LibRaw from source in CI would close it); uvloop has no Windows wheel (uvicorn already skips it on Windows). Newer releases exist on PyPI (pillow 13.0.0, rawpy 0.28.0, psd-tools 1.26.0, OpenEXR 3.5.3, fastapi 0.162.0, uvicorn 0.54.0, numpy 2.5.4); pins follow the brief for fastapi and uvicorn and match formvis for the rest, and were not bumped.
