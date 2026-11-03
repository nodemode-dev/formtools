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
One-step pipeline: `gltf-transform optimize in.glb out.glb --compress draco --texture-compress webp`. Docs warn defaults may not suit all scenes and recommend `inspect` first, then individual commands. Exact step list and flags are shown by `optimize -h` (not captured here).
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
- https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md
- https://www.khronos.org/gltf/
