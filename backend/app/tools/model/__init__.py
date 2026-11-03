from app.core import registry
from app.core.registry import McpTool, Tool
from app.tools.model import service
from app.tools.model.router import router

INFO_SCHEMA = {
    "type": "object",
    "properties": {"path": {"type": "string", "description": "Absolute local path of a glb, gltf, obj, stl, ply, off or xyz model"}},
    "required": ["path"],
}
CONVERT_SCHEMA = {
    "type": "object",
    "properties": {
        "path": {"type": "string", "description": "Absolute local path of the model to convert"},
        "format": {"type": "string", "enum": list(service.WRITE), "description": "Output format"},
        "out": {"type": "string", "description": "Absolute output path; default is beside the source. An existing file is never overwritten"},
    },
    "required": ["path", "format"],
}


def formats() -> dict:
    return {"model": service.viewable_formats()}


def model_info_tool(args: dict) -> dict:
    return service.info(str(args.get("path", "")))


def model_convert_tool(args: dict) -> dict:
    out = args.get("out")
    return service.start_convert(str(args.get("path", "")), str(args.get("format", "")), str(out) if out else None)


registry.register(
    Tool(
        id="model",
        title="3D models",
        routers=(router,),
        formats=formats,
        mcp=(
            McpTool("model_info", "Read counts (meshes, vertices, triangles, materials, textures, animations, nodes), the bounding box and notes of a 3D model without rendering it.", INFO_SCHEMA, model_info_tool),
            McpTool("model_convert", "Start a job that converts a 3D model to glb, obj, stl, ply or off beside the source, never overwriting. Returns the job; poll it with job_status.", CONVERT_SCHEMA, model_convert_tool),
        ),
        startup=service.prune,
    )
)
