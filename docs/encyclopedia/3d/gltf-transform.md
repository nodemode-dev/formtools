# glTF-Transform (CLI and SDK)

## Summary

- JavaScript/TypeScript SDK for glTF 2.0 that runs on Node.js and the web, plus a CLI. License MIT. Install CLI with `npm install --global @gltf-transform/cli`; image work uses Sharp (native module, can fail to install on some systems). Packages: core, extensions, functions, cli.
- Works on glTF/GLB only; other formats must be converted first.

formtools note: ship it (or its algorithms) as the "optimize glTF" engine; MIT makes bundling easy, but Sharp's native dependency complicates packaging, so consider WASM image codecs.

## CLI commands (paraphrased)

- Inspect and package: `inspect` (contents and likely perf problems), `validate`, `copy`, `optimize`, `merge`, `partition` (split .bin), `dedup`, `prune`, `gzip`, `xmp`.
- Scene: `center`, `instance` (GPU instancing from shared meshes), `flatten`, `join` (merge meshes to cut draw calls).
- Geometry: `draco`, `meshopt` (geometry and animation), `quantize`, `dequantize`, `weld`, `unweld`, `tangents` (MikkTSpace), `unwrap` (UV generation), `reorder`, `simplify`.
- Material: `metalrough` (spec-gloss to metal-rough), `palette`, `unlit`.
- Texture: `resize`, `etc1s` and `uastc` (KTX2 with Basis Universal), `ktxdecompress`, `ktxfix`, `avif`, `webp`, `png`, `jpeg`.
- Animation: `resample` (also drops redundant keyframes losslessly), `sequence` (flipbook visibility), `sparse`.
- There is no `toktx` command; KTX2 output goes through etc1s/uastc (single source: CLI docs; external KTX tooling may be needed for some paths).

### optimize
One-step pipeline: `gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`. Docs warn defaults may not suit all scenes and recommend `inspect` first, then individual commands.

Full step list, read from the CLI source (packages/cli/src/cli.ts on main, 2026-11-03). The transforms run in this order, each gated by its flag; every flag takes a boolean and defaults to on unless noted:
1. `dedup` (always runs).
2. `instance` (`--instance`, `--instance-min`): GPU instancing for shared meshes.
3. `palette` (`--palette`, `--palette-min`): palette textures and merged materials.
4. `flatten` (`--flatten`): flatten the scene graph.
5. `join` (`--join`, `--join-meshes`, `--join-named`): merge meshes to cut draw calls; requires flatten.
6. `weld` (`--weld`): merge equivalent vertices; required for simplify and for Draco (the CLI warns and ignores `--no-weld` with Draco).
7. `simplify` (`--simplify`, `--simplify-error`, `--simplify-ratio`, `--simplify-lock-border`): meshoptimizer simplification.
8. `resample` (`--resample`): lossless keyframe dedup for animation.
9. `prune` (`--prune`, `--prune-attributes`, `--prune-solid-textures`): drop unreferenced properties, unused attributes, and single-colour textures folded into material factors.
10. `sparse` (`--sparse`): sparse accessors for zero-filled arrays.
11. Texture step: `--texture-compress` takes `ktx2`, `webp`, `avif`, `auto` (default, recompress in original format) or false; `--texture-size` caps dimensions (default 2048). KTX2 runs two passes (UASTC for normal, occlusion and metal-rough slots; ETC1S for the rest).
12. Geometry compression last: `--compress` takes `draco`, `meshopt` (default), `quantize` or false; `--meshopt-level` is `medium` or `high` (default).

Note the default compression is meshopt, so the example above passes `--compress draco` explicitly. Simplify is on by default, so a plain `optimize` is lossy; pass `--simplify false` for a lossless-geometry run.
formtools note: present optimize as presets (Web: meshopt + WebP/KTX2; Max compat: Draco + PNG/JPEG; Lossless cleanup: dedup, prune, resample) with a before/after size readout.

### Compression choices
- Draco: geometry compression, widely supported, decode cost on load, ratified KHR_draco_mesh_compression.
- Meshopt: geometry plus animation, fast decode, EXT_meshopt_compression (listed among ratified-track extensions in the Khronos registry).
- KTX2/Basis (ETC1S small, UASTC high quality): GPU-compressed textures through KHR_texture_basisu; stays compressed in GPU memory.
formtools note: warn that Draco/meshopt/KTX2 outputs need compatible viewers; offer a "decompress for compatibility" action (dequantize, ktxdecompress).

## Sources
- https://gltf-transform.dev/cli
- https://gltf-transform.dev/cli#optimize
- https://github.com/donmccurdy/glTF-Transform
- https://raw.githubusercontent.com/donmccurdy/glTF-Transform/main/packages/cli/src/cli.ts
- https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md
- https://www.khronos.org/gltf/
