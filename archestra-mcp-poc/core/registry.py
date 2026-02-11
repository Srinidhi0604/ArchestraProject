"""Domain plugin registry with Protocol-based interface."""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from core.schemas import (
    ActionRequest,
    ActionResult,
    ForecastRequest,
    ForecastResult,
    RiskRequest,
    RiskResult,
)


@runtime_checkable
class DomainAdapter(Protocol):
    @property
    def name(self) -> str: ...

    async def forecast(self, request: ForecastRequest) -> ForecastResult: ...

    async def evaluate_risk(self, request: RiskRequest) -> RiskResult: ...

    async def execute_action(self, request: ActionRequest) -> ActionResult: ...


class DomainRegistry:
    def __init__(self) -> None:
        self._domains: dict[str, DomainAdapter] = {}

    def register(self, adapter: DomainAdapter) -> None:
        self._domains[adapter.name] = adapter

    def get(self, name: str) -> DomainAdapter:
        if name not in self._domains:
            raise KeyError(f"Domain '{name}' not registered. Available: {list(self._domains)}")
        return self._domains[name]

    @property
    def available(self) -> list[str]:
        return list(self._domains.keys())


registry = DomainRegistry()
