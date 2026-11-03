# Blender as a headless converter (brief)

Verification note: re-sourced on 2026-11-03 from the Blender 5.2 LTS manual (command-line arguments and import/export pages) and the current Python API operator pages (bpy.ops.wm, bpy.ops.import_scene, bpy.ops.export_scene). The earlier fetch returned only navigation text; a direct page download gave the full body.

## Command line (Blender 5.2 LTS manual)

- Usage is `blender [args ...] [file] [args ...]`. `-b` / `--background` runs without the UI, and the audio device is disabled in background mode by default.
- `-P` / `--python <filepath>` runs a script file; `--python-expr <expression>` runs an expression, which may be a whole multi-line script limited only by the platform argument length; `--python-text <name>` runs a text block; `--python-console` opens an interactive console.
- `--python-exit-code <code>` (0 to 255) sets the process exit code used when a Python exception is raised in a command-line script; zero disables it. Useful so a converter can detect a failed import.
- `--factory-startup` skips reading the user's startup.blend, giving a clean default scene. `--addons <list>` enables a comma separated list of add-ons (no spaces) in addition to defaults. `--python-use-system-env` lets Python see PYTHONPATH and the user site-packages directory.
- Autoexec of scripts embedded in files is off by default (`-Y`); `-y` enables it.
- Arguments run in the order given, so options must come before the action they affect. The manual's own example: setting the render output before loading a blend file is overwritten by the load.
- A double dash is documented in the manual for add-on options, for example Cycles: `blender -b file.blend -f 20 -- --cycles-device OPTIX`. The manual pages fetched do not describe passing custom arguments to your own script; the common practice is to read them from `sys.argv` after the `--` marker, which is not confirmed by a fetched page.

## Pattern

- Run `blender --background --factory-startup --python convert.py -- in.fbx out.glb`. The script clears the default scene, calls an importer operator, then an exporter operator, then exits.
- Per the 5.2 manual, the File > Import/Export menu covers Alembic, BVH, USD, Wavefront OBJ, Stanford PLY, STL, FBX, FBX (Legacy) and SVG; popular formats are enabled by default and others are add-ons. glTF 2.0 appears under the Add-ons section of the manual. Collada is not in the 5.2 list.

## Operators (current Python API)

| Format | Import operator | Export operator |
|---|---|---|
| OBJ | `bpy.ops.wm.obj_import` | `bpy.ops.wm.obj_export` |
| PLY | `bpy.ops.wm.ply_import` | `bpy.ops.wm.ply_export` |
| STL | `bpy.ops.wm.stl_import` | `bpy.ops.wm.stl_export` |
| USD / USDZ | `bpy.ops.wm.usd_import` | `bpy.ops.wm.usd_export` |
| Alembic | `bpy.ops.wm.alembic_import` | `bpy.ops.wm.alembic_export` |
| FBX | `bpy.ops.wm.fbx_import` (new importer) and `bpy.ops.import_scene.fbx` | `bpy.ops.export_scene.fbx` |
| glTF 2.0 | `bpy.ops.import_scene.gltf` | `bpy.ops.export_scene.gltf` |

- glTF export takes `export_format` (binary or JSON, described as binary being most efficient), plus Draco options (`export_draco_mesh_compression_enable`, level and quantization settings), meshopt options (`export_meshopt_compression_enable`), image format and quality, animation, skin and morph switches, and an optional gltfpack integration (`export_use_gltfpack`).
- USD export covers materials as preview materials, armatures as skeletons, shape keys as blend shapes, instancing, hair curves and custom properties. A `usdz_downscale_size` option limits exported texture size for USDZ, and USD import has an `import_textures_mode` for textures inside a USDZ archive.
- Alembic export exposes subdivision schema and instancing switches.
- Operator names changed across versions (the wm.* family replaced older import_scene/export_scene entries for OBJ, PLY and STL); pin the Blender version when scripting.
- Verified from the 4.1 release notes: STL import/export moved to C++ with new operators `bpy.ops.wm.stl_import` and `bpy.ops.wm.stl_export` (old Python add-on legacy); PLY gained custom attribute support; USD gained armature and shape key export, scene graph and point instancing import; Alembic reads point velocities.
- License: the manual has an "About Free Software and the GPL" section; the license text itself was not fetched. Using Blender as an external process keeps it out of your own binary.

formtools note: offer Blender as an optional "high fidelity conversion backend" when installed (FBX with skinning, USD, Alembic), discovered on PATH; do not bundle it.

## Sources
- https://developer.blender.org/docs/release_notes/4.1/pipeline_assets_io/
- https://docs.blender.org/manual/en/latest/files/import_export/index.html
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html
- https://docs.blender.org/api/current/bpy.ops.wm.html
- https://docs.blender.org/api/current/bpy.ops.export_scene.html
- https://docs.blender.org/api/current/bpy.ops.import_scene.html
- https://docs.blender.org/api/current/info_tips_and_tricks.html (checked, no sys.argv guidance)
