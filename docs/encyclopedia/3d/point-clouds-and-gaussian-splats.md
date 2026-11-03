# Point cloud viewers and 3D Gaussian splat viewers (brief)

## CloudCompare

- Two apps: CloudCompare (view, edit, process) and ccViewer (light viewer only). Use cases: point cloud and mesh comparison, distance measurement, LiDAR and scanner data.
- License GPL (v3 per repo); cannot be used in closed-source software. Platforms Windows, macOS, Linux. Plugins exist and optional dependencies unlock some formats.
- Format list, CLI mode and latest version were not available from fetched pages. (single source for what is listed)

formtools note: out-of-process only (GPL); borrow the idea of a lightweight ccViewer-style viewer for point clouds.

## Potree

- Free open-source WebGL point cloud renderer built on three.js; BSD 2-Clause license.
- Inputs: LAS/LAZ converted with PotreeConverter into a multi-resolution octree; EPT examples; shapefile and GeoPackage overlay examples.
- Features in examples: measurements, elevation profiles, annotations, clipping volumes, camera animation, oriented images, multiple clouds, VR. Potree 2 status was not stated on the fetched page.
formtools note: for big clouds, convert to an octree and stream; for small PLY/PTS files simple point sprites suffice. F3D already reads LAS/LAZ via PDAL.

## Gaussian splats

- SuperSplat: free MIT-licensed browser editor for inspecting, editing, optimizing and publishing 3D Gaussian splats; no install; exposes WebMCP tools for scripted editing. Individual tools (select, crop, export options) were not confirmed from fetched pages.
- Formats (PlayCanvas docs): PLY (uncompressed, lossless, source and interchange, can be several GB); SOG (lossy, about 15-20x smaller than PLY, for web delivery); Streamed SOG (spatial tree of chunks with levels of detail for very large scenes); GLB with KHR_gaussian_splatting (lossless, standard glTF pipelines); SPZ (Niantic, about 10x smaller than PLY, lossy).
- SPZ: MIT-licensed; format v4 uses ZSTD per attribute stream; quantization: 24-bit positions, 8-bit scale/alpha/color, smallest-three 10-bit rotations, 4-5 bit spherical harmonics; C++, Python, WASM tooling.
- KHR_gaussian_splatting is listed among ratified Khronos extensions.
- `.splat` and `.ksplat` are common community formats; F3D reads `.splat` and `.spz`, three.js has loaders for PLY, .splat, .ksplat, .spz.
- Suggested pipeline from PlayCanvas docs: train and edit in PLY, convert to SOG with SplatTransform for production.

formtools note: viewing splats is cheap (three.js loaders or F3D); offer "PLY to SPZ/SOG" conversion as a size-reduction utility.

## Sources
- https://www.cloudcompare.org/main.html
- https://github.com/CloudCompare/CloudCompare
- https://github.com/potree/potree
- https://raw.githubusercontent.com/potree/potree/develop/LICENSE
- https://github.com/playcanvas/supersplat
- https://github.com/nianticlabs/spz
- https://developer.playcanvas.com/user-manual/gaussian-splatting/formats/
- https://github.com/KhronosGroup/glTF/blob/main/extensions/README.md
- https://f3d.app/docs/next/user/SUPPORTED_FORMATS
- https://threejs.org/docs/#manual/en/introduction/Loading-3D-models
