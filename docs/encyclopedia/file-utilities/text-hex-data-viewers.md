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
- XML viewers: see the XML viewers section below.
- formtools note: build CSV/JSON viewing on streaming parsers with column type guessing, a sticky header, and filter-by-column; do not depend on xsv.

## XML viewers

### XML Notepad (Windows)

- Microsoft open-source tool (MIT licence file in the repository) for browsing and editing XML in a tree. Features listed in its readme: XML Schema aware IntelliSense, a Find dialog that supports XPath, XInclude, XSLT transforms with an inline viewer for the output, automatic conversion of .csv, .json and .html files, document statistics, and an XML diff of two similar documents.
- Windows only. Installs by ClickOnce, a standalone MSI zip, an MSIX in each GitHub release, or winget (the readme warns winget lags).
- formtools note: tree view plus XPath find plus XML diff is the right feature floor for a read-only XML pane; the conversion of CSV, JSON and HTML into XML is a niche to skip.

### xmllint (libxml2 command line)

- Part of libxml2, the library behind much XML tooling; the vendor manual lists these options among others: --format and --pretty for reindenting, --noblanks, --nocdata, --noout, --xpath, --stream for large inputs, --html for HTML input, --c14n and --c14n11 for canonical form, --shell for an interactive session, and validation against a DTD (--valid), RELAX NG (--relaxng), XML Schema (--schema) or Schematron (--schematron).
- Cross-platform, scriptable. The copyright file path tried (raw Copyright on the master branch) returned 404, so the licence was not confirmed from the repository here; libxml2 is widely known as MIT, but that is general knowledge, not sourced. (unverified)
- formtools note: shelling out is not needed; the capability list (pretty-print, XPath query, schema validate, streaming for big files) is the checklist for an in-process XML pane.

### Notepad++ XML Tools plugin (Windows)

- Third-party plugin by Nicolas Crittin, listed in the Notepad++ official plugin list. Per that list it is MSXML-based and offers XML syntax check, XSD and DTD validation, tag autoclose, pretty print, linearize, current XML path, XML to text conversion, comment toggling and XPath evaluation. Licence in the repository: GPL (version 3 text).
- Because it depends on MSXML it is Windows only; the plugin list marks the 64-bit build as 3.1.1.13.
- formtools note: GPL and MSXML both rule out reuse; use it only as a feature reference.

### Oxygen XML Editor (commercial)

- Commercial editor sold as Professional and Enterprise editions. The product page lists an XML grid editor, outline view, XInclude, validation, format and indent, XPath support, an XSD editor and diagram, XSLT editor and debugger, and Schematron among its schema languages.
- Licensing on the buy page is Perpetual licence with 1-year or 2-year maintenance (SMP) or a 12-month subscription. Prices are not in the static page text, so no figure is recorded. (unverified)
- formtools note: shows the ceiling of the category (schema-aware editing and debugging); far beyond what a family viewer needs.

### Browsers

- Not researched: whether current browsers render a collapsible XML tree is general knowledge only and was not sourced. (unverified)

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
- https://github.com/microsoft/XmlNotepad (cloned; readme.md and LICENSE read from the clone)
- https://raw.githubusercontent.com/microsoft/XmlNotepad/master/LICENSE
- https://gnome.pages.gitlab.gnome.org/libxml2/xmllint.html
- https://raw.githubusercontent.com/libxml2/libxml2/master/Copyright (404)
- https://raw.githubusercontent.com/notepad-plus-plus/nppPluginList/master/doc/plugin_list_x64.md
- https://raw.githubusercontent.com/morbac/xmltools/master/LICENSE
- https://www.oxygenxml.com/xml_editor.html
- https://www.oxygenxml.com/buy.html
