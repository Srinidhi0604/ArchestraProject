"""Energy domain adapter."""
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


class EnergyDomain:
    @property
    def name(self) -> str:
        return "energy"

    async def forecast(self, request: ForecastRequest) -> ForecastResult:
        now = datetime.now(timezone.utc)
        points = [
            {
                "timestamp": (now + timedelta(hours=i)).isoformat(),
                "load_mw": 450.0 + (i * 2.5),
                "price_per_mwh": 35.0 + (i * 0.8),
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
        score = 0.8 if "outage" in request.scenario.lower() else 0.3
        level = RiskLevel.HIGH if score >= 0.6 else RiskLevel.LOW
        return RiskResult(
            entity_id=request.entity_id,
            domain=self.name,
            scenario=request.scenario,
            level=level,
            score=score,
            factors=["grid_stability", "demand_surge", "weather_impact"],
        )

    async def execute_action(self, request: ActionRequest) -> ActionResult:
        return ActionResult(
            entity_id=request.entity_id,
            domain=self.name,
            action_type=request.action_type,
            success=True,
            message=f"Energy action '{request.action_type}' executed on {request.entity_id}",
            details={"dispatched": True, **request.parameters},
        )
