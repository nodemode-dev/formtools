# File Explorer add-ons (Power Preview)

Snapshot: PowerToys 0.102.x. Part 1 (A to F). Repo folder `previewpane`, module key "File Explorer".

## What it does

Registers extra **preview handlers** (the File Explorer Preview pane) and **thumbnail providers** (icons in folder views) for file types Windows does not cover well. Each handler has its own on/off toggle: 13 toggles in total (7 preview, 6 thumbnail), counted from the module constructor.

## Handlers and every file type

Preview pane handlers (7 toggles):

| Handler | Extensions registered | Default |
|---|---|---|
| SVG | .svg | on |
| Markdown | .md .markdown .mdown .mkdn .mkd .mdwn .mdtxt .mdtext | on |
| Source code (Monaco editor) | 221 extensions, listed below | on |
| PDF | .pdf | off (source default) |
| G-code | .gcode | on |
| Binary G-code | .bgcode | on |
| QOI image | .qoi | on |

Thumbnail providers (6 toggles):

| Provider | Extension | Default |
|---|---|---|
| SVG | .svg | on |
| PDF | .pdf | off (source default) |
| G-code | .gcode | on |
| Binary G-code | .bgcode | on |
| STL (3D model) | .stl | on |
| QOI | .qoi | on |

Learn states the source-code handler covers "more than 150" extensions and names only a few; the repo-derived list below is the real registered set at commit bd745f4 (single source: repo; it is built from `monaco_languages.json` at install time minus Markdown, .svg and .svgz, because .svgz is binary and Monaco cannot show it). STL has a thumbnail only, no preview. Markdown and source code have no thumbnail provider, and STL has no preview handler.

Source-code extensions (Monaco handler, 221):

```
.TcDUT .TcGVL .TcIO .TcPOU .abap .aes .ahk .ascx .asp .aspx .azcli .babelrc .bash .bat .bicep .bowerrc .bsh .c .cake .cc .cjs .clj .cljc .cljs .cls .cmd .coffee .config .cpp .cpy .cs .cshtml .csp .csproj .css .csx .ctp .cts .cxx .cyp .cypher .dart .dats .dax .dockerfile .dtd .ecl .editorconfig .edn .env .es6 .eslintrc .ex .exs .flow .fs .fsi .fsproj .fsscript .fsx .ftl .ftlh .ftlx .gemspec .gitattributes .gitconfig .gitignore .go .gql .graphql .gyp .gypi .h .handlebars .har .hats .hbs .hcl .hh .hpp .htm .html .html.liquid .hxx .i3 .iecplc .iecst .ig .inf .ini .ino .ion .jade .jav .java .jl .js .jscsrc .jshintrc .jshtm .json .jsp .jsx .ksh .kt .kts .lc3lib .less .lex .ligo .liquid .log .lua .m .m3 .mdoc .mdx .mg .mjs .ml .mli .mligo .msdax .mts .opf .p .pas .pde .php .php4 .php5 .phtml .pl .pla .pm .pp .pq .pqm .projitems .properties .props .proto .ps1 .psd1 .psm1 .pug .py .pyw .qs .r .razor .rb .rbx .redis .reg .resw .resx .rhistory .rjs .rkt .rlib .rmd .rprofile .rpy .rq .rs .rst .rt .s .sats .sb .sbt .sc .scala .sch .scm .scss .sh .shproj .shtml .sln .sol .sql .srt .ss .st .sv .svh .swift .targets .tcl .tf .tfvars .ts .tsp .tsx .twig .txt .uplugin .uproject .v .vb .vbproj .vbs .vcxproj .vh .vsconfig .wgsl .wsdl .wxi .wxl .wxs .xaml .xhtml .xml .xsd .xsl .xslt .yaml .yml .zsh
```

Several of these are aliases added by PowerToys on top of stock Monaco (for example .ino and .pde as C++, many project files as XML, .sln .log .env as plain text, .reg, .gitignore and .srt with custom grammars).

## Settings

