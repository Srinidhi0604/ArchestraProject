from __future__ import annotations

import asyncio
import logging
import sys
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

logging.basicConfig(stream=sys.stderr, level=logging.INFO)
logger = logging.getLogger("infra-registry")


class InfrastructureStateRegistry:
    _instance: InfrastructureStateRegistry | None = None
    _lock = asyncio.Lock()

    def __init__(self) -> None:
        self._systems: dict[str, SystemModel] = {}
        self._component_index: dict[str, str] = {}
        self._random_seed = 42
        import random
        self._random = random.Random(self._random_seed)
        self._last_tick = datetime.now(timezone.utc)
        self._domain_types = {
            "power": "power_grid",
            "hydro": "hydro_plant",
            "sewage": "sewage_plant",
        }

    @classmethod
    async def get_instance(cls) -> InfrastructureStateRegistry:
        async with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
                cls._instance._initialize_sample_systems()
            return cls._instance

    def resolve_domain_filter(self, domain_filter: str) -> str:
        normalized = domain_filter.strip().lower()
        if normalized in self._domain_types:
            return self._domain_types[normalized]
        if normalized in self._domain_types.values():
            return normalized
        raise ValueError(
            f"Unknown domain filter: {domain_filter}. "
            f"Available keys: {list(self._domain_types.keys())}, "
            f"values: {list(self._domain_types.values())}"
        )

    def _normalize_domain_filter(self, domain_filter: str | None) -> str | None:
        if domain_filter is None:
            return None
        return self.resolve_domain_filter(domain_filter)

    def _validate_system_domain(self, system: SystemModel, domain_filter: str | None) -> None:
        normalized_filter = self._normalize_domain_filter(domain_filter)
        if normalized_filter and system.system_type != normalized_filter:
            raise KeyError(f"System {system.system_id} does not belong to domain {normalized_filter}")

    def _initialize_sample_systems(self) -> None:
        systems = self._build_required_infrastructure_systems()
        for system in systems:
            self._systems[system.system_id] = system
            for component in system.components:
                self._component_index[component.component_id] = system.system_id
        logger.info(f"Initialized {len(systems)} sample systems")

    def _build_required_infrastructure_systems(self) -> list[SystemModel]:
        return [
            self._build_power_grid("grid_001", "North Power Grid", "North Region"),
            self._build_power_grid("grid_002", "South Power Grid", "South Region"),
            self._build_hydro_plant("hydro_001", "Riverside Hydro Plant", "Upper Valley"),
            self._build_sewage_plant("sewage_001", "Central Sewage Plant", "Industrial Zone"),
            self._build_substation("substation_001", "Main Substation", "Electronic Corridor"),
            self._build_data_center("data_center_001", "Primary Data Center", "Tech Park"),
        ]

    async def get_systems(self, domain_filter: str | None = None) -> list[SystemModel]:
        async with self._lock:
            self._tick_locked()
            systems = list(self._systems.values())
            normalized_filter = self._normalize_domain_filter(domain_filter)
            if normalized_filter:
                systems = [s for s in systems if s.system_type == normalized_filter]
            return [s.model_copy(deep=True) for s in systems]

    async def get_system_state(self, system_id: str, domain_filter: str | None = None) -> SystemModel:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            self._validate_system_domain(system, domain_filter)
            
            return system.model_copy(deep=True)

    async def get_component_state(self, component_id: str, domain_filter: str | None = None) -> Component:
        async with self._lock:
            self._tick_locked()
            system_id = self._component_index.get(component_id)
            if system_id is None:
                raise KeyError(f"Component not found: {component_id}")

            system = self._systems[system_id]
            self._validate_system_domain(system, domain_filter)

            for component in system.components:
                if component.component_id == component_id:
                    return component.model_copy(deep=True)

            raise KeyError(f"Component not found: {component_id}")

    async def get_system_topology(self, system_id: str, domain_filter: str | None = None) -> TopologyGraph:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            self._validate_system_domain(system, domain_filter)
            
            return system.topology_graph.model_copy(deep=True)

    async def evaluate_system_risk(self, system_id: str, domain_filter: str | None = None) -> RiskEvaluation:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            self._validate_system_domain(system, domain_filter)

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
        domain_filter: str | None = None,
    ) -> ControlActionResult:
        async with self._lock:
            self._tick_locked()
            system = self._systems.get(system_id)
            if system is None:
                raise KeyError(f"System not found: {system_id}")
            self._validate_system_domain(system, domain_filter)

            action = action_type.lower().strip()
            if not action:
                action = "auto_optimize"

            before_state = self._snapshot_system(system)
            before_loads = {
                component.component_id: round(component.current_load, 3)
                for component in system.components
            }

            accepted = False
            execution_status = "rejected"
            message = "No action executed"
            impacted: list[str] = []

            ranked_components = sorted(
                system.components,
                key=lambda component: self._component_utilization(component),
                reverse=True,
            )
            overloaded = [component for component in ranked_components if component.operational_state != OperationalState.OFFLINE]
            underutilized = [
                component
                for component in reversed(ranked_components)
                if component.operational_state != OperationalState.OFFLINE
            ]

            def choose_component(param_name: str, fallback: list[Component]) -> Component | None:
                requested = parameters.get(param_name)
                selected = self._find_component(system, requested)
                if selected is not None:
                    return selected
                return fallback[0] if fallback else None

            if action in {"reroute_power", "rebalance_load", "redistribute_load", "auto_optimize"}:
                source_component = choose_component("source_component_id", overloaded)
                target_component = choose_component("target_component_id", underutilized)

                if source_component is None or target_component is None:
                    message = "Unable to identify source and target components for load rebalance"
                elif source_component.component_id == target_component.component_id:
                    message = "Source and target components must be different for load rebalance"
                else:
                    available_shift = min(
                        source_component.current_load,
                        max(0.0, target_component.capacity - target_component.current_load),
                    )
                    suggested_shift = max(0.0, available_shift * 0.35)
                    requested_shift = self._safe_float(parameters.get("amount"), suggested_shift)
                    shift = max(0.0, min(requested_shift, available_shift))

                    if shift <= 0.0:
                        message = "No transferable load available between selected components"
                    else:
                        source_component.current_load = max(0.0, source_component.current_load - shift)
                        target_component.current_load = min(
                            target_component.capacity,
                            target_component.current_load + shift,
                        )
                        impacted = [source_component.component_id, target_component.component_id]
                        accepted = True
                        execution_status = "success"
                        message = f"Rebalanced {shift:.2f} load units"

            elif action in {"adjust_valve", "reduce_load", "throttle_component", "shed_load"}:
                component = choose_component("component_id", overloaded)
                if component is None:
                    message = "No component available for load reduction"
                else:
                    requested_delta = self._safe_float(parameters.get("delta"), component.current_load * 0.15)
                    reduction = max(0.0, requested_delta)
                    reduction = min(reduction, component.current_load)
                    component.current_load = max(0.0, component.current_load - reduction)
                    impacted = [component.component_id]
                    accepted = reduction > 0.0
                    execution_status = "success" if accepted else "rejected"
                    message = (
                        f"Reduced load by {reduction:.2f} units"
                        if accepted
                        else "Component load already at minimum"
                    )

            elif action in {"increase_capacity", "scale_capacity", "expand_capacity"}:
                component = choose_component("component_id", overloaded)
                if component is None:
                    message = "No component available for capacity scaling"
                else:
                    amount = self._safe_float(parameters.get("amount"), component.capacity * 0.1)
                    capacity_delta = max(0.0, amount)
                    component.capacity += capacity_delta
                    impacted = [component.component_id]
                    accepted = capacity_delta > 0.0
                    execution_status = "success" if accepted else "rejected"
                    message = (
                        f"Increased capacity by {capacity_delta:.2f} units"
                        if accepted
                        else "Capacity increase amount must be greater than zero"
                    )

            elif action in {"isolate_component", "set_operational_state", "restore_component"}:
                candidates = overloaded if action != "restore_component" else [
                    component for component in system.components if component.operational_state == OperationalState.OFFLINE
                ]
                component = choose_component("component_id", candidates)

                if component is None:
                    message = "No component available for requested operational state change"
                else:
                    requested_state = str(parameters.get("state", "")).lower().strip()
                    if action == "restore_component":
                        new_state = OperationalState.RUNNING
                    elif action == "isolate_component":
                        new_state = OperationalState.OFFLINE
                    else:
                        state_map = {
                            "running": OperationalState.RUNNING,
                            "standby": OperationalState.STANDBY,
                            "maintenance": OperationalState.MAINTENANCE,
                            "offline": OperationalState.OFFLINE,
                        }
                        new_state = state_map.get(requested_state, component.operational_state)

                    component.operational_state = new_state
                    if new_state == OperationalState.OFFLINE:
                        component.current_load = 0.0
                        component.health_status = HealthStatus.DEGRADED
                    elif component.current_load <= 0.0:
                        component.current_load = min(component.capacity * 0.35, component.capacity)
                    impacted = [component.component_id]
                    accepted = True
                    execution_status = "success"
                    message = f"Updated operational_state to {new_state.value}"

            else:
                message = f"Unsupported action_type: {action_type}"

            self._update_system_telemetry(system)
            system.risk_state = self._compute_risk_state(system)

            after_state = self._snapshot_system(system)
            after_loads = {
                component.component_id: round(component.current_load, 3)
                for component in system.components
            }

            before_components = before_state.get("components", {})
            after_components = after_state.get("components", {})
            affected_components = [
                {
                    "component_id": component_id,
                    "before": before_components.get(component_id, {}),
                    "after": after_components.get(component_id, {}),
                }
                for component_id in impacted
            ]

            if accepted and execution_status == "rejected":
                execution_status = "partial"

            return ControlActionResult(
                system_id=system_id,
                action_type=action_type,
                accepted=accepted,
                simulated=True,
                message=message,
                impacted_components=impacted,
                before=before_loads,
                after=after_loads,
                action_performed=action,
                target_system_id=system_id,
                affected_components=affected_components,
                state_before_action=before_state,
                state_after_action=after_state,
                execution_status=execution_status,
            )

    def _component_utilization(self, component: Component) -> float:
        if component.capacity <= 0.0:
            return 0.0
        return component.current_load / component.capacity

    def _safe_float(self, raw_value: Any, fallback: float) -> float:
        try:
            if raw_value is None:
                return float(fallback)
            return float(raw_value)
        except (TypeError, ValueError):
            return float(fallback)

    def _snapshot_component(self, component: Component) -> dict[str, Any]:
        return {
            "component_id": component.component_id,
            "component_type": component.component_type,
            "operational_state": component.operational_state.value,
            "health_status": component.health_status.value,
            "capacity": round(component.capacity, 4),
            "current_load": round(component.current_load, 4),
            "utilization": round(self._component_utilization(component), 6),
        }

    def _snapshot_system(self, system: SystemModel) -> dict[str, Any]:
        total_capacity = sum(component.capacity for component in system.components)
        total_load = sum(component.current_load for component in system.components)
        component_states = {
            component.component_id: self._snapshot_component(component)
            for component in system.components
        }
        return {
            "system_id": system.system_id,
            "system_type": system.system_type,
            "risk_score": round(system.risk_state.risk_score, 6),
            "risk_level": system.risk_state.risk_level.value,
            "total_capacity": round(total_capacity, 4),
            "total_load": round(total_load, 4),
            "average_utilization": round((total_load / total_capacity) if total_capacity > 0 else 0.0, 6),
            "components": component_states,
        }

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
        import math

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
        import math

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

    def _build_power_grid(self, system_id: str, name: str, location: str) -> SystemModel:
        substation_id = f"{system_id}_substation_a"
        transformer_id = f"{system_id}_transformer_b"
        line_id = f"{system_id}_line_c"
        feeder_id = f"{system_id}_feeder_d"
        components = [
            Component(component_id=substation_id, component_type="substation", system_id=system_id, capacity=120.0, current_load=65.0),
            Component(component_id=transformer_id, component_type="transformer", system_id=system_id, capacity=90.0, current_load=50.0),
            Component(component_id=line_id, component_type="transmission_line", system_id=system_id, capacity=105.0, current_load=58.0),
            Component(component_id=feeder_id, component_type="distribution_feeder", system_id=system_id, capacity=70.0, current_load=42.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="power_grid",
            name=name,
            location=location,
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id=substation_id, target_component_id=transformer_id, max_throughput=110.0),
                    TopologyEdge(source_component_id=transformer_id, target_component_id=line_id, max_throughput=95.0),
                    TopologyEdge(source_component_id=line_id, target_component_id=feeder_id, max_throughput=80.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_frequency_deviation", min_value=49.5, max_value=50.5, units="Hz"),
                OperationalConstraint(name="max_line_loading", max_value=1.05, units="ratio"),
            ],
            metadata={
                "status": "critical",
                "load": 0.94,
                "temperature": 72.0,
            },
        )

    def _build_hydro_plant(self, system_id: str, name: str, location: str) -> SystemModel:
        intake_id = f"{system_id}_intake_a"
        turbine_id = f"{system_id}_turbine_b"
        generator_id = f"{system_id}_generator_c"
        spillway_id = f"{system_id}_spillway_d"
        components = [
            Component(component_id=intake_id, component_type="intake_gate", system_id=system_id, capacity=90.0, current_load=46.0),
            Component(component_id=turbine_id, component_type="turbine", system_id=system_id, capacity=100.0, current_load=54.0),
            Component(component_id=generator_id, component_type="generator", system_id=system_id, capacity=96.0, current_load=53.0),
            Component(component_id=spillway_id, component_type="spillway", system_id=system_id, capacity=85.0, current_load=34.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="hydro_plant",
            name=name,
            location=location,
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id=intake_id, target_component_id=turbine_id, max_throughput=88.0),
                    TopologyEdge(source_component_id=turbine_id, target_component_id=generator_id, max_throughput=97.0),
                    TopologyEdge(source_component_id=intake_id, target_component_id=spillway_id, relation_type="safety_bypass", max_throughput=70.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_turbidity", max_value=12.0, units="NTU"),
                OperationalConstraint(name="min_flow", min_value=25.0, units="m3/s"),
            ],
            metadata={
                "status": "risk",
                "load": 0.74,
                "temperature": 61.0,
            },
        )

    def _build_sewage_plant(self, system_id: str, name: str, location: str) -> SystemModel:
        inlet_id = f"{system_id}_inlet_a"
        aeration_id = f"{system_id}_aeration_b"
        clarifier_id = f"{system_id}_clarifier_c"
        discharge_id = f"{system_id}_discharge_d"
        components = [
            Component(component_id=inlet_id, component_type="inlet_pump", system_id=system_id, capacity=75.0, current_load=41.0),
            Component(component_id=aeration_id, component_type="aeration_tank", system_id=system_id, capacity=88.0, current_load=55.0),
            Component(component_id=clarifier_id, component_type="clarifier", system_id=system_id, capacity=92.0, current_load=49.0),
            Component(component_id=discharge_id, component_type="discharge_unit", system_id=system_id, capacity=78.0, current_load=40.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="sewage_plant",
            name=name,
            location=location,
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id=inlet_id, target_component_id=aeration_id, max_throughput=72.0),
                    TopologyEdge(source_component_id=aeration_id, target_component_id=clarifier_id, max_throughput=80.0),
                    TopologyEdge(source_component_id=clarifier_id, target_component_id=discharge_id, max_throughput=75.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="target_ph_min", min_value=6.5, units="pH"),
                OperationalConstraint(name="target_ph_max", max_value=8.0, units="pH"),
                OperationalConstraint(name="min_do_level", min_value=2.0, units="mg/L"),
            ],
            metadata={
                "status": "risk",
                "load": 0.81,
                "temperature": 58.0,
            },
        )

    def _build_substation(self, system_id: str, name: str, location: str) -> SystemModel:
        switchyard_id = f"{system_id}_switchyard_a"
        transformer_id = f"{system_id}_transformer_b"
        components = [
            Component(component_id=switchyard_id, component_type="switchyard", system_id=system_id, capacity=82.0, current_load=66.0),
            Component(component_id=transformer_id, component_type="distribution_transformer", system_id=system_id, capacity=78.0, current_load=63.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="substation",
            name=name,
            location=location,
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id=switchyard_id, target_component_id=transformer_id, max_throughput=74.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_bus_loading", max_value=0.98, units="ratio"),
            ],
            metadata={
                "status": "critical",
                "load": 0.91,
                "temperature": 69.0,
            },
        )

    def _build_data_center(self, system_id: str, name: str, location: str) -> SystemModel:
        rack_id = f"{system_id}_rack_a"
        chiller_id = f"{system_id}_chiller_b"
        components = [
            Component(component_id=rack_id, component_type="compute_rack", system_id=system_id, capacity=96.0, current_load=72.0),
            Component(component_id=chiller_id, component_type="cooling_chiller", system_id=system_id, capacity=88.0, current_load=67.0),
        ]

        return SystemModel(
            system_id=system_id,
            system_type="data_center",
            name=name,
            location=location,
            components=components,
            topology_graph=TopologyGraph(
                nodes=[component.component_id for component in components],
                edges=[
                    TopologyEdge(source_component_id=rack_id, target_component_id=chiller_id, relation_type="thermal_dependency", max_throughput=80.0),
                ],
            ),
            operational_constraints=[
                OperationalConstraint(name="max_temperature", max_value=28.0, units="C"),
                OperationalConstraint(name="max_power_usage_effectiveness", max_value=1.65, units="ratio"),
            ],
            metadata={
                "status": "risk",
                "load": 0.83,
                "temperature": 64.0,
            },
        )
