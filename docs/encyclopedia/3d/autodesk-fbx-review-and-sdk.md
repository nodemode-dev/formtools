# Autodesk FBX Review and FBX SDK

## FBX Review (viewer)

- Stand-alone free viewer for models and animation without a DCC tool. Downloads for Mac and Windows.
- Rendering parity with Maya Viewport 2.0 style shading; toggles for wireframe, shading, textures and lighting.
- Animation: play, pause, scrub; switches between cameras saved in the file.
- Formats opened: .fbx, .abc, .3ds, .obj, .dxf, .dae, plus motion-capture types (.bvh, .htr, .trc, .asf, .amc, .c3d, .aoa, .mcd) and .zip.
- No pricing or retirement notice appeared on the product page; Autodesk has been quiet about updates (general impression, unverified).

formtools note: FBX Review's value is mocap and camera-take review; for formtools, camera-from-file switching and BVH playback are the distinctive bits.

## FBX SDK (library and converter)

- Free C++ SDK to read, write and convert FBX; also Python SDK/bindings and an extensions SDK. Windows, macOS, iOS, Linux.
- Version listed on the download page: 2020.3 line (2020.3.x). The page does not call it the latest, but nothing newer is shown.
- License: free of charge but governed by an Autodesk end-user license agreement, not an open-source license. Read before bundling or redistributing. (single source)
- Converter archives convert OBJ, DXF, DAE and 3DS to and from several FBX versions; they ship FBX Viewer, Explorer and Take Manager.
- FBX format itself is proprietary (binary and ASCII variants); open-source tools (assimp, Blender, ufbx) read it via reverse-engineered or independent implementations (general knowledge).

formtools note: do not link the FBX SDK in an open-source app (license is non-OSS, closed binaries); use assimp/ufbx for FBX import and treat FBX export as best-effort.

## Sources
- https://www.autodesk.com/products/fbx/fbx-review
- https://aps.autodesk.com/developer/overview/fbx-sdk
- Search results listing (not fetched): Autodesk marketplace and secondary FBX Review pages.
