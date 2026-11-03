# exif tool HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## v0.6.0 (2026-11-03): exif tool (builder X1)

### Pinned versions and integrity (npm registry, checked 2026-11-03)

| Package | Version | ExifTool inside | Registry `integrity` (sha512) | npm `license` field |
| --- | --- | --- | --- | --- |
| `exiftool-vendored.pl` | 13.60.0 | 13.60 | `sha512-RPXLoynEgak2D9zclE4oCpXII4S3EZlHXJIFHvjktByDgM7+ievXBfqtEWw6dK0xbk/L+cLVTWKoUBhOH+P/1A==` | MIT |
| `exiftool-vendored.exe` | 13.60.0 | 13.60 | `sha512-DcpybFsR7Dp3FMrPDaq3iy+dcFrPTYENJeazy19TQoefpp4MQml5YXMAx2TpYRFuYoFLcXi9dupyufdrj6sS+A==` | MIT |

Tarballs: `https://registry.npmjs.org/<name>/-/<name>-13.60.0.tgz`. `npm pack` of both gave tarballs whose sha512 equals the registry value byte for byte. Both packages carry ExifTool 13.60 (`$VERSION = '13.60'` in `Image/ExifTool.pm`), so one pin (folder `exiftool-13.60`) serves both. Pins live in `fetch.py` (`PACKAGES`). `FORMTOOLS_EXIFTOOL_REGISTRY` swaps the registry base for a mirror; the integrity pin still decides.

### Package layout (from `npm pack`)

