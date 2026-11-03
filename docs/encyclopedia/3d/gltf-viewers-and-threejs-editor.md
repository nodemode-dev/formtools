# glTF viewers: Khronos glTF Sample Viewer, gltf.report, three.js editor

## Khronos glTF Sample Viewer

- Official Khronos reference web viewer for glTF 2.0 PBR, WebGL 2. License Apache-2.0. Repo is active (thousands of commits).
- Loading: built-in model list, drag and drop, or `model=` URL parameter; URL params `noUI`, `yaw`, `pitch`, `distance` allow embedding and deterministic views.
- Environment: drag in a `.hdr` panorama as environment map; adjustable lighting and tone mapping.
- Debug: toggle individual glTF features/extensions, view debug channels, material variant picker, animation toggles, glTF Validator error panel, screenshot and camera download, file statistics.
- Extension coverage (partial list): anisotropy, clearcoat, diffuse transmission, dispersion, IOR, iridescence, sheen, specular, transmission, unlit, volume; Draco, meshopt, KHR_texture_basisu (KTX2), texture transform, EXT_texture_webp; lights punctual, mesh quantization, instancing, animation pointer, Gaussian splatting, interactivity, node visibility; rigid-body physics with NVIDIA PhysX only. Known gaps: mesh attribute and skin checks (WebGL 2 32-bit limits).
formtools note: use it as the conformance oracle: if our viewer renders a Khronos sample differently, ours is wrong. Its debug-channel list (base color, metallic, roughness, normal, occlusion, emissive) is the right set for a material inspector.

## gltf.report

- Web tool described as viewer, analysis tool, script editor and validator for glTF 2.0. Built around glTF-Transform (author Don McCurdy) per general knowledge; home page fetched only returned metadata. Report/optimize/scripting detail not verified. (single source, metadata only)
formtools note: its "stats table plus scriptable transforms" idea maps to our inspector plus optimize pipeline; verify details on the live site before copying.

## three.js editor

- Browser scene editor shipped with the three.js repo. The static page was empty when fetched; details here come from the repo's editor source files.
- Import extensions handled by the editor loader: 3dm, 3ds, 3mf, amf, dae, drc, fbx, glb, gltf, kmz, md2, obj, ply, stl, usd, usda, usdc, usdz, vox, wrl; point/other: pcd, xyz, svg, ldr, mpd; json; zip archives (scans for fbx/glb/gltf or an obj+mtl pair); images as textures.
- Export (File menu): DRC (selected mesh, Draco), GLB and GLTF (whole scene, animation-optimized), OBJ (selected), PLY ascii/binary, STL ascii/binary, USDZ.
- Scene graph outliner, properties panel and scripting are from general knowledge (not verified in fetched files).
- three.js loaders list also includes Gaussian splat loaders (PLY, .splat, .ksplat, .spz), a USD loader, VRML, Rhino 3dm, MaterialX, and texture loaders for KTX2/EXR/HDR/TGA/UltraHDR; exporters: GLTF, OBJ, PLY, STL, USDZ, DRACO, KTX2, EXR.
- License: MIT (general knowledge).
formtools note: three.js is the pragmatic engine for a cross-platform WebView viewer; its loader breadth rivals assimp for web-friendly formats, and its editor export set (GLB, USDZ, STL, PLY, OBJ) is a reasonable minimum export list.

## Sources
- https://github.com/KhronosGroup/glTF-Sample-Viewer
- https://gltf.report/
- https://threejs.org/editor/
- https://threejs.org/docs/#manual/en/introduction/Loading-3D-models
- https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/Loader.js
- https://raw.githubusercontent.com/mrdoob/three.js/dev/editor/js/Menubar.File.js
- https://www.khronos.org/gltf/
