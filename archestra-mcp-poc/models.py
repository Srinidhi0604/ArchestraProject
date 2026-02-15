from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class HealthStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    CRITICAL = "critical"


class OperationalState(str, Enum):
    RUNNING = "running"
    STANDBY = "standby"
    MAINTENANCE = "maintenance"
    OFFLINE = "offline"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TelemetryPoint(BaseModel):
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metric_name: str
    metric_value: float
    units: str


class OperationalConstraint(BaseModel):
    name: str
    min_value: float | None = None
    max_value: float | None = None
    units: str | None = None
    hard_limit: bool = True


class Component(BaseModel):
    component_id: str
    component_type: str
    system_id: str
    telemetry: list[TelemetryPoint] = Field(default_factory=list)
    operational_state: OperationalState = OperationalState.RUNNING
    health_status: HealthStatus = HealthStatus.HEALTHY
    capacity: float = Field(..., ge=0)
    current_load: float = Field(0.0, ge=0)
    metadata: dict[str, Any] = Field(default_factory=dict)


class TopologyEdge(BaseModel):
    source_component_id: str
    target_component_id: str
    relation_type: str = "flow"
    max_throughput: float | None = None


class TopologyGraph(BaseModel):
    nodes: list[str] = Field(default_factory=list)
    edges: list[TopologyEdge] = Field(default_factory=list)


class RiskState(BaseModel):
    risk_score: float = Field(0.0, ge=0.0, le=1.0)
    risk_level: RiskLevel = RiskLevel.LOW
    bottlenecks: list[str] = Field(default_factory=list)
    predicted_failures: list[str] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SystemModel(BaseModel):
    system_id: str
    system_type: str
    name: str
    location: str
    components: list[Component] = Field(default_factory=list)
    topology_graph: TopologyGraph = Field(default_factory=TopologyGraph)
    telemetry: list[TelemetryPoint] = Field(default_factory=list)
    operational_constraints: list[OperationalConstraint] = Field(default_factory=list)
    risk_state: RiskState = Field(default_factory=RiskState)
    metadata: dict[str, Any] = Field(default_factory=dict)


class RiskEvaluation(BaseModel):
    system_id: str
    risk_score: float = Field(..., ge=0.0, le=1.0)
    risk_level: RiskLevel
    bottlenecks: list[str]
    predicted_failures: list[str]
    recommendations: list[str]


class ControlActionResult(BaseModel):
    system_id: str
    action_type: str
    accepted: bool
    simulated: bool = True
    message: str
    impacted_components: list[str] = Field(default_factory=list)
    before: dict[str, Any] = Field(default_factory=dict)
    after: dict[str, Any] = Field(default_factory=dict)
    action_performed: str | None = None
    target_system_id: str | None = None
    affected_components: list[dict[str, Any]] = Field(default_factory=list)
    state_before_action: dict[str, Any] = Field(default_factory=dict)
    state_after_action: dict[str, Any] = Field(default_factory=dict)
    execution_status: str = "unknown"
    executed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
