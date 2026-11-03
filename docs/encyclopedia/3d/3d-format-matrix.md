# 3D format matrix

Legend: Y yes, P partial, N no. The OBJ, STL, PLY, STEP, 3DS and Alembic rows were re-sourced on 2026-11-03 from Library of Congress format descriptions, Autodesk help, ISO, NIST and the Alembic repository. Remaining "(gk)" markers: OpenUSD Alembic plugin and splat training licences.

## 1. Format properties

| Format | Mesh | Materials | Animation | Skinning | Scene graph | Encoding | Spec | License / patent notes |
|---|---|---|---|---|---|---|---|---|
| glTF / GLB | Y | Y (PBR metal-rough, many KHR extensions) | Y | Y | Y | JSON + buffers; GLB binary | Open, Khronos; ISO/IEC 12113:2022 | Royalty-free spec |
| OBJ / MTL | Y (polys, plus freeform curves and surfaces; elements grouped, no hierarchy) | P (colors, textures and reflection via a companion MTL file; interop problems noted by LoC) | N | N | N (groups only) | Text (ASCII) | Wavefront Advanced Visualizer appendix, c. 1990; no formal standards body; legally probably Autodesk-owned (LoC) | No formal license statement from Wavefront or successors; original text invites use for translating data (LoC) |
| FBX | Y | Y | Y | Y | Y | Binary and ASCII | Proprietary (Autodesk) | Official SDK is free but under Autodesk EULA, not OSS; third-party readers are independent implementations |
| STL | Y (triangles only) | N (no standard color or texture; two incompatible binary color conventions, per LoC) | N | N | N | ASCII and binary | 3D Systems StereoLithography Interface Specification, 1988; no formal governance (LoC) | LoC: no patent or licensing concerns |
| PLY | Y (also point clouds, custom per-element properties) | P (can store color; core elements define no materials, shading or images, per LoC) | N | N | N | ASCII and binary (little and big endian) | Greg Turk 1994 Stanford spec; openly documented, no formal governance (LoC) | LoC: no patent or licensing concerns; Stanford copyright notice permits copying but not selling; also the base of Gaussian splat PLY |
| USD / USDA / USDC / USDZ | Y | Y (UsdPreviewSurface, MaterialX) | Y | Y | Y (layered composition) | Text (usda), binary (usdc), zip package (usdz) | Open, OpenUSD docs; USDZ spec v1.3 | Tomorrow Open Source Technology License 1.0 (modified Apache 2.0) |
| COLLADA (DAE) | Y | Y | Y | Y | Y | XML | Khronos; ISO/PAS 17506:2012 (withdrawn 2022-03-22, replaced by ISO 17506:2022); 1.5.1 spec revision published Nov 2025 | Open; positioned as interchange, not delivery |
| 3MF | Y | Y (color, multi-material via extensions) | N | N | P (build items, components) | ZIP of XML | Open, 3MF Consortium; ISO/IEC 25422:2025 | Royalty-free, members commit RF patent licensing |
| STEP / IGES | B-rep (NURBS, solids), tessellated on import | P (colors, XDE metadata) | N | N | Y (assemblies) | Text (STEP Part 21, IGES) | ISO 10303 (Part 21 clear-text encoding, 2016 edition, ISO TC 184/SC 4); IGES is an ANSI Y14.26M-derived US standard and STEP's precursor (NIST) | ISO 10303-21:2016 is a paid standard (CHF 44 on the ISO page); LoC reports no licensing or patent issues; readers exist as OSS |
| Alembic (.abc) | Y (baked caches) | N/P | Y (baked vertex/transform) | N (baked) | Y | Binary (Ogawa; HDF5 optional) | Open source library is the spec | BSD 3-Clause (LICENSE.txt, copyright Lucasfilm and Sony Pictures Imageworks) |
| 3DS | Y | P (Standard-material color and single maps; no composite or procedural maps, per Autodesk help) | P (position, rotation, scale and some camera and light tracks) | N | P (no group hierarchy in the mesh editor; groups go to the Keyframer) | Binary | Legacy Autodesk 3D Studio (DOS) format; no public spec fetched | Proprietary origin; 8.3 (12-character) file names for textures per Autodesk help |
| X3D / VRML | Y | Y | Y (interpolators) | P (H-Anim) | Y | XML, classic VRML text, compressed binary | ISO/IEC 19775/19776; Web3D | Royalty-free and publicly available |
| Gaussian splats (PLY / .splat / .spz / SOG / glTF) | N (point primitives with scale, rotation, opacity, SH color) | N | N | N | N | PLY binary; SPZ ZSTD-packed; SOG compressed; GLB | PLY informal; SPZ open (MIT); KHR_gaussian_splatting ratified | SPZ MIT; splat training methods carry separate research licenses (gk) |

