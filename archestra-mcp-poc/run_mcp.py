"""Standalone MCP server runner (stdio transport for mcp dev)."""
from __future__ import annotations

import logging
import sys
from pathlib import Path

# Ensure project root is on sys.path
_project_root = str(Path(__file__).resolve().parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from server import mcp  # noqa: E402


logger = logging.getLogger("universal-infra.run")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)

if __name__ == "__main__":
    logger.info("Starting Universal Infrastructure MCP in stdio mode")
    mcp.run(transport="stdio")