- `.pl` (22 MB unpacked, 297 files, regular files only): `package/bin/exiftool` (the Perl script), `package/bin/lib/Image/ExifTool.pm` and the rest of the library, `arg_files`, `config_files`, `fmt_files`, `README`, `Changes`, and `package/LICENSE`. Run as `perl <folder>/exiftool`; the script finds `lib` beside itself.
- `.exe` (35 MB unpacked, 516 files, regular files only): `package/bin/exiftool.exe` (launcher), `package/bin/exiftool_files/` holding `perl.exe`, `perl532.dll`, `exiftool.pl`, `lib/`, MinGW runtime DLLs, `Licenses_Strawberry_Perl.zip`, and `package/LICENSE`. The launcher must stay beside `exiftool_files`.
- Placed as the contents of `package/bin` into `<data folder>/formtools-binaries/exiftool-13.60/`, plus `NPM-PACKAGE-LICENSE.txt` (the package's `LICENSE`) and `formtools-verified.json` (written last, only after the integrity check, the path check and the version check passed).

### Licence facts

- ExifTool by Phil Harvey, copyright 2003-2026: "free software; you can redistribute it and/or modify it under the same terms as Perl itself (either the Perl Artistic License or GPL)" (`bin/README`, `Image/ExifTool.pm`). Declared for the owner's policy as GPL-1.0-or-later OR Artistic-1.0-Perl. Not linked, not bundled in the formtools installer: it runs as a separate process and is fetched on request, so formtools' own licence is unaffected.
- The npm packaging by Matthew McEachen is MIT (the package `LICENSE` opens with "Vendored ExifTool source ... same terms as Perl itself" and then the MIT text for the npm packaging). The npm `license: MIT` field covers the packaging only, not ExifTool.
- The `.exe` package also holds Strawberry Perl (`perl.exe`, `perl532.dll`; Perl's Artistic or GPL terms), MinGW runtime DLLs (`libgcc_s_seh-1`, `libstdc++-6`, `libwinpthread-1`: GPL with the GCC runtime exception, MIT-style for winpthreads) and `liblzma-5` (public domain), with `Licenses_Strawberry_Perl.zip` (198 files) carrying the texts. `exiftool_files/LICENSE` there is the GPL v3 text. All of it stays in the fetched folder; nothing is redistributed by formtools.
- The fetched folder keeps every licence file the packages ship, so the user's copy is complete.

### Engine decisions

- Lookup order as the contract: `FORMTOOLS_EXIFTOOL` (a file; a bad value is skipped and reported only if nothing else is found), `exiftool` on PATH, the fetched copy. Every candidate is run once with `-ver` (cached by command and mtime) and counts only when it prints a version; `source` is `env`, `path` or `fetched`.
- Data folder: `config.data_dir()/formtools-binaries/exiftool-13.60/`, so `FORMTOOLS_DATA_DIR` moves it with the rest of the per-user data.
- A fetched copy is used only when `formtools-verified.json` matches the pin (version, package, integrity) and the script exists. A folder without a valid marker is replaced on the next fetch.
- Fetch (`POST /api/exif/fetch`, job `exiftool-fetch`): `urllib.request` with its default opener, so `HTTP(S)_PROXY`, `NO_PROXY` and (on macOS and Windows) the system proxy settings apply, and `SSL_CERT_FILE` is honoured. The sha512 is computed while writing and compared in constant time with the pin before anything is unpacked. Download cap 120 MB, unpacked cap 200 MB, 5000 members. Every member name is checked (no absolute name, no backslash, no drive letter, no `..`), links and special files make the whole package refuse, and each file is written by hand to a path that is checked to stay inside the staging folder (no `tarfile.extractall`). Unpacking goes to a scratch folder beside the target, the version string in `Image/ExifTool.pm` must equal 13.60, then the folder is renamed into place. A second POST while one runs returns the running job. When `perl` is missing on macOS or Linux the POST answers 503 with the one-sentence reason instead of downloading something that cannot run.
- Progress: `done` and `total` are bytes of the tarball; `current` names the phase.
- Status error: the failed fetch's sentence, else the env problem, else (macOS and Linux, nothing found, no `perl`) "ExifTool needs Perl and perl was not found on this computer; install Perl or put an ExifTool on PATH."
- Runner: one `-stay_open True -@ -` process per engine behind a lock. Each request is written as one argument per line (paths never touch a shell) ending with `-execute<n>`; the reply is everything before `{ready<n>}`. A pump thread reads stdout into a queue so the 30 s per-file timeout works; stderr is drained by a second thread (last lines kept for the "stopped unexpectedly" sentence). A timeout kills the process and answers 400; a dead process (EOF, broken pipe) is restarted once and the request retried, then 503. The process is also restarted when the resolved command changes (for example right after a fetch). Stopped politely at engine shutdown (`-stay_open False`, then kill); if the engine is killed the child sees end of input and exits by itself.
- Read arguments: `-json -a -G0:1 -struct -l -charset filename=utf8 -api largefilesupport=1` plus `-n` and `-u`. `-l` is not in the contract's list; it is what makes ExifTool put the tag description in the JSON (`desc`), which becomes `label`. Without `-l` there is no description. With `-n` the descriptions stay and values are numbers.
- Group key parsing: `Family0:Family1:Tag` (two parts means both families are the same). Groups sort File, EXIF, XMP, IPTC, Composite, QuickTime, ID3, then every other family 0 by name; inside a family the group whose name equals the family first, then by name. Tags keep ExifTool's order. Copy suffixes like ` (1)` are stripped from names. `ExifTool:Warning` and `ExifTool:Error` become `warnings`; the `ExifTool` group itself is left out of `groups` (the version is its own field and comes from the status check, so it keeps its trailing zero: "13.60").
- Binary values: ExifTool's "(Binary data N bytes, use -b option to extract)" becomes "Binary data, N bytes". Nothing reads or returns bytes.
- Path rules: absolute, no line break (the argument file is line based), must exist (404), not a folder (400), regular file only (400 for devices, pipes), readable (400).
- 415 sentence when ExifTool is unavailable; "still being downloaded" while a fetch runs. `file.size` is the real byte count from `stat`, `type` and `mime` are ExifTool's `FileType` and `MIMEType`.
- MCP `exif_read(path, groups?)`: `groups` keeps groups whose family-1 name or family-0 name matches (case-insensitive), count recomputed. The tool is always registered; availability is in the status route, so `capabilities.tools` lists `exif` always.
- Nothing is fetched automatically; only `POST /api/exif/fetch` downloads.
- No dependency added: standard library only.

### Verification (2026-11-03, Linux x86_64, perl 5.38.2)

`formtools_engine.py --selfcheck` printed ok. Engine on port 8253 with `FORMTOOLS_DATA_DIR=/tmp/ft-exif-data`, `HOME=/tmp/ft-exif-home`, PATH `/usr/bin:/bin` (no exiftool). Status unavailable; read answered 415; fetch job done in about 0.7 s (5,884,456 bytes, integrity matched, `done` equals `total`); status available, source fetched, version 13.60. Reads: JPEG with EXIF and GPS in a folder with a non-ASCII name and a file `foto ñandú 写真.jpg` with spaces, PNG, MP4, WebM, MP3 (ID3), WAV, PDF, TTF, ZIP, all 200 with sensible groups. `numeric=1` gave GPS as numbers, `unknown=1` added tags. Missing file 404, folder 400, relative path 400, `/dev/null` 400. 50 reads in a row on one process: mean 16.7 ms, max 35 ms (a fresh `perl exiftool` per read costs about 316 ms; the first read after start about 183 ms). Killing the exiftool child with SIGKILL: the next read restarted it (278 ms) and the one after reused it (7 ms). MCP `exif_read` through `POST /mcp` with `groups: ["GPS"]` and with a missing path (isError true). A wrong integrity, `..` and absolute names, a drive-letter name and a symlink member each refused with nothing placed. Source order checked: env, then a bad env falls back, PATH, fetched; with no `perl` the status gives the Perl sentence.

### Not done

- Windows (`exiftool-vendored.exe`) is pinned and the code path (launcher command, `CREATE_NO_WINDOW`) is written but was not run here; non-ASCII paths on Windows through the argument file are untested.
- macOS not run.
- No NOTICE or licence file outside this folder was written; the lead adds the NOTICE row.
