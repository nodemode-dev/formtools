# Archivers

Scope: 7-Zip, Keka, The Unarchiver, PeaZip, Windows 11 built-in archive support, and libarchive as the shared engine. Research date: 2026-11-03.

## 7-Zip

- What it is: the reference open-source archiver by Igor Pavlov. Latest version seen on the official site is 26.05 (dated 2026-10-21). Source release notes show an unusually fast cadence in 2025-2026 (25.00, 25.01, 26.00, 26.01, 26.02, 26.03, 26.05).
- Formats, pack and unpack: 7z, XZ, BZIP2, GZIP, TAR, ZIP, WIM.
- Formats, unpack only: a long list including APFS, AR, ARJ, CAB, CHM, CPIO, CramFS, DMG, EXT, FAT, GPT, HFS, ISO, LZH, LZMA, MBR, MSI, NSIS, NTFS, QCOW2, RAR, RPM, SquashFS, UDF, UEFI, VDI, VHD, VHDX, VMDK, XAR, Z.
- Recent format work (release notes): ZSTD unpacking and zstd-compressed ZIP/SquashFS/RPM added in 24.01; RISC-V branch filter in 24.03; ongoing hardening of ZIP, CPIO, RAR, ISO and compound-file handlers through 26.05.
- Compression methods in the 7z container: LZMA (default), LZMA2, PPMd, BZip2, and Copy (store). Branch/transform filters: BCJ, BCJ2, ARM64, ARM, ARMT, PPC, SPARC, IA64, Delta, Swap2/Swap4 (plus RISC-V from 24.03). Features: solid compression, header compression, Unicode names, AES-256 encryption (key derived from the password via a SHA-256 based function with many rounds), self-extracting archives.
- Hashing: the `h` command and shell menu compute checksums. Release notes: XXH64 added in 24.01 and appears in the Windows context menu from 24.03; SHA-512, SHA-384, SHA3-256 and MD5 added in 24.09; CRC-32, CRC-64 and BLAKE2sp sped up. A Debian man page for the `7zz` build lists CRC32, CRC64, SHA1, SHA256 for the `-scrc` switch (older list; the newer algorithms are from the changelog).
- CLI commands: `a` add, `b` benchmark, `d` delete, `e` extract flat, `h` hash, `i` format info, `l` list, `rn` rename inside archive, `t` test, `u` update, `x` extract with paths. Switches: `-m` method, `-mx` level 1 to 9, `-p` password, `-v` volume split, `-t` type, `-si`/`-so` stdin and stdout streaming.
- Platforms: Windows (x64, x86, ARM64) is the primary build. Official Linux console builds (x86-64, x86, arm64, arm) and a macOS console build (arm64 plus x86-64, one download) exist for 23.01 and 26.05. `p7zip` is a separate unofficial port, its last version 16.02 is outdated.
- License: mostly LGPL, some files BSD 3-clause, some files carrying the unRAR restriction (RAR decompression code may not be used to recreate the RAR compressor). The LZMA SDK is public domain. A build flag can strip RAR support entirely.
- Security posture: the changelog lists many CVEs fixed in 2025-2026, including symlink handling during extraction (25.00, 25.01), handler out-of-bounds issues (26.01), an XZ heap overflow (26.02) and Mark-of-the-Web not preserved for crafted archives (26.03). Archive parsers are a recurring attack surface.
- formtools note: use 7-Zip's format list as the "must open" checklist, and treat its symlink and Mark-of-the-Web fixes as a required safe-extraction test suite.

## Keka (macOS)

- Compress to: 7Z, ZIP, TAR, GZIP, BZIP2, XZ, LZIP, DMG, ISO, BROTLI, ZSTD, LRZIP, AAR, WIM.
- Extract from: more than 30 formats including ZIP, ZIPX, RAR, 7Z, TAR, ISO, CAB, MSI, JAR, APK, IPA.
- Workflow: drop files on the Dock icon or window to compress, AES-256 for 7Z, legacy Zip 2.0 encryption for ZIP, split into volumes for size limits.
- Platforms: macOS 10.10 or newer for v1.6.8, legacy builds for older macOS, an iOS app exists. Distribution: Mac App Store (supports development) plus direct download.
- License: the site gives no license statement; the GitHub repo exists but a license file was not confirmed. Engine not stated on the pages fetched. (single source)
- formtools note: Keka's drop-onto-icon compress model and a short, honest format picker is the UX bar for a macOS-first archive entry point.

## The Unarchiver

