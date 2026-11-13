# Contributing to FormTools

Thank you for helping. FormTools is the Form family's media and file utility belt:
viewers for almost any file, batch image tools, 3D viewing and desktop utilities, in
one window with no account, running on your own computer. It gets better through real
use and real contributions.

## Where to start

- **Use it and report what goes wrong.** A clear bug report, with steps, the version
  and your platform, is one of the most useful things you can give.
- **Look at the open issues.** Comment on one before starting larger work, so nobody
  builds the same thing twice.
- **Keep to what FormTools is for.** FormTools does not duplicate a sibling app's job:
  transcoding (FormEncoder), libraries (formdam, formlit), layered editing (formvis),
  PDF editing (formpdf), video editing (formcut), audio editing (formwav), sculpting
  (formsculpt), boards (formref), launching the family (formtray) and installing apps
  (FormPortal) stay in those apps, and FormTools hands off with "Open in ...".

## Setting up

Clone the repository, run `./formtools_oc_install` once, then `./formtools` (on Windows,
`formtools_oc_install.bat` and `formtools.bat`). The first installs what the engine and
the interface need; the second starts the engine on 127.0.0.1:8240 and the window at
http://127.0.0.1:5240. You need Python 3.12 or newer and Node.js 20.19+ or 22.12+; the
desktop window also needs Rust. The README's "Run it from source" section has the
details.

The code lives in:

| Folder | What is there |
| --- | --- |
| `backend/app` | the engine (Python, FastAPI): file listing, image decoding, the tool modules, MCP |
| `frontend/src` | the window (TypeScript, Vite): Home, browser, viewer, Preferences, command palette |
| `src-tauri` | the desktop shell (Rust, Tauri 2) |
| `setup` | the scripts behind `./formtools` |
| `scripts` | helper scripts, such as the demo recorder |
| `demo`, `demos` | the offline browser demo pages |
| `docs` | the encyclopedia of comparable tools and how FormTools reads Form project files |
| `assets` | the app icon |
| `.claude/skills` | agent skills, mirrored into `.agents/skills` |

## Before you open a pull request

Run the same checks CI runs:

```sh
(cd frontend && npm ci && npm run build && npx tsc --noEmit -p .)
python -m compileall -q backend setup
./formtools agents check
./formtools mcpb check
./formtools sparkle
(cd backend && pip install -r requirements.txt && python formtools_engine.py --selfcheck)
```

CI also boots the engine and probes `/api/health` and `/api/capabilities`, runs
`bash -n` over the shell scripts, and fails on an em dash in tracked Markdown or an
emoji in any tracked text.

- Keep each pull request to one change.
- Write commit subjects the way the history does: `type(scope): plain sentence (X.Y.Z)`,
  for example `feat(titlebar): ...`, `fix(checks): ...`, `docs(readme): ...`.
- After changing a skill in `.claude/skills`, run `./formtools agents sync`.
- No emoji anywhere, no em dash in Markdown, and keep code comments to a minimum: the
  context goes in the folder's `HASHOUT_LOG.md`.
- The three-star sparkle icon is not used anywhere in the app; `./formtools sparkle`
  fails if it returns.

## How changes land

Only the maintainers push to `main`. Everyone else forks the repository and opens a
pull request into `main`. A pull request merges when every CI check passes on an
up-to-date branch and a maintainer has approved it after its last push.

## Releases

A release is a version, and only the maintainers make one: the version bump is the last
commit on `main`, and every build is compiled and released from
[FormCompiler](https://github.com/nodemode-dev/formcompiler), which builds every
platform and publishes them together. This repository holds the source; packaging and
releases stay in FormCompiler.

## Licensing

FormTools is licensed under the Apache License 2.0. By contributing, you agree that
your contribution is licensed under the same terms. Only add code you have the right
to contribute, and name any third-party code and its licence in the pull request.

## Patents and other people's IP

Some features are deliberately not built because they come too close to someone else's
patent, trademark, copyright or design. The maintainers hold that line with counsel;
contributors do not decide it, and nobody here redesigns a feature on their own reading
of a patent. This is engineering diligence, not legal advice.

### Rules for every contribution

- Patents: do not add a feature, or a dependency that provides one, that reproduces a method you know to be patented. If you are unsure, open an issue that describes what the feature does, not which patent it resembles. Patent numbers stay out of code, commits, comments, logs and changelogs.
- Trademarks: other vendors' product and feature names appear only to name a file format or compatibility ("opens <format> files", "for use with"). No command, menu, panel, tool, preset, template, theme or agent tool takes another product's feature name, and no text says "like X" or "the way X does it". Describe what the feature does.
- Copyright: never copy another product's help, tooltip, dialog or documentation text (link to it instead); never trace or import vendor icons; never bundle vendor templates, themes, presets, brushes, swatches, LUTs, materials, sample files, sound libraries, stock media or fonts. The research in `docs/encyclopedia` is paraphrased, with sources on every page; never paste vendor text, icons or presets from it into the product. Test fixtures come from this repository's own scripts.
- Licences: check `docs/encyclopedia/engines/engine-licensing-matrix.md` before adding a dependency, and give every new dependency, binary, model, font, profile or data file a row in `NOTICE.md` in the same commit that adds it. GPL stays outside the distributed app, AGPL nowhere, LGPL dynamically linked or a separate process and replaceable, MPL files unedited. CC BY credited, CC BY-SA only unmodified, CC NC and ND never.

## Conduct

Everyone taking part follows the [code of conduct](CODE_OF_CONDUCT.md). Security
problems go through [SECURITY.md](SECURITY.md), never a public issue.
