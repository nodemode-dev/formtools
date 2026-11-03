# Blender as a headless converter (brief)

Verification note: the Blender manual pages for command-line arguments and import/export returned only navigation text via the fetch tool, so most details below are general knowledge and unverified here. Search results confirm a Blender 5.2 LTS manual and a 5.3 dev manual exist.

## Pattern (general knowledge)

- Run `blender --background --factory-startup --python convert.py -- in.fbx out.glb`; arguments after `--` are passed to the script. The script clears the default scene, calls an importer operator, then an exporter operator, then exits.
- Built-in importers/exporters include glTF 2.0, FBX, OBJ, PLY, STL, USD (including USDZ), Alembic, SVG; Collada has been removed or deprecated in newer versions (unverified).
- Verified from the 4.1 release notes: STL import/export moved to C++ with new operators `bpy.ops.wm.stl_import` and `bpy.ops.wm.stl_export` (old Python add-on legacy); PLY gained custom attribute support; USD gained armature and shape key export, scene graph and point instancing import; Alembic reads point velocities.
- License: GPL (general knowledge); using it as an external process avoids linking concerns.

formtools note: offer Blender as an optional "high fidelity conversion backend" when installed (FBX with skinning, USD, Alembic), discovered on PATH; do not bundle it.

## Sources
- https://developer.blender.org/docs/release_notes/4.1/pipeline_assets_io/
- https://docs.blender.org/manual/en/latest/files/import_export/index.html (body not retrievable)
- https://docs.blender.org/manual/en/latest/advanced/command_line/arguments.html (body not retrievable)
