# desktop HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## 2026-11-03 · v0.5.0 · desktop tool and thumbnailer

### Layout

- `hosts.py` (parse, build, backup, write), `envvars.py`, `elevate.py`, `router.py`, `__init__.py` (tool `desktop`, MCP `hosts_read` and `env_read`), `thumbnail.py`, `formtools.thumbnailer`. The engine dispatches `--thumbnail` to `thumbnail.main` before `--selfcheck`; it never imports uvicorn on that path. It does import the `app.tools.desktop` and `app.tools.image` packages, which pull in fastapi, so a run costs about a second.

### Hosts

- Line model: the file is split into lines that keep their own terminators (`\r\n`, `\n`, `\r`), so CRLF files and a final line without a terminator survive. Decoding is UTF-8 (BOM remembered and rewritten), falling back to latin-1 so any bytes round trip.
- An entry is an active line `address names [# comment]` or a disabled one `# address names [# comment]` whose address is a valid IPv4 or IPv6 (scope ids such as `fe80::1%lo0` accepted) and whose names are all RFC 1123 (labels of 1 to 63 letters, digits and inner hyphens, 253 in all; underscores are not accepted). Anything else, including `# comment text` and malformed lines, is not an entry and is copied through untouched. A comment such as `# 1.2.3.4 is the old server` reads as a disabled entry; that cannot be told apart and is harmless because untouched lines keep their original bytes.
- POST is by line number. Entries with `line` update that line in place (only when a field changed; the original indent and terminator are kept), entries without `line` are appended at the end with the file's dominant line ending, and an existing entry line that the request omits is deleted. A `line` that is not an entry in the file now answers 400 asking for a reload, which also guards against stale tables. Non-entry lines are never removed or reordered.
- A request that changes nothing writes nothing and returns `backup: null`, `changed: false`.
- Backup: `<data>/hosts-backups/hosts-YYYYMMDD-HHMMSS.bak` holds the original bytes, written before any write (a numeric suffix avoids a clash). No retention policy yet.
- `writable` is true when the file can be opened for update (`r+b`), so a read-only mount reports false even for root, and a 444 file reports true for root. A missing file is writable when its folder is.
- Writing: temp file in the same folder, fsync, mode and owner copied, `os.replace`. If that fails (a bind-mounted `/etc/hosts` in a container, a Windows lock) the file is rewritten in place. Permission errors fall to the elevated path. Placement is always bottom for additions (no top option, no loopback duplicate checks, no leading-space option from PowerToys; not asked for).
- Elevation (`elevate.py`), only when the direct write is not possible: macOS `osascript` with `do shell script ... with administrator privileges` copying a staged file; Linux `pkexec /bin/cp` (or `/usr/bin/install -m 644` for a new file); Windows a generated PowerShell script run through `Start-Process -Verb RunAs`. Every path stages the new bytes in a private temp folder, then reads the target back and compares, so a silent failure is reported. A refused, cancelled, timed out or unavailable elevation is a 403 sentence.

### Environment variables

- Scopes: `process` always (read only); Windows adds `user` (`HKCU\Environment`) and `system` (`HKLM\...\Session Manager\Environment`), values read raw so `%VAR%` stays and `REG_EXPAND_SZ` is kept when it was there or when a new value contains `%`; Linux adds `user`; macOS shows `process` only with a `where` sentence.
- Linux user scope: managed file `$XDG_CONFIG_HOME` or `~/.config`, `environment.d/60-formtools.conf`. Writes keep every other line of that file, replace the named variable in place and drop duplicates of it. Rows from the other `.conf` files in the user `environment.d` and in `/etc/environment.d` follow with `readonly: true` and `source`. Values are quoted with double quotes only when they hold anything outside a plain set; `$` is not escaped so `$HOME/bin:$PATH` expands the systemd way. The `60` prefix means it wins over lower numbers; a higher-numbered file can still override it. Changes apply at the next login (the response says so).
- Windows writes go through `winreg`, then `SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0, "Environment", SMTO_ABORTIFHUNG, 5000)`. System scope tries a direct write and falls back to an elevated PowerShell `Set-ItemProperty` or `Remove-ItemProperty` when access is denied, then broadcasts. `winreg` and `ctypes` are imported only inside Windows branches.
- Names: POSIX letters, digits and underscore not starting with a digit; Windows any name without `=`, control characters or edge spaces. Values must stay on one line. Removing a variable that is absent succeeds.
- Not built: profiles, PATH editing helpers and a `/etc/environment` scope (not in the contract).

### Thumbnailer

- `formtools-engine --thumbnail <input> <output.png> <size>`: size clamped to 16..1024; pictures go through `decode.render(path, size)` and are saved as PNG (aspect kept, longest side at most the size); fonts (`ttf otf ttc otc woff woff2`, or a font magic number when there is no extension) get a 2 glyph sample, `Aa` or the first two printable glyphs the font maps, drawn with Pillow on a light square. WOFF and WOFF2 are unwrapped with fontTools first. Exit 0 on success; 1 with one stderr line on failure (nothing is left at the output path); 2 on a bad argument count or size.
- `formtools.thumbnailer` lists the MIME types that `decode.render` and the font path handle and that the stock thumbnailers usually miss: EXR, PSD (and its aliases), DNG, `image/x-dcraw` and every RAW name in shared-mime-info (Canon, Fuji, Kodak, Minolta, Nikon, Olympus, Panasonic, Pentax, Sigma, Sony), Radiance HDR, AVIF, the PNM family, PCX, SGI, TGA, DDS, QOI, ICNS, JPEG 2000, and fonts (TTF, OTF, collections, WOFF, WOFF2, with the legacy `application/x-font-*` names).
- Left out: HEIC and HEIF (the engine only decodes them through an OS helper on macOS and Windows, so a Linux thumbnailer would fail), formvis project files (`fvd`, `fmv`, `formvis` have no MIME type in shared-mime-info; a `shared-mime-info` package file would be needed and is outside this tool folder), `image/radiance` has no shared-mime-info entry either, `image/vnd.radiance` is listed in case a system defines it. `.hdr` files then rely on the type the system guesses.

### Checked

`--selfcheck`; sample hosts file with comments, IPv6, a disabled entry, a malformed line, a scoped address, CRLF and no final newline: GET, an edit plus an add, 400 for a bad address, a bad name and a stale line, a byte exact backup, untouched lines identical, a no-op save writing nothing; a read-only bind mount reported `writable: false` and the save reached the elevation path (403 because pkexec is not installed here); env GET and POST on Linux into a temp `HOME`, quoting round trip, 400s; both MCP tools through `/mcp`; the thumbnailer on a PNG, a 16-bit TIFF, an EXR, a PSD, a TTF, a WOFF2, a corrupt PNG, a corrupt font and a missing file. Not checked: macOS and Windows elevation and the Windows registry code (no such host), a real RAW and a real freedesktop run of the `.thumbnailer`.
