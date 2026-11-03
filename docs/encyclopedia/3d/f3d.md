# F3D (fast, minimal 3D viewer)

Status as of 2026-11: latest stable v3.5.0 (published April 2026); a v4.0.0 release candidate (RC3, October) exists as a pre-release.

## Summary

- Open-source desktop viewer plus the libf3d C++17 library (bindings: C, Python, Java, JavaScript). Also a WebAssembly build and, since 3.5, an Android app.
- License: BSD 3-Clause; bundled third-party libraries are described as permissive.
- Platforms: desktop (Windows, macOS, Linux), web (WASM), Android. Exact desktop OS list was not on the pages fetched.
- Design: one window, hotkeys, almost every option settable by CLI flag or config file. Strong headless use: render to PNG or video with `--output`, `--output-video`.

## Features

### Camera controls
Left-drag orbits the focal point; Shift+left or middle-drag pans; Ctrl+left rolls; wheel or vertical right-drag zooms; Ctrl+wheel zooms toward the cursor; middle-click recenters on the point under the cursor. Number keys give front/right/top views (1, 3, 7), 9 gives isometric, 2/4/6/8 rotate 90 degrees, 5 toggles orthographic, Enter resets. Interaction styles: default, trackball, and 2D (pan/zoom only, toggled by K). Camera is locked while a scene-camera animation plays. CLI exposes position, focal point, view-up, view angle, azimuth/elevation, zoom factor and ortho.
formtools note: copy the 1/3/7/9 view-snap and middle-click-to-center behaviors; they are cheap and users love them.

### Render modes and PostFX
OpenGL rasterizer with real-time PBR by default; optional OSPRay raytracing or Anari backends (samples per pixel, denoise). PostFX toggles: ambient occlusion, FXAA/SSAA/TAA anti-aliasing, tone mapping, translucency blending modes, depth display, custom final shader. Edges (E) show mesh wireframe-like edges over the surface. Normal glyphs (Ctrl+N) draw normals as glyphs with scale/color options. Point sprites and point size for point clouds.
formtools note: expose a small "render mode" dropdown (shaded, edges, normals glyphs, unlit, points) rather than F3D's many independent toggles.

### HDRI, skybox, grid, axes
HDRI file for lighting (F toggles ambient lighting), skybox modes disabled/enabled/blurred (J), Shift+right-drag rotates the HDRI. Ground grid (G) with unit size, subdivisions, color, opacity, reflection. Axes (X), axes grid, up-direction switch +Y/+Z. Dropping a file with Shift sets it as HDRI.
formtools note: ship one neutral default HDRI and accept drag-drop HDRI override; offer +Y/+Z up toggle because CAD and DCC disagree.

### Materials and texture inspection
CLI overrides for base color, roughness, metallic, opacity, base IOR, emissive factor, normal scale, texture transform, matcap, per-slot texture replacement, checkerboard override and unlit mode. Backface type selectable. Metadata panel (M) shows file metadata when available.
formtools note: material override flags map to a "debug materials" panel; keep it optional.

### Scene graph, stats, armature
Scene hierarchy widget (H, added in 3.5) toggles part visibility. Armature display (Shift+A). On-screen filename, FPS, metadata overlays.
formtools note: a collapsible hierarchy tree with visibility checkboxes is the baseline; add tri/vertex counts, which F3D shows only via metadata/console (not confirmed in fetched text).

### Animation
Space plays/pauses (Ctrl+Shift+Space backward). Options: autoplay, animation indices, speed factor, start time, progress bar style. Scene cameras from the file can be selected by index.
formtools note: expose play/pause, speed, scrubber, and animation picker.

### Screenshots, video, turntable-style output
F12 saves a screenshot; Ctrl+F12 saves a minimal one (no grid/overlays, transparent). `--no-background` gives transparent PNG. `--output-video` with encoder and bitrate options (default 5 Mbps) renders animations to video. A turntable flag was not confirmed in the fetched option list; camera azimuth offsets plus scripting can emulate it.
formtools note: offer "export PNG (transparent)" and "turntable GIF/MP4" as one-click actions built on offscreen rendering.

### Multi-file and workflow
Up/Down arrows cycle files in the folder; F5 reloads; watch-files option reloads on change; statefiles save/load a whole view; stdin streaming (`cat model.glb | f3d -`) since 3.5; drag and drop.
formtools note: folder browsing with arrow keys is the right "viewer" feel for a file utility.

### Scientific visualization
Scalar/array coloring (S/Y keys), colormaps, scalar bar, volume rendering. Mostly irrelevant for a media suite.
formtools note: skip unless VTK/medical formats are in scope.

## Formats (read-only, no model export)

glTF/GLB, OBJ (+MTL), FBX, COLLADA (.dae), DirectX (.x), 3DS, OFF, DXF, 3MF, AMF, VRML (.wrl), USD/USDA/USDC/USDZ (single animation), Quake MDL, Alembic (.abc, animated, not a full scene), Draco (.drc); images (PNG, JPEG, BMP, TGA, HDR, WebP, EXR); STEP/IGES/BREP/XBF/FCStd via OpenCASCADE; IFC (web-ifc, 3.5); CityGML; point clouds and splats: PLY, PTS, SPZ, .splat, plus LAS/LAZ and others through PDAL; scientific: VTK family, EXODUS, NetCDF, NRRD, MetaIO, TIFF, DICOM, VDB. `--list-readers` shows what a given build supports.
formtools note: F3D is the reference for "format breadth in one viewer"; mimic by layering assimp, OCCT and a splat reader behind one loader interface.

## CLI summary

Categories: input/output (`--input`, `--output`, `--output-video`, stdin `-`), forced reader, config and statefiles, rendering backend (`-r`), raytracing and PostFX, camera, scene/grid/axes, animation, materials/textures, window/UI toggles, scientific coloring, multi-file mode (single/all/by directory with regex grouping), verbosity, regression-testing (compare to reference image, record/play interaction logs), plugin management, libf3d option passthrough (`-D`, `-R`).
formtools note: adopt the "any UI toggle is also a CLI flag" principle so scripts and GUI stay in parity.

## Sources
- https://f3d.app/docs/next/user/OPTIONS
- https://f3d.app/docs/next/user/SUPPORTED_FORMATS
- https://f3d.app/docs/next/user/INTERACTIONS
- https://github.com/f3d-app/f3d
- https://github.com/f3d-app/f3d/releases
