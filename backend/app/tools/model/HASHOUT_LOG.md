# model tool HASHOUT_LOG

Decisions, reasons and anything left out, newest first. Code carries no comments; the context lives here.

## v0.4.0 (2026-11-03): model tool

### Formats

- Probed trimesh 5.2.0 with only the pinned requirements (numpy, Pillow). Readable: `glb gltf obj stl ply off xyz`. Not readable without extras: `dae` (pycollada), `3mf` (lxml and networkx), `step` (cascadio or gmsh), `3dxml`, `ctm`, `xaml`, `zae`. trimesh has no 3DS reader. Writable: `glb gltf obj stl ply off`, plus `dae` and `3mf` only with the same missing extras; `xyz` only for point clouds.
- Engine reads (`READ`): glb, gltf, obj, stl, ply, off, xyz. Engine writes (`WRITE`, the contract's five): glb, obj, stl, ply, off.
- Window opens natively (`NATIVE`): glb, gltf, obj, stl, ply, fbx, 3mf, dae, usdz. Engine-converted for viewing: off, xyz (stl, obj and ply also pass through `view` as GLB).
- `capabilities.formats.model` is the union: 3mf dae fbx glb gltf obj off ply stl usdz xyz. 3ds is not advertised.
- `info` on fbx, 3mf, dae and usdz answers 415 with a sentence, because the engine cannot read them; the window still opens them with its own loaders.

### Info

- glb and gltf: read from the JSON chunk only, no buffers and no textures are loaded. Counts come from the document; vertices and triangles from POSITION and index accessor counts, expanded per node instance; the bounding box from accessor min and max moved by world node matrices (a primitive without min and max adds nothing; if none has them the box is zeros and a note says so). Units are `m` (glTF is metres). Notes list required extensions, compression extensions, skins, the generator, and the count of referenced files that are missing or outside the folder. Works for Draco or meshopt files that trimesh cannot decode.
- obj, stl, ply, off, xyz: loaded as a scene with vertex merging (`process=True`), so an STL reports unique vertices. Materials and textures are counted by identity from the scene's materials; PIL opens images lazily, so no texture is decoded. Notes: missing `mtllib` file, point clouds, per-vertex colours. Units are null. Geometry is counted once per mesh (no instancing in these formats).
- `nodes` is the scene graph node count without trimesh's `world` root for non-glTF files.

### View, asset, convert

- `view`: glb is served as is; anything else loads with `process=False` (faithful vertices) and exports GLB from the scene, so node structure and materials survive where trimesh carries them. Cached under `cache/models/<2 hex>/<sha1>.glb`, key path, size, mtime and a version; the key does not include side files (an edited MTL or texture is not noticed until the model file changes). Pruned at startup above 1 GiB, oldest first. At most 2 loads at once; sources over 768 MB answer 413.
- A custom resolver subclass decodes percent-encoded external names (`my%20tex.png`), which trimesh's own file resolver does not; trimesh's resolver already refuses names that leave the model's folder.
- `asset`: the uri is percent-decoded once, then refused when it has a scheme (`data:`, `http:`, `C:`), starts with `//`, `\\`, `/` or a drive letter, or contains NUL. Backslashes become slashes (MTL files from Windows), `#` and `?` parts are dropped, the result is resolved with `strict=True` against the model's folder (symlinks followed) and refused with 403 unless the real path stays inside the real folder tree; missing files are 404. Owner extensions allowed: the contract's gltf, obj, mtl, plus dae and fbx (their loaders also fetch textures; widening, harmless to drop). A path such as `sub/../x.bin` with no `sub` folder is 404 (strict resolve), not served. Responses carry `nosniff`; `mtl` and `obj` are text/plain, `bin` octet-stream.
- `convert`: validates and reserves the output name synchronously (exclusive create, so nothing is overwritten; ` (2)`, ` (3)` when taken), then runs job `model-convert` with 3 steps (read, convert, write). `out` is used as the output path, with `.<format>` appended when its extension differs; its folder must exist. A failure or cancel removes the reserved file and any companions.
  - stl, ply, off: the scene is flattened with transforms applied and concatenated into one mesh (hierarchy and materials cannot be kept by these formats). A point-cloud-only scene can be written as ply; other formats answer a failed job with a sentence.
  - obj: PBR materials are reduced to the simple material; the `.mtl` is named `<out stem>.mtl` and textures `<out stem>_<name>`, written beside the output with exclusive create (a companion that already exists fails the job). Lossy: node hierarchy, animation and PBR channels other than base colour are dropped.
  - glb: the scene is exported as a scene, keeping nodes and materials trimesh carries; animations and skins are not carried by trimesh's loader, so a glb to glb conversion drops them.

### Left out

- No fbx, usdz, 3mf, dae, 3ds, step or splat reading in the engine (needs extras or assimp). No gltf (JSON plus bin) output. No texture-level details in `info`. The frontend should not call `info` for formats outside `READ`.
