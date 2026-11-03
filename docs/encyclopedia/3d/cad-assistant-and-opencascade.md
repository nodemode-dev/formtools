# CAD Assistant and Open CASCADE (STEP/IGES)

## Open CASCADE Technology (OCCT)

- C++ kernel for B-rep modeling, visualization and data exchange. License: LGPL 2.1 with an additional exception (read the exception shipped with your release). Latest listed on the product page: OCCT 8.0.1.
- Data exchange: STEP and IGES named explicitly, XDE for assemblies with names/colors/metadata. F3D reads STEP, IGES, BREP, XBF and FCStd through OCCT.
- Visualization services: interactive views, selection/highlight, hidden-line removal, materials, clipping.

formtools note: OCCT is the only credible open-source STEP/IGES reader. Dynamic linking satisfies LGPL; plan a tessellation step (B-rep to mesh) with user-set deflection tolerance.

## CAD Assistant (Open Cascade's free viewer/converter)

- Free for personal and commercial use, offline.
- View features: assembly tree with show/hide, part properties, Blinn-Phong and PBR material editing, clipping planes and boxes, texture toggle, GPU path-tracing renderer for photoreal screenshots (desktop), PNG export, OS file associations.
- Measurement: area, volume, centroid for selected parts, product and name info.
- Formats native: STEP (AP203/214/242), IGES, glTF, BREP, OBJ, VRML, XBF. Mesh import: COLLADA, 3DS, FBX, BLEND (via assimp), 3DM. PLY and STL view/export. Commercial add-ons are view-only for IFC, JT, ACIS, DXF, Parasolid.
- Platforms: Windows 64-bit, macOS, Android, iOS, Linux AppImage.
- Version shown on the page is 1.6.0 dated 2021-10-05, so the page may be stale or the app slow-moving; verify the current release. Page notes files under ~50 MB are safe and multi-million-triangle scenes can crash weak GPUs.

formtools note: CAD Assistant is the UX target for "open STEP, show tree, measure, section, export glTF/STL"; its clipping plane and assembly tree are must-haves. It is closed-source freeware, so reimplement on OCCT.

## Sources
- https://www.opencascade.com/products/cad-assistant/
- https://occt3d.com/open-cascade-technology/index.html
- https://f3d.app/docs/next/user/SUPPORTED_FORMATS
