from __future__ import annotations

import logging
import os
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.streamable_http import TransportSecuritySettings

from core.infra_registry import InfrastructureStateRegistry

logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("sewage-mcp")

_allow_all_hosts = os.getenv("MCP_ALLOW_ALL_HOSTS", "false").lower() in {"1", "true", "yes"}

if _allow_all_hosts:
    transport_security = TransportSecuritySettings(enable_dns_rebinding_protection=False)
else:
    transport_security = TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "127.0.0.1",
            "127.0.0.1:*",
            "localhost",
            "localhost:*",
            "[::1]",
            "[::1]:*",
            "host.docker.internal",
            "host.docker.internal:*",
        ],
        allowed_origins=[
            "http://127.0.0.1",
            "http://127.0.0.1:*",
            "http://localhost",
            "http://localhost:*",
            "http://[::1]",
            "http://[::1]:*",
            "http://host.docker.internal",
            "http://host.docker.internal:*",
            "https://host.docker.internal",
            "https://host.docker.internal:*",
        ],
    )

mcp = FastMCP("sewage-infrastructure-mcp", transport_security=transport_security)
DOMAIN_FILTER = "sewage_plant"

registry: InfrastructureStateRegistry | None = None


async def get_registry() -> InfrastructureStateRegistry:
    global registry
    if registry is None:
        registry = await InfrastructureStateRegistry.get_instance()
    return registry


def _system_status(system: dict[str, Any]) -> str:
    risk_state = system.get("risk_state") if isinstance(system.get("risk_state"), dict) else {}
    level = risk_state.get("risk_level") if isinstance(risk_state, dict) else None
    if level == "critical":
        return "critical"
    if level in {"high", "medium"}:
        return "risk"
    return "healthy"


def _system_load(system: dict[str, Any]) -> float:
    components = system.get("components") if isinstance(system.get("components"), list) else []
    total_capacity = 0.0
    total_current_load = 0.0
    for component in components:
        if not isinstance(component, dict):
            continue
        capacity = component.get("capacity")
        current_load = component.get("current_load")
        if isinstance(capacity, (int, float)) and isinstance(current_load, (int, float)):
            total_capacity += float(capacity)
            total_current_load += float(current_load)

    if total_capacity > 0.0:
        return max(0.0, min(1.0, total_current_load / total_capacity))
    return 0.0


def _system_temperature(system: dict[str, Any]) -> float:
    components = system.get("components") if isinstance(system.get("components"), list) else []
    component_temperatures: list[float] = []
    for component in components:
        if not isinstance(component, dict):
            continue
        telemetry = component.get("telemetry") if isinstance(component.get("telemetry"), list) else []
        for point in telemetry:
            if not isinstance(point, dict):
                continue
            if point.get("metric_name") == "temperature" and isinstance(point.get("metric_value"), (int, float)):
                component_temperatures.append(float(point["metric_value"]))

    if component_temperatures:
        return sum(component_temperatures) / len(component_temperatures)
    return 0.0


def _serialize_system(system: dict[str, Any]) -> dict[str, Any]:
    topology = system.get("topology_graph") if isinstance(system.get("topology_graph"), dict) else {"nodes": [], "edges": []}
    payload = {
        **system,
        "status": _system_status(system),
        "load": _system_load(system),
        "temperature": _system_temperature(system),
        "topology": topology,
    }
    return payload


def _compact_system(system: dict[str, Any]) -> dict[str, Any]:
    components = system.get("components") if isinstance(system.get("components"), list) else []
    risk_state = system.get("risk_state") if isinstance(system.get("risk_state"), dict) else {}
    return {
        "system_id": system.get("system_id"),
        "system_type": system.get("system_type"),
        "name": system.get("name"),
        "location": system.get("location"),
        "status": _system_status(system),
        "load": _system_load(system),
        "temperature": _system_temperature(system),
        "component_count": len(components),
        "risk_state": {
            "risk_score": risk_state.get("risk_score"),
            "risk_level": risk_state.get("risk_level"),
            "bottlenecks": risk_state.get("bottlenecks", []),
            "predicted_failures": risk_state.get("predicted_failures", []),
            "recommendations": risk_state.get("recommendations", []),
        },
    }


