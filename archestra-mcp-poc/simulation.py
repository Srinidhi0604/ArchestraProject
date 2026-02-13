from __future__ import annotations

import asyncio
import math
import random
from datetime import datetime, timezone
from typing import Any

from models import (
    Component,
    ControlActionResult,
    HealthStatus,
    OperationalConstraint,
    OperationalState,
    RiskEvaluation,
    RiskLevel,
    RiskState,
    SystemModel,
    TelemetryPoint,
    TopologyEdge,
    TopologyGraph,
)


class UniversalSimulationEngine:
    def __init__(self) -> None:
        self._systems: dict[str, SystemModel] = {}
        self._component_index: dict[str, str] = {}
        self._lock = asyncio.Lock()
        self._random = random.Random(42)
        self._last_tick = datetime.now(timezone.utc)

    def initialize_sample_systems(self) -> None:
        power = self._build_power_grid()
        hydro = self._build_hydro_plant()
        sewage = self._build_sewage_plant()

        for system in (power, hydro, sewage):
            self._systems[system.system_id] = system
            for component in system.components:
                self._component_index[component.component_id] = system.system_id

    async def get_systems(self) -> list[SystemModel]:
        async with self._lock:
            self._tick_locked()
            return [system.model_copy(deep=True) for system in self._systems.values()]

    async def get_system_state(self, system_id: str) -> SystemModel:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            return system.model_copy(deep=True)

    async def get_component_state(self, component_id: str) -> Component:
        async with self._lock:
            self._tick_locked()
            system_id = self._component_index.get(component_id)
            if system_id is None:
                raise KeyError(f"Component not found: {component_id}")

            system = self._systems[system_id]
            for component in system.components:
                if component.component_id == component_id:
                    return component.model_copy(deep=True)

            raise KeyError(f"Component not found: {component_id}")

    async def get_system_topology(self, system_id: str) -> TopologyGraph:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            return system.topology_graph.model_copy(deep=True)

    async def evaluate_system_risk(self, system_id: str) -> RiskEvaluation:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")

            risk_state = self._compute_risk_state(system)
            system.risk_state = risk_state

            return RiskEvaluation(
                system_id=system.system_id,
                risk_score=risk_state.risk_score,
                risk_level=risk_state.risk_level,
                bottlenecks=risk_state.bottlenecks,
                predicted_failures=risk_state.predicted_failures,
                recommendations=risk_state.recommendations,
            )

    async def execute_control_action(
        self,
        system_id: str,
        action_type: str,
        parameters: dict[str, Any],
    ) -> ControlActionResult:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")

            before_loads = {
                component.component_id: round(component.current_load, 3)
                for component in system.components
            }

            impacted: list[str] = []
            accepted = True
            action = action_type.lower().strip()

            if action == "reroute_power":
                source = parameters.get("source_component_id")
                target = parameters.get("target_component_id")
                amount = float(parameters.get("amount", 5.0))
                source_component = self._find_component(system, source)
                target_component = self._find_component(system, target)
                if source_component is None or target_component is None:
                    accepted = False
                    message = "source_component_id and target_component_id are required"
                else:
                    shift = max(0.0, min(amount, source_component.current_load))
                    source_component.current_load = max(0.0, source_component.current_load - shift)
                    target_component.current_load = min(target_component.capacity, target_component.current_load + shift)
                    impacted = [source_component.component_id, target_component.component_id]
                    message = f"Rerouted {shift:.2f} load units"

            elif action == "adjust_valve":
                component_id = parameters.get("component_id")
                delta = float(parameters.get("delta", -3.0))
                component = self._find_component(system, component_id)
                if component is None:
                    accepted = False
                    message = "component_id is required"
                else:
                    component.current_load = max(0.0, min(component.capacity, component.current_load + delta))
                    impacted = [component.component_id]
                    message = f"Adjusted valve by delta={delta:.2f}"

            elif action == "increase_capacity":
                component_id = parameters.get("component_id")
                amount = float(parameters.get("amount", 5.0))
                component = self._find_component(system, component_id)
                if component is None:
                    accepted = False
                    message = "component_id is required"
                else:
                    component.capacity += max(0.0, amount)
                    impacted = [component.component_id]
                    message = f"Increased capacity by {amount:.2f}"

            elif action == "isolate_component":
                component_id = parameters.get("component_id")
                component = self._find_component(system, component_id)
                if component is None:
                    accepted = False
                    message = "component_id is required"
                else:
                    component.operational_state = OperationalState.OFFLINE
                    component.current_load = 0.0
                    component.health_status = HealthStatus.DEGRADED
                    impacted = [component.component_id]
                    message = "Component isolated successfully"

            else:
                accepted = False
                message = f"Unsupported action_type: {action_type}"

            self._update_system_telemetry(system)
            system.risk_state = self._compute_risk_state(system)

            after_loads = {
                component.component_id: round(component.current_load, 3)
                for component in system.components
            }

            return ControlActionResult(
                system_id=system_id,
                action_type=action_type,
                accepted=accepted,
                simulated=True,
                message=message,
                impacted_components=impacted,
                before=before_loads,
                after=after_loads,
            )

    def _tick_locked(self) -> None:
        now = datetime.now(timezone.utc)
        elapsed = max(0.0, (now - self._last_tick).total_seconds())

        if elapsed < 1.0:
            return

        self._last_tick = now
        cadence = min(10, max(1, int(elapsed)))

        for _ in range(cadence):
            for system in self._systems.values():
                self._simulate_system_once(system)
                self._update_system_telemetry(system)
                system.risk_state = self._compute_risk_state(system)

    def _simulate_system_once(self, system: SystemModel) -> None:
        for component in system.components:
            if component.operational_state == OperationalState.OFFLINE:
                continue

            if system.system_type == "power_grid":
                self._simulate_power_component(component)
            elif system.system_type == "hydro_plant":
                self._simulate_hydro_component(component)
            elif system.system_type == "sewage_plant":
                self._simulate_sewage_component(component)
            else:
                self._simulate_generic_component(component)

            utilization = component.current_load / max(component.capacity, 1e-6)
            if utilization > 0.98:
                component.health_status = HealthStatus.CRITICAL
            elif utilization > 0.85:
                component.health_status = HealthStatus.DEGRADED
            else:
                if component.health_status != HealthStatus.CRITICAL:
                    component.health_status = HealthStatus.HEALTHY

    def _simulate_power_component(self, component: Component) -> None:
        oscillation = 0.5 + 0.5 * math.sin(datetime.now(timezone.utc).timestamp() / 30.0)
        base = component.capacity * (0.55 + 0.3 * oscillation)
        noise = self._random.uniform(-2.5, 2.5)

        if self._random.random() < 0.08:
            noise += self._random.uniform(8.0, 16.0)

        component.current_load = max(0.0, min(component.capacity * 1.1, base + noise))

        now = datetime.now(timezone.utc)
        self._append_telemetry(component, "voltage", self._random.uniform(218.0, 242.0), "V", now)
        self._append_telemetry(component, "frequency", self._random.uniform(49.6, 50.4), "Hz", now)
        self._append_telemetry(component, "load", component.current_load, "MW", now)

    def _simulate_hydro_component(self, component: Component) -> None:
        base = component.capacity * self._random.uniform(0.45, 0.72)
        surge = self._random.uniform(10.0, 20.0) if self._random.random() < 0.07 else 0.0
        component.current_load = max(0.0, min(component.capacity * 1.15, base + surge))

        now = datetime.now(timezone.utc)
        self._append_telemetry(component, "flow_rate", self._random.uniform(35.0, 115.0), "m3/s", now)
        self._append_telemetry(component, "turbidity", self._random.uniform(2.0, 11.0), "NTU", now)
        self._append_telemetry(component, "load", component.current_load, "MW", now)

    def _simulate_sewage_component(self, component: Component) -> None:
        base = component.capacity * self._random.uniform(0.5, 0.82)
        overload = self._random.uniform(6.0, 14.0) if self._random.random() < 0.1 else 0.0
        component.current_load = max(0.0, min(component.capacity * 1.2, base + overload))

        now = datetime.now(timezone.utc)
        self._append_telemetry(component, "ph", self._random.uniform(6.4, 8.1), "pH", now)
        self._append_telemetry(component, "do_level", self._random.uniform(1.4, 8.6), "mg/L", now)
        self._append_telemetry(component, "load", component.current_load, "MLD", now)

    def _simulate_generic_component(self, component: Component) -> None:
        base = component.capacity * self._random.uniform(0.4, 0.75)
        component.current_load = max(0.0, min(component.capacity, base + self._random.uniform(-1.0, 1.0)))
        now = datetime.now(timezone.utc)
        self._append_telemetry(component, "load", component.current_load, "units", now)

    def _update_system_telemetry(self, system: SystemModel) -> None:
        now = datetime.now(timezone.utc)
        total_capacity = sum(component.capacity for component in system.components)
        total_load = sum(component.current_load for component in system.components)
        avg_utilization = (total_load / total_capacity) if total_capacity > 0 else 0.0

        system.telemetry.append(
            TelemetryPoint(
                timestamp=now,
                metric_name="aggregate_load",
                metric_value=total_load,
                units="units",
            )
        )
        system.telemetry.append(
            TelemetryPoint(
                timestamp=now,
                metric_name="average_utilization",
                metric_value=avg_utilization,
                units="ratio",
            )
        )

        if len(system.telemetry) > 500:
            system.telemetry = system.telemetry[-500:]

    def _compute_risk_state(self, system: SystemModel) -> RiskState:
        utilizations: list[tuple[str, float]] = []
        predicted_failures: list[str] = []

        critical_count = 0
        degraded_count = 0

        for component in system.components:
            utilization = component.current_load / max(component.capacity, 1e-6)
            utilizations.append((component.component_id, utilization))

            if component.health_status == HealthStatus.CRITICAL:
                critical_count += 1
                predicted_failures.append(component.component_id)
            elif component.health_status == HealthStatus.DEGRADED:
                degraded_count += 1

            if utilization > 1.0:
                predicted_failures.append(component.component_id)

        utilizations.sort(key=lambda item: item[1], reverse=True)
        bottlenecks = [component_id for component_id, util in utilizations[:3] if util > 0.8]

        avg_utilization = sum(util for _, util in utilizations) / max(len(utilizations), 1)
        score = (0.50 * min(avg_utilization, 1.0)) + (0.30 * (critical_count / max(len(utilizations), 1))) + (0.20 * (degraded_count / max(len(utilizations), 1)))
        score = max(0.0, min(1.0, score))

        if score >= 0.85:
            level = RiskLevel.CRITICAL
        elif score >= 0.65:
            level = RiskLevel.HIGH
        elif score >= 0.35:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW

        recommendations: list[str] = []
        if bottlenecks:
            recommendations.append("Reroute workload away from bottleneck components")
        if critical_count > 0:
            recommendations.append("Isolate or inspect critical components immediately")
        if avg_utilization > 0.85:
            recommendations.append("Increase reserve capacity or reduce upstream inflow")
        if not recommendations:
            recommendations.append("Maintain current operating profile and continue monitoring")

        return RiskState(
            risk_score=score,
            risk_level=level,
            bottlenecks=bottlenecks,
            predicted_failures=sorted(set(predicted_failures)),
            recommendations=recommendations,
        )

    def _find_component(self, system: SystemModel, component_id: Any) -> Component | None:
        if not isinstance(component_id, str):
            return None
        for component in system.components:
            if component.component_id == component_id:
                return component
        return None

    def _append_telemetry(
        self,
        component: Component,
        metric_name: str,
        metric_value: float,
        units: str,
        timestamp: datetime,
    ) -> None:
        component.telemetry.append(
            TelemetryPoint(
                timestamp=timestamp,
                metric_name=metric_name,
                metric_value=metric_value,
                units=units,
            )
        )
        if len(component.telemetry) > 300:
            component.telemetry = component.telemetry[-300:]

    def _build_power_grid(self) -> SystemModel:
        system_id = "sys-power-grid-1"
        components = [
            Component(component_id="cmp-substation-a", component_type="substation", system_id=system_id, capacity=120.0, current_load=65.0),
            Component(component_id="cmp-transformer-b", component_type="transformer", system_id=system_id, capacity=90.0, current_load=50.0),
            Component(component_id="cmp-line-c", component_type="transmission_line", system_id=system_id, capacity=105.0, current_load=58.0),
            Component(component_id="cmp-feeder-d", component_type="distribution_feeder", system_id=system_id, capacity=70.0, current_load=42.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="power_grid",
            name="Metro Power Grid",
            location="North Region",
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id="cmp-substation-a", target_component_id="cmp-transformer-b", max_throughput=110.0),
                    TopologyEdge(source_component_id="cmp-transformer-b", target_component_id="cmp-line-c", max_throughput=95.0),
                    TopologyEdge(source_component_id="cmp-line-c", target_component_id="cmp-feeder-d", max_throughput=80.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_frequency_deviation", min_value=49.5, max_value=50.5, units="Hz"),
                OperationalConstraint(name="max_line_loading", max_value=1.05, units="ratio"),
            ],
        )

    def _build_hydro_plant(self) -> SystemModel:
        system_id = "sys-hydro-1"
        components = [
            Component(component_id="cmp-intake-a", component_type="intake_gate", system_id=system_id, capacity=90.0, current_load=46.0),
            Component(component_id="cmp-turbine-b", component_type="turbine", system_id=system_id, capacity=100.0, current_load=54.0),
            Component(component_id="cmp-generator-c", component_type="generator", system_id=system_id, capacity=96.0, current_load=53.0),
            Component(component_id="cmp-spillway-d", component_type="spillway", system_id=system_id, capacity=85.0, current_load=34.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="hydro_plant",
            name="Riverside Hydro Station",
            location="Upper Valley",
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id="cmp-intake-a", target_component_id="cmp-turbine-b", max_throughput=88.0),
                    TopologyEdge(source_component_id="cmp-turbine-b", target_component_id="cmp-generator-c", max_throughput=97.0),
                    TopologyEdge(source_component_id="cmp-intake-a", target_component_id="cmp-spillway-d", relation_type="safety_bypass", max_throughput=70.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_turbidity", max_value=12.0, units="NTU"),
                OperationalConstraint(name="min_flow", min_value=25.0, units="m3/s"),
            ],
        )

    def _build_sewage_plant(self) -> SystemModel:
        system_id = "sys-sewage-1"
        components = [
            Component(component_id="cmp-inlet-a", component_type="inlet_pump", system_id=system_id, capacity=75.0, current_load=41.0),
            Component(component_id="cmp-aeration-b", component_type="aeration_tank", system_id=system_id, capacity=88.0, current_load=55.0),
            Component(component_id="cmp-clarifier-c", component_type="clarifier", system_id=system_id, capacity=92.0, current_load=49.0),
            Component(component_id="cmp-discharge-d", component_type="discharge_unit", system_id=system_id, capacity=78.0, current_load=40.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="sewage_plant",
            name="Central Wastewater Plant",
            location="Industrial Zone",
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id="cmp-inlet-a", target_component_id="cmp-aeration-b", max_throughput=72.0),
                    TopologyEdge(source_component_id="cmp-aeration-b", target_component_id="cmp-clarifier-c", max_throughput=80.0),
                    TopologyEdge(source_component_id="cmp-clarifier-c", target_component_id="cmp-discharge-d", max_throughput=75.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="target_ph_min", min_value=6.5, units="pH"),
                OperationalConstraint(name="target_ph_max", max_value=8.0, units="pH"),
                OperationalConstraint(name="min_do_level", min_value=2.0, units="mg/L"),
            ],
        )
