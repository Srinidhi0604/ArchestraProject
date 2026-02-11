"""Healthcare domain adapter."""
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


class HealthcareDomain:
    @property
    def name(self) -> str:
        return "healthcare"

    async def forecast(self, request: ForecastRequest) -> ForecastResult:
        now = datetime.now(timezone.utc)
        points = [
            {
                "timestamp": (now + timedelta(hours=i)).isoformat(),
                "patient_admissions": 30 + (i * 2),
                "bed_occupancy_pct": 72.0 + (i * 1.1),
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
        score = 0.75 if "surge" in request.scenario.lower() else 0.25
        level = RiskLevel.HIGH if score >= 0.6 else RiskLevel.LOW
        return RiskResult(
            entity_id=request.entity_id,
            domain=self.name,
            scenario=request.scenario,
            level=level,
            score=score,
            factors=["bed_availability", "staff_ratio", "icu_capacity"],
        )

    async def execute_action(self, request: ActionRequest) -> ActionResult:
        return ActionResult(
            entity_id=request.entity_id,
            domain=self.name,
            action_type=request.action_type,
            success=True,
            message=f"Healthcare action '{request.action_type}' executed on {request.entity_id}",
            details={"processed": True, **request.parameters},
        )
