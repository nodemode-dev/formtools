# Open Asset Import Library (assimp)

## Summary

- C/C++ library that imports about 60 mesh/scene formats into one in-memory scene structure and exports a smaller set. Bindings or ports for C#, Java, Python, Delphi, D, .NET, Unity, Unreal, Rust, Node.js. Builds with CMake, available via vcpkg, runs on Android and iOS.
- License: BSD 3-Clause (the repo LICENSE file; the README calls it a modified BSD). Static linking is fine; keep the license text with your product. Test models under `test/models-nonbsd` carry their own terms.
- Latest release seen: 6.0.5 bugfix (30 April; year not shown on page, presumably 2026), preceded by 6.0.4 (24 January). 6.0.5 fixed several memory-safety bugs (FBX base64 decoder overflow, PLY importer heap overflow, others), extended skinning export to glTF/GLB, and added initial macOS C4D support.

formtools note: assimp is the natural default importer, but run it sandboxed or fuzz-hardened since parser CVEs are recurring; pin versions and track security releases.

## Import formats (per Fileformats doc)

3D, 3DS, 3MF, AC/AC3D, ACC, AMJ, ASE, ASK, B3D, BVH, CSM, COB, DAE (Collada), DXF, ENFF, FBX, glTF 1.0/GLB, glTF 2.0, HMB, IFC-STEP, IQM, IRR/IRRMESH, LWO, LWS, LXO, M3D, MD2, MD3, MD5, MDC, MDL, MESH/MESH.XML, MOT, MS3D, NDO, NFF, OBJ, OFF, OGEX, PLY, PMX, PRJ, Q3O, Q3S, RAW, SCN, SIB, SMD, STP, STL, TER, UC, USD, VTA, X, X3D, XGL, ZGL.
- glTF 2.0 import supports only a subset of extensions (lights punctual, pbrSpecularGlossiness, unlit, texture transform at the time of the doc); PBR extensions like clearcoat or transmission are not in that list.
- BLEND is deprecated. C4D is limited (geometry and hierarchy), not built by default, needs a non-free SDK.
- No Alembic or STEP B-rep import in the list.

## Export formats

DAE, STL, OBJ, PLY, X, 3DS, JSON (WebGL, external tool), ASSBIN, STEP, PBRTv4, glTF 1.0 (partial), glTF 2.0 (partial), 3MF (experimental), FBX (experimental).

formtools note: use assimp for import of long-tail legacy formats; for export prefer purpose-built writers (glTF-Transform for glTF, lib3mf for 3MF, USD for USD) because assimp export is partial or experimental.

## CLI (assimp_cmd, from source)

Verbs: `version`, `help`, `listext` (importable extensions), `knowext`, `listexport`, `exportinfo`, `export`, `info` (model stats), `dump` (ASSBIN/ASSXML), `cmpdump`, `extract` (pull embedded textures), plus a hidden `testbatchload`.
Export-path options: root-node rotation (`-rx/-ry/-rz`), post-process flags `-ptv` (pre-transform vertices), `-tri` (triangulate), `-lh` (left-handed), `-fuv` (flip UVs), `-fwo` (flip winding), `-gs` (global scale), `-embtex` (embed textures), normal/tangent generation flags, presets `-cfull`, `-cdefault`, `-cfast`, and logging flags.
formtools note: mirror the `info` verb as a "model stats" panel (mesh, material, texture, animation counts) and surface the post-process flags as import options (triangulate, flip UV, scale).

## Viewers

- `assimp_view` (the older viewer in the tools directory, Windows/Direct3D era), a third-party Qt5-ModelViewer, and an experimental ImGui-based Assimp-Viewer are mentioned in the repo README. Feature detail of these viewers was not verified.
formtools note: do not model the UI on assimp's viewers; they are test harnesses.

## Sources
- https://github.com/assimp/assimp
- https://raw.githubusercontent.com/assimp/assimp/master/doc/Fileformats.md
- https://raw.githubusercontent.com/assimp/assimp/master/LICENSE
- https://github.com/assimp/assimp/releases
- https://raw.githubusercontent.com/assimp/assimp/master/tools/assimp_cmd/Main.cpp
