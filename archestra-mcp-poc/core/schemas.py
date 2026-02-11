"""Pydantic models for MCP tool inputs and outputs."""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ForecastRequest(BaseModel):
    entity_id: str = Field(..., description="Entity to forecast")
    horizon_hours: int = Field(24, ge=1, le=8760)
    parameters: dict[str, Any] = Field(default_factory=dict)


class ForecastResult(BaseModel):
    entity_id: str
    domain: str
    horizon_hours: int
    points: list[dict[str, float | str]]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class RiskRequest(BaseModel):
    entity_id: str = Field(..., description="Entity to assess")
    scenario: str = Field(..., description="Risk scenario to evaluate")
    parameters: dict[str, Any] = Field(default_factory=dict)


class RiskResult(BaseModel):
    entity_id: str
    domain: str
    scenario: str
    level: RiskLevel
    score: float = Field(ge=0.0, le=1.0)
    factors: list[str]


class ActionRequest(BaseModel):
    action_type: str = Field(..., description="Type of action")
    entity_id: str = Field(..., description="Target entity")
    parameters: dict[str, Any] = Field(default_factory=dict)


class ActionResult(BaseModel):
    entity_id: str
    domain: str
    action_type: str
    success: bool
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
