"""FastAPI application mounting MCP server at /mcp."""
from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from starlette.routing import Mount

from core.domain_context import (
    VALID_DOMAINS,
    get_active_domain,
    get_default_domain,
    set_active_domain,
    set_default_domain,
)
from core.mcp_server import mcp
from core.registry import registry

logger = logging.getLogger("archestra.app")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    logger.info("Archestra MCP server starting")
    logger.info("Available domains: %s", registry.available)
    logger.info("MCP endpoint: http://localhost:8000/mcp")
    yield
    logger.info("Archestra MCP server shutting down")


app = FastAPI(
    title="Archestra MCP Gateway",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def inject_domain_context(request, call_next):  # type: ignore[no-untyped-def]
    """Set the active domain contextvar from the server default on every request."""
    set_active_domain(get_default_domain())
    response = await call_next(request)
    return response


@app.get("/")
async def root() -> JSONResponse:
    """Health check and endpoint directory."""
    return JSONResponse(content={
        "service": "Archestra MCP Gateway",
        "version": "0.1.0",
        "active_domain": get_active_domain(),
        "available_domains": sorted(VALID_DOMAINS),
        "endpoints": {
            "mcp": "/mcp",
            "set_domain": "POST /set_domain/{domain}",
            "active_domain": "GET /active_domain",
        },
    })


@app.post("/set_domain/{domain}")
async def set_domain(domain: str) -> JSONResponse:
    """Switch the active domain for all subsequent requests."""
    if domain not in VALID_DOMAINS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid domain: {domain}. Valid: {sorted(VALID_DOMAINS)}",
        )
    set_default_domain(domain)
    return JSONResponse(content={"status": "ok", "active_domain": domain})


@app.get("/active_domain")
async def active_domain() -> JSONResponse:
    """Return the currently active domain."""
    return JSONResponse(content={"active_domain": get_active_domain()})


# Mount MCP SSE transport using Starlette Mount
app.routes.append(Mount("/mcp", app=mcp.sse_app()))
