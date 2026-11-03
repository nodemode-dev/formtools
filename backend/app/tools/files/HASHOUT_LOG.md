# files tool HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## v0.4.0 (2026-11-03): files, data, archives, checksums

### Layout

| Module | Job |
| --- | --- |
| `archive.py` | format detection by magic bytes (not the extension), one `Archive` class per engine (`zipfile`, `tarfile` streaming mode, single-stream gz bz2 xz zst, libarchive), listing and member reads |
| `safety.py` | name validation, size and ratio budget, no-overwrite naming, temporary file plus link or rename, symlink-safe folder walking |
| `extract.py`, `create.py` | the two jobs `archive-extract` and `archive-create` |
| `hashing.py` | `hash` and `hash-verify` jobs |
| `text.py`, `data.py`, `fonts.py` | `/api/text`, CSV and SQLite, font info and install |
| `router.py`, `__init__.py` | HTTP and the six MCP tools |

### Safe extraction (applies to every engine, because it works on the common `Item` stream)

- A name is refused when it is empty, has a NUL, starts with `/` or `\`, starts with a drive letter, or has a `..` part after splitting on both `/` and `\`. On Windows a part with a colon is refused too (alternate data streams). A refused member is skipped and recorded with `job.error`; the job goes on.
- Every link (symlink or hard link) is skipped and recorded, not only those pointing outside. The contract asks for skipping those that point outside; skipping all is stricter and simpler to prove, and no extracted tree depends on a link. Devices, fifos and sockets are skipped.
- Every folder on the way to a file is checked with `islink` and `realpath` against the real destination, so a link that already exists in the destination cannot redirect a write (proved with a pre-seeded `dirlink -> outside`).
- Files are written to `.formtools-<pid>-<n>-<random>.part` beside the target and then placed with `os.link` (fails if the name appeared meanwhile, then the next ` (n)` name is tried) with `os.rename` as a fallback for file systems without hard links. The temporary file is removed in a `finally`, so a cancelled, failed or over-limit job leaves no partial file. Completed files of a stopped job stay.
- Nothing is overwritten: ` (2)`, ` (3)` before the extension (before `.tar.*` for double extensions). An existing folder is reused (merged); a file in the way of a folder is an error.
- Limits: 20 GB of expanded bytes and 1000 times the archive size, checked against the declared size before writing and against the real bytes while writing. Breaking either fails the job with a plain sentence. Two environment variables lower them for testing: `FORMTOOLS_ARCHIVE_MAX_BYTES` and `FORMTOOLS_ARCHIVE_MAX_RATIO`. No floor is applied to the ratio, so a very small archive of very compressible data can trip it; this follows the contract text.
- Permissions: only the execute bit is kept (as 0755); setuid and setgid are never applied. Modification times are restored.
- Windows `Zone.Identifier`: read from `archive:Zone.Identifier` and written to every extracted file. Not testable on this Linux host; the code path runs only on Windows.
- Encrypted zip members (flag bit 0 or AES) are skipped and recorded. libarchive reports no per-entry flag in the pinned wrapper, so a password-protected 7z or rar fails at read time with a plain sentence.

### Engines

- libarchive is detected at import. `archive.LIBARCHIVE` is true when `libarchive-c` imports and `libarchive.ffi.libarchive_path` is set; otherwise the note holds the reason. Without it, 7z, rar, iso and the rest answer 415 with: "formtools can open zip, tar and single compressed files itself; this archive needs libarchive, which is not installed on this system". Checked by pointing `LIBARCHIVE` at a missing file.
- The `engine` field is `zipfile`, `tarfile` or `libarchive`. Single-stream gz, bz2, xz and zst report `tarfile`, because the contract lists three values only and the stdlib streaming reader is the same family. The `format` field carries the real kind (`gz`, `xz`, `tar.zst`, `7-zip`).
- `size` is null when unknown: bz2 and xz single streams; `packed` is null for tar members of compressed tars and for libarchive entries (no per-entry packed size exists). gz uses the trailer, zst the frame header.
- Tar and tar.* are read in streaming mode (`r|`), also for tar.zst through `zstandard.stream_reader`, so memory stays flat; `tf.members` is cleared per member.
- A file with a zip, jar or Office extension whose first bytes are not `PK` is still opened as zip when `zipfile.is_zipfile` accepts it (self-extracting stubs).

### Create

- `out` is never overwritten: a taken name becomes `name (2).ext` and the result `path` says which. Symbolic links are skipped and recorded, not followed or stored. Tar owners are zeroed. Output is built in a temporary file and linked into place at the end, so cancelling leaves nothing.

### Hash and verify

- All chosen algorithms are computed in one read pass in 1 MiB chunks; `job.total` is the byte total, so progress is in bytes. `crc32` is 8 lowercase hex digits, `blake3` and `xxh64` come from the `blake3` and `xxhash` packages, `md5` and `sha1` are created with `usedforsecurity=False`.
- Verify understands GNU `hex  name` and `hex *name` (with the leading backslash escape), BSD `SHA256 (name) = hex`, `.md5` and the other extension hints, and `.sfv`. Algorithm: BSD tag, then extension (when the digest length fits), then digest length (64 hex means sha256). Paths are relative to the sums file; absolute paths are honoured; a backslash name is retried with slashes. The sums file is parsed before the job starts so an unreadable file answers at once (400). `missing` entries are counted in `missing`, not in `failed`.

### Text

- Order: BOM (utf-32 before utf-16), strict UTF-8, UTF-16 heuristic on the share of NUL bytes at even or odd positions, cp1252 with replacement. A UTF-16 file without BOM is valid UTF-8 byte-wise (ASCII plus NULs), so the heuristic is tried first when NULs are present.
- `max` is a ceiling on the UTF-8 size of the returned text (cp1252 text grows when re-encoded): the text is cut at a character boundary and `truncated` is set. `max` is clamped to 64 MiB; 0 or less answers 400. `lines` counts the returned text.

### Data

- CSV: the delimiter is chosen among `, ; tab |` by how many of the first 60 rows share one column count (tab wins for `.tsv`). Header guess: first row all non-empty, unique, non-numeric, and some later column fully numeric, else the csv Sniffer. Fields up to 16 MB. `total_rows` counts every non-blank record, excluding the header.
- SQLite: magic header checked (415 otherwise), `file:` URI from `Path.as_uri()` plus `?mode=ro`, `PRAGMA query_only=ON`, no `immutable`. Table names come from `sqlite_master` (tables and views, not `sqlite_%`), the requested name must equal one of them, identifiers are double-quoted with doubling, columns read with `pragma_table_info(?)`. Text is decoded with replacement; blobs become `{"blob": n}`; non-finite floats become strings. `limit` is clamped to 5000 rows.

### Fonts

- `fontTools` in lazy mode; collections report the first face and `faces`. `coverage` lists the top 80 Unicode blocks by count (fontTools' own block table). WOFF2 needs `brotli`, which is not pinned, so WOFF2 files answer 415 with a plain sentence; WOFF works. This is the one gap to raise with the lead.
- `installed` is true when the file lies inside a font folder, or a file of the same name and size exists in the per-user or system font folders (scan capped at 30000 files).
- Install: ttf, otf, ttc, otc only (web fonts refused with 415); the file must parse as a font; the copy goes through a temporary file; the same content already installed returns ok with that path; a different file with the same name is a 400. Linux runs `fc-cache -f <folder>` when present; Windows writes the `HKCU` value and calls `AddFontResourceW` (untested here); macOS only copies.

### Left out

- No streaming of members above 64 MB (the contract caps the endpoint). No archive-in-archive recursion. No password entry for encrypted archives.
