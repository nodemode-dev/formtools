<p align="center">
  <img src="assets/app-icon/formtools-256.png" width="128" height="128" alt="FormTools icon: a dark rounded square holding a window with a photo, a waveform, a 3D cube, text lines and a column of tool switches">
</p>

<h1 align="center">FormTools</h1>

<p align="center">
  <b>Media and file utilities; the Form family's utility belt.</b><br>
  Viewers for almost any file, batch image tools, 3D viewing and desktop utilities,<br>
  in one window with no account. Local, and yours.
</p>

<p align="center">
  <img alt="version 0.6.2" src="https://img.shields.io/badge/version-0.6.2-eef0f4?style=flat-square">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-Vite-3178c6?style=flat-square&logo=typescript&logoColor=white">
  <img alt="Python FastAPI engine" src="https://img.shields.io/badge/Python-FastAPI-009688?style=flat-square">
  <img alt="macOS, Windows, Linux" src="https://img.shields.io/badge/macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-native-2f7bf5?style=flat-square">
  <img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-3a3a3a?style=flat-square">
  <img alt="Status: alpha" src="https://img.shields.io/badge/status-alpha-d69e2e?style=flat-square">
</p>

<p align="center">
  <a href="https://formai.studio/"><b>Download FormTools on formai.studio</b></a> ·
  <a href="#run-it-from-source">Run it from source</a> ·
  <a href="#the-form-family">All Form apps</a>
</p>

<br>

<p align="center">
  <img src="docs/images/formtools-hero.png" alt="The FormTools folder browser showing twelve CC0 photos as thumbnails, with star ratings and colour labels on several of them and two selected" width="100%">
  <br>
  <sub>The folder browser: thumbnails, star ratings, colour labels and multi-select.</sub>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#everything-in-the-box">In the box</a> ·
  <a href="#built-for-agents">Agents</a> ·
  <a href="#under-the-hood">Under the hood</a> ·
  <a href="#download">Download</a> ·
  <a href="#run-it-from-source">Run from source</a> ·
  <a href="#the-form-family">Form family</a>
</p>

<br>

<table>
  <tr>
    <td width="25%" valign="top"><h3>View anything</h3>Open RAW, HDR, EXR, PSD, video, audio, 3D models, fonts, PDFs, databases and archives in one app.</td>
    <td width="25%" valign="top"><h3>Batch images</h3>Convert, resize and rename whole folders with an ordered action pipeline, a live preview and shared presets.</td>
    <td width="25%" valign="top"><h3>Desktop utilities</h3>Colour picker, screen ruler, text extractor, zoom and draw, break timer and more, on global shortcuts.</td>
    <td width="25%" valign="top"><h3>Agent-ready</h3>The same engine from the window, the CLI and an MCP server with 30 tools.</td>
  </tr>
</table>

## Features

<table>
  <tr>
    <td width="33%" valign="top">
      <img src="docs/images/formtools-image-info.webp" alt="The image viewer with a Venice sunset photo and the information panel open, showing rating, colour label, histogram and file details" width="100%">
      <br><sub>The image viewer with the information panel.</sub>
      <h3>Image viewer</h3>Crop, resize, save as, compare and inspect pixels. Rate and label from the keyboard.
    </td>
    <td width="33%" valign="top">
      <img src="docs/images/formtools-batch-convert.webp" alt="Batch convert with twelve photos listed, a resize action, WebP output and a live preview" width="100%">
      <br><sub>Batch convert: twelve photos, a resize action, WebP output.</sub>
      <h3>Batch convert</h3>Chain actions, pick a format and naming tokens, check the names, then convert. Undo is built in.
    </td>
    <td width="33%" valign="top">
      <img src="docs/images/formtools-3d-viewer.webp" alt="The 3D viewer showing a brass lantern glTF model on a grid with triangle and vertex counts" width="100%">
      <br><sub>The 3D viewer with a glTF lantern.</sub>
      <h3>3D viewer</h3>View, measure and inspect models, play animation, and convert to glTF, GLB or USDZ.
    </td>
  </tr>
</table>

## Everything in the box

