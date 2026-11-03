from app.core import jobs, registry
from app.core.errors import ApiError
from app.core.registry import McpTool, Tool
from app.tools.batch import actions, rename, service
from app.tools.batch.pool import runner
from app.tools.batch.router import router

ACTION_ITEM = {
    "type": "object",
    "properties": {"id": {"type": "string"}, "params": {"type": "object"}},
    "required": ["id"],
}

OUTPUT_SCHEMA = {
    "type": "object",
    "description": "format (same, jpeg, png, webp, avif, tiff, bmp, gif), quality, folder, subfolder, naming, overwrite (skip, replace, rename), keep_metadata, keep_folders, keep_dates",
}

BATCH_SCHEMA = {
    "type": "object",
    "properties": {
        "inputs": {"type": "array", "items": {"type": "string"}, "description": "Absolute paths of pictures or folders"},
        "recursive": {"type": "boolean"},
        "extensions": {"type": "array", "items": {"type": "string"}},
        "actions": {"type": "array", "items": ACTION_ITEM},
        "output": OUTPUT_SCHEMA,
    },
    "required": ["inputs"],
}

RENAME_SCHEMA = {
    "type": "object",
    "properties": {
        "paths": {"type": "array", "items": {"type": "string"}},
        "rules": {"type": "array", "items": {"type": "object"}, "description": "replace, case, insert, remove, counter, date, trim or extension rules, applied in order"},
    },
    "required": ["paths"],
}


def batch_actions_tool(_: dict) -> dict:
    return {"actions": actions.CATALOG}


def batch_plan_tool(args: dict) -> dict:
    return service.plan(args)


def batch_run_tool(args: dict) -> dict:
    return service.run(args)


def job_status_tool(args: dict) -> dict:
    job_id = str(args.get("id", ""))
    if not job_id:
        raise ApiError(400, "a job id is needed")
    return jobs.get(job_id).to_dict()


def rename_plan_tool(args: dict) -> dict:
    return rename.plan(args)


def rename_apply_tool(args: dict) -> dict:
    return rename.apply(args)


def rename_undo_tool(args: dict) -> dict:
    return rename.undo(args)


registry.register(
    Tool(
        id="batch",
        title="Batch",
        routers=(router,),
        mcp=(
            McpTool("batch_actions", "List the batch actions (resize, crop, adjust, watermark and more) with their parameters.", {"type": "object", "properties": {}}, batch_actions_tool),
            McpTool("batch_plan", "Show which files a batch run would write and where, without writing anything.", BATCH_SCHEMA, batch_plan_tool),
            McpTool("batch_run", "Start a batch conversion job and return it; poll it with job_status.", BATCH_SCHEMA, batch_run_tool),
            McpTool("job_status", "Read a job's state, progress, errors and result.", {"type": "object", "properties": {"id": {"type": "string"}}, "required": ["id"]}, job_status_tool),
            McpTool("rename_plan", "Preview a bulk rename: each file's new name and any conflict.", RENAME_SCHEMA, rename_plan_tool),
            McpTool("rename_apply", "Apply a bulk rename (refused when any name conflicts) and return an undo id.", RENAME_SCHEMA, rename_apply_tool),
            McpTool("rename_undo", "Undo a bulk rename by its undo id.", {"type": "object", "properties": {"undo": {"type": "string"}}, "required": ["undo"]}, rename_undo_tool),
        ),
        shutdown=runner.close,
    )
)
