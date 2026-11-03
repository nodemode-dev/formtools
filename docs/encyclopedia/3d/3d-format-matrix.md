# 3D format matrix

Legend: Y yes, P partial, N no. Rows marked "(gk)" rely on general knowledge not verified from a fetched primary source; everything else cites the Sources list.

## 1. Format properties

| Format | Mesh | Materials | Animation | Skinning | Scene graph | Encoding | Spec | License / patent notes |
|---|---|---|---|---|---|---|---|---|
| glTF / GLB | Y | Y (PBR metal-rough, many KHR extensions) | Y | Y | Y | JSON + buffers; GLB binary | Open, Khronos; ISO/IEC 12113:2022 | Royalty-free spec |
| OBJ / MTL | Y (polys, no hierarchy) | P (MTL, legacy Phong-style; PBR via unofficial keys) (gk) | N | N | N (groups only) | Text | De facto, not formally standardized (gk) | No known encumbrance (gk) |
| FBX | Y | Y | Y | Y | Y | Binary and ASCII | Proprietary (Autodesk) | Official SDK is free but under Autodesk EULA, not OSS; third-party readers are independent implementations |
| STL | Y (triangles only) | N (color via nonstandard extensions) (gk) | N | N | N | ASCII and binary | Informal, no open standards body (gk) | Early patents expired (gk) |
| PLY | Y (also point clouds, custom per-element properties) | P (vertex color, texture refs) (gk) | N | N | N | ASCII and binary | Informal, Stanford origin (gk) | None known (gk); also the base of Gaussian splat PLY |
| USD / USDA / USDC / USDZ | Y | Y (UsdPreviewSurface, MaterialX) | Y | Y | Y (layered composition) | Text (usda), binary (usdc), zip package (usdz) | Open, OpenUSD docs; USDZ spec v1.3 | Tomorrow Open Source Technology License 1.0 (modified Apache 2.0) |
| COLLADA (DAE) | Y | Y | Y | Y | Y | XML | Khronos; ISO/PAS 17506 (gk); 1.5.1 spec revision published Nov 2025 | Open; positioned as interchange, not delivery |
| 3MF | Y | Y (color, multi-material via extensions) | N | N | P (build items, components) | ZIP of XML | Open, 3MF Consortium; ISO/IEC 25422:2025 | Royalty-free, members commit RF patent licensing |
| STEP / IGES | B-rep (NURBS, solids), tessellated on import | P (colors, XDE metadata) | N | N | Y (assemblies) | Text (STEP Part 21, IGES) | ISO 10303 for STEP (gk); IGES legacy ANSI (gk) | Spec access for STEP is paid via ISO (gk); readers exist as OSS |
| Alembic (.abc) | Y (baked caches) | N/P | Y (baked vertex/transform) | N (baked) | Y | Binary (Ogawa; HDF5 optional) | Open source library is the spec | Sony/ILM-origin open source; license text not captured (BSD-style in gk) |
| 3DS | Y | P (legacy) | P (gk) | N | P | Binary | Legacy Autodesk, reverse-engineered | Proprietary origin, limits (16-bit indices, 8.3 names) (gk) |
| X3D / VRML | Y | Y | Y (interpolators) | P (H-Anim) | Y | XML, classic VRML text, compressed binary | ISO/IEC 19775/19776; Web3D | Royalty-free and publicly available |
| Gaussian splats (PLY / .splat / .spz / SOG / glTF) | N (point primitives with scale, rotation, opacity, SH color) | N | N | N | N | PLY binary; SPZ ZSTD-packed; SOG compressed; GLB | PLY informal; SPZ open (MIT); KHR_gaussian_splatting ratified | SPZ MIT; splat training methods carry separate research licenses (gk) |

## 2. Reader / writer support in open-source tools

R = read, W = write, p = partial or experimental. Sources: assimp Fileformats doc, PyMeshLab I/O page, three.js class index and editor sources, F3D supported formats, CAD Assistant page. Blender, glTF-Transform and OpenUSD rows come from partial fetches or general knowledge as marked.