<table>
  <tr>
    <td width="33%" valign="top"><h4>Viewers</h4>Folder browser · Image viewer · Player · Media info · 3D viewer · Text, code and data · Archives · Fonts · Form projects</td>
    <td width="33%" valign="top"><h4>Tools</h4>Batch convert · Resize · Rename · Checksums · Duplicates · Disk usage · Clean up · New from template · Who has this open</td>
    <td width="33%" valign="top"><h4>Formats</h4>Opens: JPEG, PNG, WebP, AVIF, TIFF, RAW, PSD, EXR, HDR, SVG, GIF, JXL, HEIC, MP4, glTF, CSV, JSON, SQLite, PDF · Saves: JPEG, PNG, WebP, AVIF, TIFF, BMP, GIF</td>
  </tr>
</table>

Desktop utilities: colour picker · screen ruler · text extractor · zoom and draw · break timer · Awake · always on top · hosts file · environment variables.

## Built for agents

30 MCP tools, one engine; the window, the CLI and the MCP server call the same code.

```sh
./formtools cli convert --format webp --out ~/Pictures/web ~/Pictures/trip   # batch convert
./formtools cli resize --longest 2048 ~/Pictures/trip                        # resize
./formtools cli rename --find IMG_ --replace trip- --counter ~/Pictures/trip # print the plan; add --apply
./formtools mcp                                                              # MCP server on stdio for Claude Code, Codex and Cursor
```

`.mcp.json`, `.codex/config.toml` and `.cursor/mcp.json` are already wired in this repo. See [`AGENTS.md`](AGENTS.md).

## Under the hood

- **Window:** vanilla TypeScript and Vite, on port 5240 in development.
- **Engine:** Python and FastAPI on 127.0.0.1:8240, with 8 tool modules registered at start.
- **Desktop:** a Tauri 2 shell that starts its own engine on a free port.
- **Local:** every file is read on this computer and nothing is uploaded.
- **Media:** FFmpeg (LGPL build) for playback, inspection and lossless clips; transcoding stays in FormEncoder.
- **Checked in CI:** frontend build, type check, byte-compile of the engine and the agents kit.

## Download

