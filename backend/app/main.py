import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.core import config, errors, registry, runtime
from app.core.guard import HostGuard
from app.routers import fs, jobs, live, mcp, system

log = logging.getLogger("formtools")


@asynccontextmanager
async def lifespan(_: FastAPI):
    data = config.data_dir()
    runtime.start_logging(data)
    for name, reason in registry.failed().items():
        log.error("tool %s is not available: %s", name, reason)
    asyncio.get_running_loop().run_in_executor(None, registry.startup)
    yield
    registry.shutdown()
    runtime.stop_logging()


def build() -> FastAPI:
    registry.discover()
    app = FastAPI(title=config.APP_NAME, version=config.VERSION, lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
    errors.install(app)
    app.include_router(system.router)
    app.include_router(fs.router)
    app.include_router(mcp.router)
    app.include_router(live.router)
    app.include_router(jobs.router)
    for router in registry.routers():
        app.include_router(router)
    dist = config.dist_dir()
    if dist is not None:
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="ui")
    app.add_middleware(HostGuard)
    return app


app = build()
