# Hashing, Checksums and File Integrity

Research date: 2026-11-03.

## Algorithm families worth supporting

| Family | Role | Notes |
|---|---|---|
| CRC32, CRC64 | error detection | In 7-Zip's hash list, extremely fast, not tamper-proof. |
| MD5, SHA-1 | legacy checksums | Microsoft's Get-FileHash docs say both are no longer secure; use only for change detection. |
| SHA-256, SHA-384, SHA-512 | default integrity | SHA-256 is Get-FileHash's default. |
| SHA3-256 | newer NIST option | Added to 7-Zip in 24.09. |
| BLAKE2sp (7-Zip), BLAKE3 | fast cryptographic | BLAKE3 is multithreaded, SIMD-optimized, CC0 or Apache 2.0, with `b3sum` CLI. |
| XXH32, XXH64, XXH3, XXH128 | non-cryptographic speed | xxHash reports roughly 10 to 30 GB/s on its reference machine versus under 1 GB/s for SHA-1 and MD5. Library BSD, `xxhsum` CLI GPL. |

## 7-Zip hashing

- CLI `7z h` computes hashes; the same algorithm family is reachable from the Windows shell "CRC SHA" menu.
- Changelog: XXH64 (24.01), SHA-512/384, SHA3-256, MD5 (24.09), and BLAKE2sp/XXH64 shown in the context menu (24.03).
- The `-scrc` switch on `x`, `e`, `h` selects the method (older man page lists CRC32, CRC64, SHA1, SHA256).
- formtools note: expose "pick algorithm, drop file, copy digest, compare to pasted digest" as one dialog, with the algorithm list mirroring 7-Zip's.

## HashCheck (Windows shell extension)

- Fork adding SHA-2, SHA-3 and multithreading to the original code.kliu.org project; adds a file-properties tab and verification of checksum files.
- License: BSD 3-clause. Targets Windows Vista and later; project has many open issues (60) and modest recent activity, so treat as unmaintained-leaning.
- formtools note: the properties-tab model (hash on demand, verify against a sidecar file) is the right integration point for file managers.

## RHash

- Command line and library. Algorithms include CRC32, CRC32C, MD4, MD5, SHA1, SHA2, SHA3, Tiger, Whirlpool, RIPEMD-160, GOST variants, and P2P hashes (AICH, ED2K, TTH, BTIH). Computes magnet links, recurses into directories, verifies and updates hash files.
- License: 0BSD. Platforms: Linux, Unix, macOS, Windows.
- formtools note: RHash is the most permissive, broadest engine if multi-algorithm verify-and-update of checksum files is wanted.

## Platform built-ins

- PowerShell `Get-FileHash`: SHA1, SHA256, SHA384, SHA512, MD5; default SHA256; accepts streams; returns Algorithm, Hash, Path.
- `certutil -hashfile <file> <alg>`: documented on Microsoft Learn; Microsoft warns it is not meant for production code.
- macOS `shasum` and Linux coreutils `*sum`: the man pages could not be fetched under the allowed sources in this run, so their option lists are not documented here. (unverified)
- HxD and ImHex also include checksum and hash tooling for selections (see text-hex-data-viewers.md).
- formtools note: shell out to nothing; implement hashing in-process with a streaming API so progress and cancel work.

## File integrity workflows

- Verify download: paste published digest, compare case-insensitively, show match or mismatch clearly.
- Verify a set: read `SHA256SUMS`-style sidecar files (RHash and HashCheck do this).
- Archive integrity: 7-Zip `t` tests every entry against stored CRCs.
- Duplicate detection reuses the same primitives (see duplicate-finders.md).

## Sources

- https://7-zip.org/history.txt
- https://manpages.debian.org/testing/7zip/7zz.1.en.html
- https://github.com/gurnec/HashCheck
- https://github.com/rhash/RHash
- https://github.com/Cyan4973/xxHash
- https://github.com/BLAKE3-team/BLAKE3
- https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/get-filehash
- https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/certutil
- https://mh-nexus.de/en/hxd/
- https://github.com/WerWolv/ImHex