**Get the app:** download FormTools from [formai.studio](https://formai.studio/). That is the easiest way to install it.

**Keep it updated:** [FormPortal](https://github.com/nodemode-dev/formportal) installs, updates and rolls back every Form app from the same signed catalogue.

Not released yet. Run it from source below.

Builds are compiled and released from [`nodemode-dev/formcompiler`](https://github.com/nodemode-dev/formcompiler/releases), not from this repo. This repo holds the source.

## Run it from source

Prefer it in your browser, or want to contribute? Run the web UI straight from this repo.

**Requires:** Python 3.12 or newer, and Node.js 20.19+ or 22.12+. The desktop window also needs Rust.

```sh
git clone git@github.com:nodemode-dev/formtools.git
cd formtools
./formtools_oc_install     # backend venv, Python packages, frontend packages
./formtools                # engine on :8240 and the web UI at http://127.0.0.1:5240
```

The engine listens on 127.0.0.1:8240 (`FORMTOOLS_PORT`). `./formtools desktop dev` opens the desktop window instead (run `./formtools install-desktop` first). On Windows use `formtools_oc_install.bat` and `formtools.bat`.

> [!IMPORTANT]
> **Status:** alpha. Features are broad and still being hardened; the 3D viewer needs WebGL. See [`CHANGELOG.md`](CHANGELOG.md).

**Contributing:** branch from `main`, keep changes to source here, and leave packaging and releases to FormCompiler. See [`AGENTS.md`](AGENTS.md).

## Repository

| Path | What it is |
|---|---|
| `frontend/` | Vanilla TypeScript and Vite window: Home, browser, viewer, Preferences, command palette |
| `backend/` | Python and FastAPI engine: file listing, image decoding, project reader, MCP |
| `src-tauri/` | Tauri 2 desktop shell: splash, window, menus, file dialogs |
| `setup/` | The scripts behind `./formtools` |
| `docs/` | Encyclopedia of comparable tools and how FormTools reads Form project files |

Docs: [`docs/encyclopedia`](docs/encyclopedia) · Agents: [`CLAUDE.md`](CLAUDE.md), [`AGENTS.md`](AGENTS.md)

## The Form family

FormTools is one of the **Form apps**: native creative tools that install, update and roll back through FormPortal and can all be driven by agents.

| | App | What it's for | Download | Code |
|:-:|---|---|---|---|
| <img src=".github/assets/family/form.md.png" alt="" width="32" height="32"> | **form.md** | Documents, databases and realtime editing together | [formai.studio](https://formmd.formai.studio/) | [GitHub](https://github.com/nodemode-dev/form.md) |
| <img src=".github/assets/family/format.png" alt="" width="32" height="32"> | **FormAT** | Chat and agent workspace on your key | [formai.studio](https://format.formai.studio/) | [GitHub](https://github.com/nodemode-dev/format) |
| <img src=".github/assets/family/formCAD.png" alt="" width="32" height="32"> | **FormCAD** | Drafting, parametric parts and NURBS surfaces | | [GitHub](https://github.com/nodemode-dev/formCAD) |
| <img src=".github/assets/family/formcel.png" alt="" width="32" height="32"> | **FormCel** | Spreadsheets agents can read and edit | [formai.studio](https://formcel.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcel) |
| <img src=".github/assets/family/formcraft.png" alt="" width="32" height="32"> | **FormCraft** | Generate images, video, audio, 3D and worlds | | [GitHub](https://github.com/nodemode-dev/formcraft) |
| <img src=".github/assets/family/formcut.png" alt="" width="32" height="32"> | **FormCut** | Multi-track video editing with no upload | [formai.studio](https://formcut.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcut) |
| <img src=".github/assets/family/formDAM.png" alt="" width="32" height="32"> | **FormDAM** | Photo library and asset manager | [formai.studio](https://formdam.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formDAM) |
| <img src=".github/assets/family/formdeck.png" alt="" width="32" height="32"> | **FormDeck** | Presentations and pitch decks | [formai.studio](https://formdeck.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formdeck) |
| <img src=".github/assets/family/formdesign.png" alt="" width="32" height="32"> | **FormDesign** | Page layout for print and the web | [formai.studio](https://formdesign.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formdesign) |
| <img src=".github/assets/family/formencoder.png" alt="" width="32" height="32"> | **FormEncoder** | Media encoding queue with presets | [formai.studio](https://formencoder.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formencoder) |
| <img src=".github/assets/family/formfabric.png" alt="" width="32" height="32"> | **FormFabric** | Sewing patterns draped with cloth simulation | | [GitHub](https://github.com/nodemode-dev/formfabric) |
| <img src=".github/assets/family/formlit.png" alt="" width="32" height="32"> | **FormLit** | Photo library and raw development | [formai.studio](https://formlit.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formlit) |
| <img src=".github/assets/family/formmorpheus.png" alt="" width="32" height="32"> | **FormMorpheus** | Frame-by-frame and performed animation | | [GitHub](https://github.com/nodemode-dev/formmorpheus) |
| <img src=".github/assets/family/formNET.png" alt="" width="32" height="32"> | **FormNET** | See what your computer sends online | | [GitHub](https://github.com/nodemode-dev/formNET) |
| <img src=".github/assets/family/formpath.png" alt="" width="32" height="32"> | **FormPath** | Vector illustration with artboards and type | [formai.studio](https://formpath.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpath) |
| <img src=".github/assets/family/formpdf.png" alt="" width="32" height="32"> | **FormPDF** | Edit, redact, sign and fill PDFs | [formai.studio](https://formpdf.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpdf) |
| <img src=".github/assets/family/formpromo.png" alt="" width="32" height="32"> | **FormPromo** | Promo films from your own media | [formai.studio](https://formpromo.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formpromo) |
| <img src=".github/assets/family/formref.png" alt="" width="32" height="32"> | **FormRef** | Reference boards for creative work | [formai.studio](https://formref.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formref) |
| <img src=".github/assets/family/formrig.png" alt="" width="32" height="32"> | **FormRig** | Rig, skin and retarget any mesh | | [GitHub](https://github.com/nodemode-dev/formrig) |
| <img src=".github/assets/family/formsculpt.png" alt="" width="32" height="32"> | **FormSculpt** | 3D sculpting, remeshing and painting | [formai.studio](https://formsculpt.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formsculpt) |
| <img src=".github/assets/family/formsurface.png" alt="" width="32" height="32"> | **FormSurface** | Texture painting with PBR export | [formai.studio](https://formsurface.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formsurface) |
| <img src=".github/assets/family/formtools.png" alt="" width="32" height="32"> | **FormTools** | Viewers, batch tools and file utilities | | [GitHub](https://github.com/nodemode-dev/formtools) |
| <img src=".github/assets/family/formtxt.png" alt="" width="32" height="32"> | **FormTxt** | Word processing with .docx round trips | [formai.studio](https://formtxt.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formtxt) |
| <img src=".github/assets/family/formvfx.png" alt="" width="32" height="32"> | **FormVFX** | Motion graphics and VFX compositing | [formai.studio](https://formvfx.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formvfx) |
| <img src=".github/assets/family/formvis.png" alt="" width="32" height="32"> | **FormVis** | Layered image editing with local AI | [formai.studio](https://formvis.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formvis) |
| <img src=".github/assets/family/formwav.png" alt="" width="32" height="32"> | **FormWav** | Multitrack audio editing and mixing | [formai.studio](https://formwav.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formwav) |
| <img src=".github/assets/family/formweb.png" alt="" width="32" height="32"> | **FormWeb** | Visual website building with a CMS | [formai.studio](https://formweb.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formweb) |
| <img src=".github/assets/family/formportal.png" alt="" width="32" height="32"> | **FormPortal** | Install, update and roll back Form apps | [formai.studio](https://formportal.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formportal) |
| <img src=".github/assets/family/formtray.png" alt="" width="32" height="32"> | **FormTray** | One dock icon for every app | [formai.studio](https://formtray.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formtray) |
| <img src=".github/assets/family/formMCP.png" alt="" width="32" height="32"> | **FormMCP** | One MCP connection to the family | [formai.studio](https://formmcp.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formMCP) |
| <img src=".github/assets/family/formskills.png" alt="" width="32" height="32"> | **FormSkills** | Every app's agent skills in one place | [formai.studio](https://formskill.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formskills) |
| <img src=".github/assets/family/formbench.png" alt="" width="32" height="32"> | **FormBench** | Parity, testing and rankings for the family | [formai.studio](https://formranker.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formbench) |
| <img src=".github/assets/family/formslot.png" alt="" width="32" height="32"> | **FormSlot** | Codebase memory for coding agents | | [GitHub](https://github.com/nodemode-dev/formslot) |
| <img src=".github/assets/family/subform.png" alt="" width="32" height="32"> | **SubForm** | Workbench for parallel Claude Code agents | | [GitHub](https://github.com/nodemode-dev/subform) |
| <img src=".github/assets/family/formcompiler.png" alt="" width="32" height="32"> | **FormCompiler** | Builds, signs and releases every app | [formai.studio](https://formcompiler.formai.studio/) | [GitHub](https://github.com/nodemode-dev/formcompiler) |
| <img src=".github/assets/family/formpipe.png" alt="" width="32" height="32"> | **FormPipe** | Release pipeline and update feeds | | [GitHub](https://github.com/nodemode-dev/formpipe) |

<br>

---

## Maintainers

| Maintainer | Role |
|---|---|
| [@nodemode-ai](https://github.com/nodemode-ai) | Owner |
| [@gbarnai](https://github.com/gbarnai) | Co-owner |

Code owners are set in [`.github/CODEOWNERS`](.github/CODEOWNERS).

## License

FormTools is licensed under the Apache License, Version 2.0 ([`LICENSE`](LICENSE), SPDX `Apache-2.0`). Copyright (C) 2026 NodeAgentc, Inc. Third-party notices: [`NOTICE.md`](NOTICE.md).

<sub>Screenshot content: CC0 photos and models from Poly Haven.</sub>
