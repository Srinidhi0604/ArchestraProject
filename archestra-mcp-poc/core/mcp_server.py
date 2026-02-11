"""FastMCP server with domain-agnostic tools."""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Any

# Ensure project root is on sys.path for `mcp dev core/mcp_server.py`
_project_root = str(Path(__file__).resolve().parent.parent)
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from mcp.server.fastmcp import FastMCP

from core.domain_context import get_active_domain
from core.registry import registry
from core.schemas import ActionRequest, ForecastRequest, RiskRequest
from domains.energy.tools import EnergyDomain
from domains.healthcare.tools import HealthcareDomain
from domains.logistics.tools import LogisticsDomain

logger = logging.getLogger("archestra.mcp")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)

mcp = FastMCP("archestra-mcp")

# Register all domain adapters
registry.register(EnergyDomain())
registry.register(LogisticsDomain())
registry.register(HealthcareDomain())

logger.info("Registered domains: %s", registry.available)


@mcp.tool()
async def get_forecast(
    entity_id: str,
    horizon_hours: int = 24,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a forecast for the given entity in the active domain."""
    adapter = registry.get(get_active_domain())
    request = ForecastRequest(
        entity_id=entity_id,
        horizon_hours=horizon_hours,
        parameters=parameters or {},
    )
    result = await adapter.forecast(request)
    return result.model_dump(mode="json")


@mcp.tool()
async def evaluate_risk(
    entity_id: str,
    scenario: str,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Evaluate risk for an entity under a given scenario in the active domain."""
    adapter = registry.get(get_active_domain())
    request = RiskRequest(
        entity_id=entity_id,
        scenario=scenario,
        parameters=parameters or {},
    )
    result = await adapter.evaluate_risk(request)
    return result.model_dump(mode="json")


@mcp.tool()
async def execute_action(
    action_type: str,
    entity_id: str,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute an action on an entity in the active domain."""
    adapter = registry.get(get_active_domain())
    request = ActionRequest(
        action_type=action_type,
        entity_id=entity_id,
        parameters=parameters or {},
    )
    result = await adapter.execute_action(request)
    return result.model_dump(mode="json")
