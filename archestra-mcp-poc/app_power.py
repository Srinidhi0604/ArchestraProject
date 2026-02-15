from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

import anyio
from fastapi import FastAPI
from fastapi.responses import JSONResponse

from core.infra_registry import InfrastructureStateRegistry
from servers.power_server import DOMAIN_FILTER, mcp

logger = logging.getLogger("power-infra.app")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    async with anyio.create_task_group() as tg:
        mcp.session_manager._task_group = tg  # type: ignore[attr-defined]
        logger.info("Power Infrastructure MCP server starting")
        logger.info("MCP endpoint: http://localhost:8001/mcp")
        yield
        logger.info("Power Infrastructure MCP server shutting down")


app = FastAPI(
    title="Power Infrastructure MCP",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse(
        content={
            "service": "Power Infrastructure MCP",
            "version": "1.0.0",
            "domain": DOMAIN_FILTER,
            "endpoints": {"mcp": "/mcp", "health": "/healthz", "systems": "/systems"},
        }
    )


@app.get("/healthz")
async def healthz() -> JSONResponse:
    return JSONResponse(content={"status": "ok", "domain": DOMAIN_FILTER})


@app.get("/systems")
async def systems() -> JSONResponse:
    registry = await InfrastructureStateRegistry.get_instance()
    systems = await registry.get_systems(domain_filter=DOMAIN_FILTER)
    payload = [
        {
            "system_id": system.system_id,
            "system_type": system.system_type,
            "name": system.name,
        }
        for system in systems
    ]
    return JSONResponse(content=payload)


_mcp_http_app = mcp.streamable_http_app()
app.router.routes.extend(_mcp_http_app.routes)
