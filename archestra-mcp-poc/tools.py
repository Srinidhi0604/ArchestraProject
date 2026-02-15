from __future__ import annotations

import logging
import sys
from typing import Any

from mcp.server.fastmcp import FastMCP

from simulation import UniversalSimulationEngine


logger = logging.getLogger("universal-infra.tools")
logger.addHandler(logging.StreamHandler(sys.stderr))
logger.setLevel(logging.INFO)


class UniversalInfrastructureTools:
    def __init__(self, mcp: FastMCP, simulation: UniversalSimulationEngine) -> None:
        self._mcp = mcp
        self._simulation = simulation

    def register(self) -> None:
        logger.info("Registering MCP tools")

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

        @self._mcp.tool()
        async def get_systems(system_id: str | None = None, include_components: bool = False) -> list[dict[str, Any]]:
            logger.info("Request received: get_systems system_id=%s include_components=%s", system_id, include_components)
            systems = await self._simulation.get_systems()
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

        @self._mcp.tool()
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
                system = await self._simulation.get_system_state(system_id)
                return _bounded_system_view(
                    system.model_dump(mode="json"),
                    include_components=include_components,
                    include_topology=include_topology,
                    telemetry_limit=telemetry_limit,
                )
            except KeyError as error:
                logger.warning("get_system_state failed: %s", error)
                raise ValueError(str(error)) from error

        @self._mcp.tool()
        async def get_component_state(component_id: str) -> dict[str, Any]:
            logger.info("Request received: get_component_state component_id=%s", component_id)
            try:
                component = await self._simulation.get_component_state(component_id)
                return component.model_dump(mode="json")
            except KeyError as error:
                logger.warning("get_component_state failed: %s", error)
                raise ValueError(str(error)) from error

        @self._mcp.tool()
        async def get_system_topology(system_id: str) -> dict[str, Any]:
            logger.info("Request received: get_system_topology system_id=%s", system_id)
            try:
                topology = await self._simulation.get_system_topology(system_id)
                return topology.model_dump(mode="json")
            except KeyError as error:
                logger.warning("get_system_topology failed: %s", error)
                raise ValueError(str(error)) from error

        @self._mcp.tool()
        async def evaluate_system_risk(system_id: str) -> dict[str, Any]:
            logger.info("Request received: evaluate_system_risk system_id=%s", system_id)
            try:
                risk = await self._simulation.evaluate_system_risk(system_id)
                return risk.model_dump(mode="json")
            except KeyError as error:
                logger.warning("evaluate_system_risk failed: %s", error)
                raise ValueError(str(error)) from error

        @self._mcp.tool()
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
                result = await self._simulation.execute_control_action(
                    system_id=system_id,
                    action_type=action_type,
                    parameters=parameters or {},
                )
                return result.model_dump(mode="json")
            except KeyError as error:
                logger.warning("execute_control_action failed: %s", error)
                raise ValueError(str(error)) from error

        logger.info(
            "Tools registered: %s",
            [
                "get_systems",
                "get_system_state",
                "get_component_state",
                "get_system_topology",
                "evaluate_system_risk",
                "execute_control_action",
            ],
        )
