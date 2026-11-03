# Utility Landscape: Categories and Engines

Research date: 2026-11-03. Summary of the other files in this folder.

## Categories at a glance

| Category | Representative tools | Typical open engines |
|---|---|---|
| Archives | 7-Zip, PeaZip, Keka, The Unarchiver, Windows 11 Explorer | libarchive, 7-Zip/LZMA SDK, zstd, unrar-restricted code |
| Hashing | 7-Zip menu, HashCheck, RHash, Get-FileHash | xxHash, BLAKE3, RHash |
| Duplicates | Czkawka/Krokiet, dupeGuru | Rust/Python hash pipelines, perceptual hashing, ffmpeg |
| Bulk rename | Advanced Renamer, Bulk Rename Utility, F2, PowerRename | ExifTool (Advanced Renamer credits it), regex engines |
| Fonts | Font Book, FontBase | FreeType, HarfBuzz, fontTools, OTS |
| Hex, text, data | HxD, Hex Fiend, ImHex, DB4S, QLMarkdown | cmark-gfm, Highlight, SQLite, Capstone |
| Disk usage | WinDirStat, WizTree, GrandPerspective, DaisyDisk, ncdu, dust | native scan APIs, NTFS MFT reading |
| Capture and clipboard | ShareX, Flameshot, CleanShot X, CopyQ | Tesseract, platform OCR |
| PDF light | PDF24, Stirling-PDF | qpdf, pdfcpu, Ghostscript, Tesseract |

## Engine and license table

| Engine | Purpose | License | Fit for a permissive suite |
|---|---|---|---|
| libarchive | multi-format archive read/write, bsdtar | BSD-style, few files with other terms (BLAKE2 CC0/OpenSSL/Apache) | yes |
| 7-Zip source | broad format support, LZMA/LZMA2 | LGPL, BSD parts, unRAR restriction; LZMA SDK public domain | yes as a separate binary or with LGPL compliance |
| zstd | fast compression, RFC 8878 | BSD or GPLv2 dual | yes (choose BSD) |
| xxHash | non-cryptographic hashing | library BSD, `xxhsum` CLI GPL | yes for the library |
| BLAKE3 | fast cryptographic hash | CC0 or Apache-2.0 | yes |
| RHash | many digests | 0BSD | yes |
| FreeType | glyph rendering | FTL or GPLv2 | yes (FTL, with credit) |
| HarfBuzz | shaping, subsetting | not confirmed on page | verify |
| fontTools | font IO | MIT | yes |
| OTS | font sanitizing | BSD-3-Clause | yes |
| cmark-gfm | Markdown to HTML | upstream license not read here | verify |
| Tesseract | OCR | Apache-2.0 | yes |
| qpdf | PDF structure ops | Apache-2.0 | yes |
| pdfcpu | PDF ops in Go | Apache-2.0 | yes |
| Ghostscript | PDF/PS rendering | AGPL or commercial | avoid unless AGPL is acceptable |
| ImHex, HexFiend, Czkawka GUI | apps | GPLv2, BSD-2, MIT/GPL-3.0 | study only (ImHex, Krokiet are copyleft) |
| Stirling-PDF | PDF suite | MIT root plus separately licensed directories | per-directory check |

## Cross-cutting observations

1. Archive parsers keep producing CVEs (7-Zip 2025-2026 changelog); isolate extraction, block path traversal and unsafe symlinks, preserve Mark-of-the-Web.
2. Windows 11 24H2 reads ZIP, RAR, 7z and TAR natively via libarchive but leaves encryption, rich creation options and format breadth to third parties.
3. Fast non-cryptographic hashes (xxHash) suit duplicate pre-filtering; cryptographic hashes suit user-facing verification.
4. Safe-by-default patterns recur: dry run (F2), reference folders (Czkawka), trash before delete, three-state validation (Font Book).
5. Several tools are one-person or lightly maintained (HashCheck, dupeGuru, xsv archived, Peek abandoned); prefer engines to wrapping apps.
6. Scriptability is a differentiator: CLI flags for scans (WinDirStat), captures (Flameshot), clipboard (CopyQ), renames (F2), task export (PeaZip).

## Gaps from this research

PeaZip official site, Windows font docs and Font Validator, macOS shasum man page, Finder batch rename help, XML viewers, and HarfBuzz and cmark-gfm license text were not retrievable or not fetched.

## Sources

All sources are listed in the category files: archivers.md, hashing.md, duplicate-finders.md, bulk-renamers.md, font-viewers.md, text-hex-data-viewers.md, disk-usage.md, capture-and-clipboard.md, pdf-light-utilities.md. Additional URLs fetched:

- https://github.com/facebook/zstd
- https://github.com/Cyan4973/xxHash
- https://github.com/BLAKE3-team/BLAKE3
- https://github.com/rhash/RHash
- https://freetype.org/license.html
