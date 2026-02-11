"""Logistics domain adapter."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from core.schemas import (
    ActionRequest,
    ActionResult,
    ForecastRequest,
    ForecastResult,
    RiskLevel,
    RiskRequest,
    RiskResult,
)


class LogisticsDomain:
    @property
    def name(self) -> str:
        return "logistics"

    async def forecast(self, request: ForecastRequest) -> ForecastResult:
        now = datetime.now(timezone.utc)
        points = [
            {
                "timestamp": (now + timedelta(hours=i)).isoformat(),
                "shipments": 120 + (i * 5),
                "avg_transit_hours": 48.0 - (i * 0.5),
            }
            for i in range(min(request.horizon_hours, 12))
        ]
        return ForecastResult(
            entity_id=request.entity_id,
            domain=self.name,
            horizon_hours=request.horizon_hours,
            points=points,
        )

    async def evaluate_risk(self, request: RiskRequest) -> RiskResult:
        score = 0.55 if "delay" in request.scenario.lower() else 0.2
        level = RiskLevel.MEDIUM if score >= 0.4 else RiskLevel.LOW
        return RiskResult(
            entity_id=request.entity_id,
            domain=self.name,
            scenario=request.scenario,
            level=level,
            score=score,
            factors=["route_congestion", "weather_disruption", "carrier_capacity"],
        )

    async def execute_action(self, request: ActionRequest) -> ActionResult:
        return ActionResult(
            entity_id=request.entity_id,
            domain=self.name,
            action_type=request.action_type,
            success=True,
            message=f"Logistics action '{request.action_type}' executed on {request.entity_id}",
            details={"routed": True, **request.parameters},
        )
