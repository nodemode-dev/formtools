from app.core import registry
from app.core.registry import McpTool, Tool
from app.tools.desktop import envvars, hosts
from app.tools.desktop.router import router

ENV_SCHEMA = {
    "type": "object",
    "properties": {"scope": {"type": "string", "enum": ["process", "user", "system"], "description": "Only this scope (default: every scope this system has)"}},
}


def hosts_read_tool(_: dict) -> dict:
    return hosts.read()


def env_read_tool(args: dict) -> dict:
    scope = args.get("scope")
    return envvars.scopes(str(scope) if scope else None)


registry.register(
    Tool(
        id="desktop",
        title="Desktop utilities",
        routers=(router,),
        mcp=(
            McpTool(
                "hosts_read",
                "Read the system hosts file: its path, whether formtools can write it without administrator permission, each address and host name entry (line, enabled, address, names, comment) and the raw text. Read only; edits are made in the formtools window.",
                {"type": "object", "properties": {}},
                hosts_read_tool,
            ),
            McpTool(
                "env_read",
                "Read environment variables by scope: process (this engine), user and system where the system has them. Each scope says whether the window can edit it and where it is stored. Read only; edits are made in the formtools window.",
                ENV_SCHEMA,
                env_read_tool,
            ),
        ),
    )
)