| Format | assimp | MeshLab / VCG | three.js | F3D | OCCT / CAD Assistant | Blender (gk) | OpenUSD | glTF-Transform |
|---|---|---|---|---|---|---|---|---|
| glTF / GLB | R, W(p) | R (W per site; not in PyMeshLab list) | R, W | R | R, W (CAD Assistant native) | R, W | plugin-level only (not verified) | R, W (glTF only) |
| OBJ / MTL | R, W | R, W | R, W (OBJ only) | R | R, W | R, W | N | N |
| FBX | R, W(p, experimental) | R | R | R | R (CAD Assistant mesh import) | R, W | N | N |
| STL | R, W | R, W | R, W | R | R, W | R, W | N | N |
| PLY | R, W | R, W | R, W | R | R, W | R, W | N | N |
| USD / USDZ | R (USD) | N | R (USD loader), W (USDZ) | R | N | R, W | R, W | N |
| DAE | R, W | R, W | R | R | R | varies by version | N | N |
| 3MF | R, W(p, experimental) | listed on site | R | R | N | add-on (gk) | N | N |
| STEP / IGES | IFC-STEP and STP R; STEP W listed | N | N (Rhino 3dm only) | R via OCCT | R, W (reference implementation) | N (gk) | N | N |
| Alembic | N | N | N | R | N | R, W | via plugin (gk) | N |
| 3DS | R, W | R, W | R | R | R (mesh import) | add-on (gk) | N | N |
| X3D / VRML | R (X3D) | R, W | R (VRML) | R (VRML) | R (VRML) | R, W (add-on, gk) | N | N |
| Splats (PLY, .splat, .spz) | N | PLY as points | R (PLY, .splat, .ksplat, .spz) | R (PLY, .splat, .spz) | N | add-on only (gk) | N | glTF splat ext. support not verified |

## 3. Practical conversion guidance

- Delivery (web, apps, AR on Android/web): GLB, compressed with meshopt or Draco plus KTX2 textures via glTF-Transform.
- Apple AR Quick Look: USDZ (strict packaging rules).
- 3D printing: STL for simple, 3MF for color/multi-material.
- CAD exchange: STEP in, tessellate to mesh out; IGES only for legacy suppliers.
- Animation caches: Alembic or USD; for skinned characters FBX/glTF/USD.
- Scan data: PLY (meshes/points), then Poisson reconstruction (MeshLab) if a mesh is required.
- Gaussian splats: keep PLY for editing, SPZ/SOG for delivery, GLB when it must travel through glTF pipelines.

formtools note: model the converter as one canonical in-memory scene (assimp-like) with import via assimp/ufbx/OCCT, and dedicated exporters per target; present a lossiness warning list (skinning lost to STL/OBJ, PBR lost to OBJ, animation lost to STL/PLY/3MF) before every conversion.

## Sources
- https://raw.githubusercontent.com/assimp/assimp/master/doc/Fileformats.md
- https://pymeshlab.readthedocs.io/en/latest/io_format_list.html
- https://threejs.org/docs/#manual/en/introduction/Loading-3D-models
- https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/Menubar.File.js
- https://f3d.app/docs/next/user/SUPPORTED_FORMATS
- https://www.opencascade.com/products/cad-assistant/
- https://www.khronos.org/gltf/
- https://www.khronos.org/collada/
- https://3mf.io/specification/
- https://www.web3d.org/x3d/specifications
- https://github.com/alembic/alembic
- https://openusd.org/release/spec_usdz.html
- https://raw.githubusercontent.com/PixarAnimationStudios/OpenUSD/release/LICENSE.txt
- https://aps.autodesk.com/developer/overview/fbx-sdk
- https://github.com/nianticlabs/spz
- https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/
- https://developer.blender.org/docs/release_notes/4.1/pipeline_assets_io/
- https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md
