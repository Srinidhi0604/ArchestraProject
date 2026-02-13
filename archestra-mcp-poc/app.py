"""FastAPI wrapper for universal infrastructure MCP server."""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

import anyio
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from server import mcp, simulation_engine

logger = logging.getLogger("universal-infra.app")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    async with anyio.create_task_group() as tg:
        mcp.session_manager._task_group = tg  # type: ignore[attr-defined]
        logger.info("Universal Infrastructure MCP server starting")
        logger.info("MCP endpoint: http://localhost:8010/mcp")
        yield
        logger.info("Universal Infrastructure MCP server shutting down")


app = FastAPI(
    title="Universal Infrastructure MCP",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
async def root() -> JSONResponse:
    systems = await simulation_engine.get_systems()
    return JSONResponse(content={
        "service": "Universal Infrastructure MCP",
        "version": "1.0.0",
        "systems_count": len(systems),
        "system_types": sorted({system.system_type for system in systems}),
        "endpoints": {
            "mcp": "/mcp",
            "systems": "tool:get_systems",
            "state": "tool:get_system_state",
            "risk": "tool:evaluate_system_risk",
            "control": "tool:execute_control_action",
        },
    })


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})


_mcp_http_app = mcp.streamable_http_app()
app.router.routes.extend(_mcp_http_app.routes)
