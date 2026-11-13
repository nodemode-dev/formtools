from app.core import registry
from app.core.registry import McpTool, Tool
from app.tools.demos import service
from app.tools.demos.router import router

DEMO_SCHEMA = {
    "type": "object",
    "properties": {"id": {"type": "string", "enum": list(service.DEMOS), "description": "photos (a photo shoot folder), family (a shelf of Form files) or bench (3D models and media)"}},
    "required": ["id"],
}


def demo_open_tool(args: dict) -> dict:
    return service.ensure(str(args.get("id", "")))


registry.register(
    Tool(
        id="demos",
        title="Demos",
        routers=(router,),
        mcp=(
            McpTool(
                "demo_open",
                "Make one of the three demo folders (generated pictures, files and models, nothing of the person's is touched) if it is not made yet, and return its path to browse or run tools on.",
                DEMO_SCHEMA,
                demo_open_tool,
            ),
        ),
    )
)