| Handler | Setting | Default (source) |
|---|---|---|
| SVG preview | Background: default, solid colour (#FFFFFF), or checkered with light/medium/dark shade | default mode, light shade |
| Markdown preview | Show local images | off. When on, images load only from the document's folder tree (and the same share for UNC paths); remote images are always blocked. Policy `MarkdownAllowLocalImages` can force it (0.101+). |
| Source code | Wrap text | on |
| | Try to format the source (JSON and XML, preview only) | off |
| | Maximum file size to preview | 50 (the code multiplies by 1000, so 50 KB; Learn says kilobytes) |
| | Font size | 14 pt |
| | Sticky scroll | on |
| | Show minimap | off |
| STL thumbnail | Background / model colour | #FFC924 in source (Learn says "background color") |
| All | Per-handler enable toggles | see tables |

Group Policy: one `ConfigureEnabledUtilityFileExplorer...` value per handler (Bgcode, Gcode, Markdown, Monaco, PDF, QOI, SVG for previews; Bgcode, Gcode, PDF, QOI, STL, SVG for thumbnails) plus the Markdown local-images policy. The Learn table notes a reported conflict between the PDF handler and the Outlook PDF preview handler.

## How it works internally

A registry-based module: when you toggle a handler, PowerToys writes shell registry keys (per user) that bind the extension to a preview-handler or thumbnail-provider COM class implemented in `PowerToys.FileExplorerDLLExporter.dll`. The DLL is a thin class factory that launches a separate out-of-process helper EXE per file (for example `PowerToys.GcodeThumbnailProvider.exe`) using a temp file, so crashes do not take Explorer down. Rendering back ends seen in source: Monaco editor hosted in a WebView2 (source code), WebView2 (SVG thumbnails), Markdig-based Markdown render, Windows PDF APIs (PDF), HelixToolkit (STL, WPF 3D), embedded-thumbnail extraction from G-code comments (G-code and binary G-code, thumbnail size cap 10000 px), and a QOI decoder. Preview-pane background cannot be changed. The 0.102 release fixed previews and SVG thumbnails failing in folders with restricted access. The repo devdoc for this module still has its implementation, debugging and settings sections marked TODO.

## Limitations

- Enabling a handler overrides any other handler for the same extension.
- Preview pane must be enabled in Explorer (View > Preview pane) and the Explorer option "Show preview handlers in preview pane" must be checked.
- A reboot may be needed for thumbnail changes; OneDrive-like cloud folders may show cloud thumbnails instead.
- Transparent images with white shapes can be unreadable because the pane background is fixed.
- Source files above the size limit show an error instead of a preview.

## Cross-platform note

(Analysis.) macOS: Quick Look is the equivalent, built from Preview Extensions (`QLPreviewingController`) and Thumbnail Extensions (`QLThumbnailProvider`) shipped in an app bundle; Markdown, source code and SVG are easy with WKWebView; PDF is native (PDFKit). Linux: thumbnails use the freedesktop thumbnailer spec (`.thumbnailer` files that name a command and MIME types, output to `~/.cache/thumbnails`), consumed by Nautilus, Dolphin, Thunar; previews have no common pane, so Sushi (GNOME), Dolphin's preview panel (KDE) or a formtools-own preview window. MIME types should replace extension lists. The out-of-process helper-per-file design is a good isolation pattern for all platforms.

## formtools note

Define a renderer set as MIME-to-renderer mappings (SVG, Markdown, code, G-code, STL, QOI, PDF), expose them first in formtools' own preview/peek window, then generate Quick Look and freedesktop thumbnailer shims that call the same renderer binary.

## Sources

- https://learn.microsoft.com/en-us/windows/powertoys/file-explorer
- https://learn.microsoft.com/en-us/windows/powertoys/grouppolicy
- https://github.com/microsoft/PowerToys/releases/tag/v0.102.2933.0
- Repo (commit bd745f4): `src/common/utils/modulesRegistry.h`, `src/Monaco/monaco_languages.json`, `src/Monaco/monacoSpecialLanguages.js`, `src/modules/previewpane/powerpreview/powerpreview.cpp`, `src/modules/previewpane/FileExplorerDllExporter/dllmain.cpp`, `src/modules/previewpane/MonacoPreviewHandler/Settings.cs`, `src/modules/previewpane/StlThumbnailProvider/StlThumbnailProvider.csproj`, `src/modules/previewpane/GcodeThumbnailProvider/GcodeThumbnailProvider.cs`, `src/settings-ui/Settings.UI.Library/PowerPreviewProperties.cs`, `doc/devdocs/modules/fileexploreraddons.md`