def _bounded_system_view(
    system: dict[str, Any],
    include_components: bool,
    include_topology: bool,
    telemetry_limit: int,
) -> dict[str, Any]:
    payload = _serialize_system(system)
    if not include_components:
        payload.pop("components", None)
    if not include_topology:
        payload.pop("topology_graph", None)
        payload.pop("topology", None)

    telemetry = payload.get("telemetry") if isinstance(payload.get("telemetry"), list) else []
    safe_limit = max(0, min(telemetry_limit, 100))
    if safe_limit == 0:
        payload["telemetry"] = []
    else:
        payload["telemetry"] = telemetry[-safe_limit:]

    return payload


@mcp.tool()
async def get_systems(system_id: str | None = None, include_components: bool = False) -> list[dict[str, Any]]:
    logger.info("Request received: get_systems system_id=%s include_components=%s", system_id, include_components)
    reg = await get_registry()
    systems = await reg.get_systems(domain_filter=DOMAIN_FILTER)
    serialized = [_serialize_system(system.model_dump(mode="json")) for system in systems]

    if isinstance(system_id, str) and system_id.strip():
        target = system_id.strip()
        scoped = [system for system in serialized if system.get("system_id") == target]
        if not scoped:
            raise ValueError(f"System not found: {target}")
        return [
            _bounded_system_view(system, include_components=include_components, include_topology=False, telemetry_limit=20)
            for system in scoped
        ]

    if include_components:
        return [
            _bounded_system_view(system, include_components=True, include_topology=False, telemetry_limit=10)
            for system in serialized
        ]

    return [_compact_system(system) for system in serialized]


@mcp.tool()
async def get_system_state(
    system_id: str,
    include_components: bool = True,
    include_topology: bool = False,
    telemetry_limit: int = 25,
) -> dict[str, Any]:
    logger.info(
        "Request received: get_system_state system_id=%s include_components=%s include_topology=%s telemetry_limit=%s",
        system_id,
        include_components,
        include_topology,
        telemetry_limit,
    )
    try:
        reg = await get_registry()
        system = await reg.get_system_state(system_id, domain_filter=DOMAIN_FILTER)
        return _bounded_system_view(
            system.model_dump(mode="json"),
            include_components=include_components,
            include_topology=include_topology,
            telemetry_limit=telemetry_limit,
        )
    except KeyError as error:
        logger.warning("get_system_state failed: %s", error)
        raise ValueError(str(error)) from error


@mcp.tool()
async def get_component_state(component_id: str) -> dict[str, Any]:
    logger.info("Request received: get_component_state component_id=%s", component_id)
    try:
        reg = await get_registry()
        component = await reg.get_component_state(component_id, domain_filter=DOMAIN_FILTER)
        return component.model_dump(mode="json")
    except KeyError as error:
        logger.warning("get_component_state failed: %s", error)
        raise ValueError(str(error)) from error


@mcp.tool()
async def get_system_topology(system_id: str) -> dict[str, Any]:
    logger.info("Request received: get_system_topology system_id=%s", system_id)
    try:
        reg = await get_registry()
        topology = await reg.get_system_topology(system_id, domain_filter=DOMAIN_FILTER)
        return topology.model_dump(mode="json")
    except KeyError as error:
        logger.warning("get_system_topology failed: %s", error)
        raise ValueError(str(error)) from error


@mcp.tool()
async def evaluate_system_risk(system_id: str) -> dict[str, Any]:
    logger.info("Request received: evaluate_system_risk system_id=%s", system_id)
    try:
        reg = await get_registry()
        risk = await reg.evaluate_system_risk(system_id, domain_filter=DOMAIN_FILTER)
        return risk.model_dump(mode="json")
    except KeyError as error:
        logger.warning("evaluate_system_risk failed: %s", error)
        raise ValueError(str(error)) from error


@mcp.tool()
async def execute_control_action(
    system_id: str,
    action_type: str,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    logger.info(
        "Request received: execute_control_action system_id=%s action_type=%s",
        system_id,
        action_type,
    )
    try:
        reg = await get_registry()
        result = await reg.execute_control_action(
            system_id=system_id,
            action_type=action_type,
            parameters=parameters or {},
            domain_filter=DOMAIN_FILTER,
        )
        return result.model_dump(mode="json")
    except KeyError as error:
        logger.warning("execute_control_action failed: %s", error)
        raise ValueError(str(error)) from error


if __name__ == "__main__":
    logger.info("Starting Sewage Infrastructure MCP server")
    mcp.run()
