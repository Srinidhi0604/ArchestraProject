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

        @self._mcp.tool()
        async def get_systems() -> list[dict[str, Any]]:
            logger.info("Request received: get_systems")
            systems = await self._simulation.get_systems()
            return [system.model_dump(mode="json") for system in systems]

        @self._mcp.tool()
        async def get_system_state(system_id: str) -> dict[str, Any]:
            logger.info("Request received: get_system_state system_id=%s", system_id)
            try:
                system = await self._simulation.get_system_state(system_id)
                return system.model_dump(mode="json")
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
