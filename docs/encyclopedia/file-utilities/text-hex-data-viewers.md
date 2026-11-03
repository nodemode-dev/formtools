# Text, Code, Hex and Data Viewers

Research date: 2026-11-03.

## Hex viewers and editors

### HxD (Windows)

- Features: RAM editor, raw disk editor (needs admin; hard disks, USB drives, CDs), checksum generator (checksums, CRCs, custom CRC, SHA-1, SHA-512, MD5), simple file compare, statistics view showing byte distribution.
- Platforms: 2.5.0.0 (2021-02) for Windows XP through 10 per the site. Free for private and commercial use; redistribution restricted; not open source.
- formtools note: byte-distribution statistics are a cheap, useful "what is this blob" panel.

### Hex Fiend (macOS)

- Open source, BSD-2-Clause, macOS only. Insert, delete and rearrange bytes (not just overwrite); claimed tested to 118 GB without loading the file in memory; binary diff via File > Compare handling insertions and deletions; saves only changed regions; data inspector for ints and floats in either endianness; scripted binary templates; embeddable framework.
- formtools note: lazy, non-memory-resident file model plus a data inspector is the correct architecture for a hex pane.

### ImHex (cross-platform)

- Search by string, hex, regex, numeric; undo/redo; bookmarks; entropy graph; many hash algorithms; diffing; Capstone disassembler; data inspector; node-based pre-processor; YARA rules; sources include files, raw disks, GDB, process memory, UDP and SFTP.
- Pattern Language: a C-like language to describe structures (arrays, pointers, structs, unions, enums, bitfields, endianness) that colors and parses the file.
- License GPLv2-only, with the core library and UI plugin library LGPLv2.1 so proprietary plugins are possible. Windows, macOS 15+, Linux (several packages), FreeBSD; x86, AMD64, ARM64; needs OpenGL 3.0 or software-render builds.
- formtools note: GPLv2 means study, do not embed; a pattern/template language is the feature that turns a hex viewer into a format inspector.

## SQLite: DB Browser for SQLite

- Visual tool to create, design and edit SQLite files: create and compact databases, tables, indexes, records; run SQL with a log of issued commands; plot simple graphs; import and export CSV and SQL dumps.
- Licenses: GPL-3.0 and MPL-2.0 (with MIT parts and a separate plugin license file). Windows, macOS (10.15 to 14 tested), Linux, FreeBSD. A macOS nightly via Homebrew supports SQLCipher.
- formtools note: a read-only table browser, schema view, and "export as CSV" cover most viewer needs; editing is a separate decision.

## CSV and JSON

- xsv (Rust CSV toolkit, MIT or Unlicense) is archived and unmaintained; its author recommends qsv and xan as successors.
- Quick Look listing mentions QuickLookJSON (free) and paid source preview apps; no dedicated CSV plugin listed on that page.
- XML viewers: not researched in this run. (unverified)
- formtools note: build CSV/JSON viewing on streaming parsers with column type guessing, a sticky header, and filter-by-column; do not depend on xsv.

## Markdown and code preview on macOS

### QLMarkdown

- Quick Look extension plus settings app, an experimental Shortcuts action, and a CLI `qlmarkdown_cli` that converts Markdown to HTML (does not share settings with the extension).
- Engine: cmark-gfm. Supports GFM tables, task lists, strikethrough, autolinks, alerts; definition lists, wikilinks, highlight, sub/superscript; emoji shortcodes; MathJax math; Mermaid diagrams; syntax highlighting. Previews also .rmd, .qmd, .mdc, .apib, textbundle.
- License GPL-3.0.
- formtools note: the cmark-gfm engine (permissive upstream) is the right base; Mermaid and math are optional heavy features.

### Syntax Highlight (SourceCodeSyntaxHighlight)

- Quick Look extension using the Highlight library by Andre Simon; themes with editor, fonts, line numbers, word wrap, custom CSS, Language Server hover and semantic highlighting, Git and Mercurial change marks, hex dump for binary files; CLI `syntax_highlight_cli` outputs HTML or RTF. macOS 10.15+. License GPL-3.0.
- formtools note: the hex-dump fallback for unknown binary types is a good "never show nothing" rule.

### Quick Look plugin ecosystem

- A curated list shows QLMarkdown, FluxMarkdown, and paid markdown viewers; SourceCodeSyntaxHighlight (warns it may override other plugins); BetterZipQL for archives; paid folder and archive previewers. The page did not confirm the state of legacy qlgenerator removal on recent macOS. (unverified)
- formtools note: macOS now favors app-extension Quick Look; plan a preview extension rather than a legacy generator.

## Sources

- https://mh-nexus.de/en/hxd/
- https://github.com/HexFiend/HexFiend
- https://github.com/WerWolv/ImHex
- https://github.com/sqlitebrowser/sqlitebrowser
- https://github.com/BurntSushi/xsv
- https://github.com/sbarex/QLMarkdown
- https://github.com/sbarex/SourceCodeSyntaxHighlight
- https://github.com/sindresorhus/quick-look-plugins
