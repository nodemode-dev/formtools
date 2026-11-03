# MeshLab

## Summary

- Open-source system for processing and editing large unstructured triangle meshes: inspection, cleaning, repair, simplification, remeshing, reconstruction, texturing, registration, conversion.
- Latest on the site: MeshLab 2025.07 (released 2025-09-09; adds ARM64 builds for Linux and macOS). A newer release after November 2026 was not checked.
- License: GPL-3.0 source; the name MeshLab is a CNR trademark; logos CC BY-SA 4.0. GPL means do not link its code into a permissively licensed app; call it as an external process or reimplement.
- Platforms: Windows 64-bit (Store and direct), macOS (Apple silicon and Intel), Linux (Flatpak, AppImage x86_64 and arm64).
- Scripting: PyMeshLab (Python) for batch; filters are applied through `MeshSet.apply_filter()`.

formtools note: use MeshLab/PyMeshLab as an optional external "repair and decimate" engine, never as a linked dependency.

## Filters (names from PyMeshLab filter list)

### Cleaning and repair
Remove duplicate vertices, duplicate faces, null faces, unreferenced vertices, folded faces; close holes; repair non-manifold edges; merge close vertices.
formtools note: a "Repair mesh" one-click that runs this fixed sequence covers most 3D-print use.

### Simplification (decimation)
Quadric edge collapse decimation (with and without texture preservation), vertex clustering decimation.
formtools note: expose target face count or percentage, with a "preserve boundary and UVs" checkbox; quadric edge collapse is the gold standard.

### Remeshing, subdivision, smoothing
Isotropic explicit remeshing, uniform resampling, Loop and midpoint subdivision, poly-to-tri, tri-to-quad dominant; Laplacian, Taubin and HC Laplacian smoothing.
formtools note: advanced tab only.

### Surface reconstruction
Screened Poisson, ball pivoting, alpha wrap, convex hull. Poisson disk and Monte Carlo sampling.
formtools note: point cloud to mesh via Poisson is the standard conversion path for scan data.

### Measurement and analysis
Geometric measures (area, volume, bounding box and similar), topological measures (components, holes, manifold checks), Hausdorff distance between meshes, per-vertex distance scalar. Interactive measuring tool exists in the GUI (general knowledge, not in fetched pages).
formtools note: show area, volume, bounding box, genus/holes and non-manifold flags in a stats panel.

### Normals, texture, color, selection
Per-vertex and per-face normals; trivial per-wedge UV parametrization, texmap from color, texmap defragmentation, color from scalar; selection by condition or small disconnected components.
formtools note: "bake vertex colors to texture" is a frequent request from scan users.

### Render and inspection (GUI, general knowledge)
Shaded/flat/wireframe/point modes, per-vertex scalar color maps, light and trackball interaction, layers per mesh, raster layers projection. Not verified in fetched pages.
formtools note: keep our viewer simpler; link out to MeshLab for heavy editing.

## Formats

- Site mentions 3MF, glTF/GLB, NXS/NXZ (multiresolution), E57, U3D export, and VisualSFM NVM/RD.OUT projects.
- PyMeshLab I/O page, load: 3ds, apts, asc, bre, ctm, dae, e57, es, fbx, glb, gltf, obj, off, pdb, ply, pts, ptx, qobj, stl, tri, txt, vmi, wrl, x3d, x3dv, xyz. Save: 3ds, ctm, dae, dxf, e57, idtf, json, nxs, nxz, obj, off, ply, stl, u3d, wrl, x3d, xyz.
- Discrepancy: the PyMeshLab list does not show glTF save or 3MF, while meshlab.net advertises them; version skew is likely, verify on a current build.

## Sources
- https://www.meshlab.net/
- https://github.com/cnr-isti-vclab/meshlab
- https://pymeshlab.readthedocs.io/en/latest/filter_list.html
- https://pymeshlab.readthedocs.io/en/latest/io_format_list.html