## 2. Reader / writer support in open-source tools

R = read, W = write, p = partial or experimental. Sources: assimp Fileformats doc, PyMeshLab I/O page, three.js class index and editor sources, F3D supported formats, CAD Assistant page. The Blender column now follows the Blender 5.2 LTS manual import/export page and API operator pages (see blender-headless.md); "not listed" means absent from the 5.2 manual's import/export list, which does not rule out an add-on. OpenUSD and glTF-Transform rows come from partial fetches or general knowledge as marked.

| Format | assimp | MeshLab / VCG | three.js | F3D | OCCT / CAD Assistant | Blender 5.2 | OpenUSD | glTF-Transform |
|---|---|---|---|---|---|---|---|---|
| glTF / GLB | R, W(p) | R only (plugin has no export) | R, W | R | R, W (CAD Assistant native) | R, W | plugin-level only (not verified) | R, W (glTF only) |
| OBJ / MTL | R, W | R, W | R, W (OBJ only) | R | R, W | R, W | N | N |
| FBX | R, W(p, experimental) | R | R | R | R (CAD Assistant mesh import) | R, W | N | N |
| STL | R, W | R, W | R, W | R | R, W | R, W | N | N |
| PLY | R, W | R, W | R, W | R | R, W | R, W | N | N |
| USD / USDZ | R (USD) | N | R (USD loader), W (USDZ) | R | N | R, W | R, W | N |
| DAE | R, W | R, W | R | R | R | not listed in 5.2 | N | N |
| 3MF | R, W(p, experimental) | R, W via optional Lib3MF plugin (not in PyMeshLab list) | R | R | N | not listed | N | N |
| STEP / IGES | IFC-STEP and STP R; STEP W listed | N | N (Rhino 3dm only) | R via OCCT | R, W (reference implementation) | not listed | N | N |
| Alembic | N | N | N | R | N | R, W | via plugin (gk) | N |
| 3DS | R, W | R, W | R | R | R (mesh import) | not listed | N | N |
| X3D / VRML | R (X3D) | R, W | R (VRML) | R (VRML) | R (VRML) | not listed | N | N |
| Splats (PLY, .splat, .spz) | N | PLY as points | R (PLY, .splat, .ksplat, .spz) | R (PLY, .splat, .spz) | N | not listed | N | glTF splat ext. support not verified |

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
- https://www.loc.gov/preservation/digital/formats/fdd/fdd000507.shtml (OBJ)
- https://www.loc.gov/preservation/digital/formats/fdd/fdd000504.shtml (STL)
- https://www.loc.gov/preservation/digital/formats/fdd/fdd000501.shtml (PLY)
- https://www.loc.gov/preservation/digital/formats/fdd/fdd000448.shtml (STEP-file, ISO 10303-21)
- https://www.iso.org/standard/63141.html
- https://www.iso.org/standard/59902.html
- https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/246-249.html (IGES)
- https://help.autodesk.com/cloudhelp/2020/ENU/3DSMax-Data-Exchange/files/GUID-E4C19A8E-F941-44F8-A2AB-0A2DF80656E3.htm (3DS export)
- https://raw.githubusercontent.com/alembic/alembic/master/LICENSE.txt
- https://docs.blender.org/manual/en/latest/files/import_export/index.html