- Extract-only utility focused on breadth: ZIP, ZIPX, RAR (encrypted and multi-volume), 7z, TAR, GZIP, BZIP2, LZMA/XZ, CAB, MSI, NSIS, disc images (ISO, BIN, MDF, NRG, CDI), split files (.001, .002).
- Legacy and exotic: StuffIt, DiskDoubler, Compact Pro, LZX, Amiga formats (via libxad), LZH, ARC, Zoo, XAR, RPM, Deb, WARC, Nintendo DS ROMs. SWF and PDF only for extracting embedded media.
- Platforms: macOS app, an iOS app named Archives, a command line tool whose code is reused on other operating systems. Free; no explicit license named on the page. (single source)
- Notable behaviors: filename-encoding detection for non-Latin names, set-as-default for all archive types.
- formtools note: legacy-format coverage is a long tail; ship the common set first and make filename encoding detection a first-class feature.

## PeaZip

- Archive manager plus file manager, with encryption, two-factor authentication, an encrypted password manager, secure delete, archive conversion, split and join, comments, in-archive search, and file hashing tools.
- Formats: reads and writes 7Z, ZIP, TAR, GZ, BZ2, Brotli, Zstandard, PEA (own format), and more; claims over 200 types and variants including ACE, ARJ, CAB, CHM, CPIO, DEB, ISO, LHA, NSIS, PAQ/LPAQ, QUAD, RAR, RPM, split archives. Uses third-party backends for many formats.
- CLI angle: any GUI task can be exported as a command-line script, a useful bridge between GUI and automation.
- Platforms: Windows (x86, x86-64), Linux (x86-64, aarch64), macOS (Intel and Apple Silicon), BSD (x86-64). License: LGPL-3.0.
- Caveat: the official site blocks automated fetching, so details here come from the GitHub README only. (single source)
- formtools note: "export this task as a script" is a cheap, high-value pattern for a GUI-first suite.

## Windows 11 built-in archive support (status 2026)

- Microsoft states that Windows 11 version 24H2 can open and extract ZIP, RAR, 7z and TAR. An earlier Windows developer post says native support for tar, 7-zip, rar, gz and more is built on libarchive.
- Creation: documented steps cover only ZIP via Send to > Compressed (zipped) folder. Microsoft's page speaks of compression for other formats but does not confirm which ones File Explorer can create. Treat creation of 7z and TAR from Explorer as unconfirmed.
- Encrypted archives are not supported by the built-in tool; Microsoft points to third-party tools such as 7-Zip or WinRAR for them.
- No compression level or option UI is documented.
- formtools note: on Windows, assume Explorer handles basic extraction, and differentiate on encryption, creation options, volumes, and listing without extracting.

## libarchive (shared engine)

- Multi-format reading and writing library. Read: tar variants, cpio, ISO9660, ZIP/ZIPX, ar, mtree, 7-Zip, CAB, LHA/LZH, RAR and RAR5, WARC, XAR. Write: ustar, pax, GNU/V7 tar, cpio, shar, ZIP/ZIPX, ar, mtree, ISO9660, 7-Zip, WARC, XAR. Filters: gzip, bzip2, xz/lzma, lz4, lzop, zstd, uuencode, base64.
- Tools: `bsdtar` and `bsdcpio`.
- Latest release seen: 3.8.10 (October; year not shown on the page), adding extra 7z filters (Delta, RISCV, ARMTHUMB, IA64) and a tar `--mode` option.
- License: BSD-style for most sources; a few files public domain or UC Regents 3-clause; BLAKE2 files under CC0, OpenSSL or Apache 2.0; build scripts vary.
- formtools note: libarchive is the pragmatic permissive core for a cross-platform viewer, with 7-Zip's engine as a heavier optional backend for rarer formats.

## Sources

- https://7-zip.org/
- https://7-zip.org/7z.html
- https://7-zip.org/download.html
- https://7-zip.org/history.txt
- https://raw.githubusercontent.com/ip7z/7zip/main/DOC/readme.txt
- https://manpages.debian.org/testing/7zip/7zz.1.en.html
- https://github.com/ip7z/7zip
- https://github.com/peazip/PeaZip
- https://www.keka.io/en/
- https://github.com/aonez/Keka
- https://theunarchiver.com/
- https://github.com/libarchive/libarchive
- https://raw.githubusercontent.com/libarchive/libarchive/master/COPYING
- https://github.com/libarchive/libarchive/releases
- https://support.microsoft.com/en-us/windows/experience/storage-filemanagement/zip-and-unzip-files
- https://blogs.windows.com/windowsdeveloper/2023/09/26/new-experiences-designed-to-make-every-developer-more-productive-on-windows-11/
