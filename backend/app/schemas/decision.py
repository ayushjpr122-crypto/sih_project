"""Pydantic v2 contracts: validation at the boundary, no stack-trace leaks."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from app.services import reference_data as ref


class DecisionRequest(BaseModel):
    cargo_type: str = Field(..., min_length=2, max_length=64,
                            description="e.g. Coking Coal, Iron Ore, Grains")
    cargo_quantity_t: float = Field(..., gt=0, le=500_000,
                                    description="tonnes, must be positive")
    origin: str = Field(..., min_length=2, max_length=64,
                        description="e.g. Australia, Indonesia, Brazil, South Africa")
    destination: str = Field(..., min_length=2, max_length=64,
                             description="East-coast India port, e.g. Paradip")
    horizon_days: int = Field(default=30,
                              description="forecast horizon; one of 7, 14, 30")
    contract_type: str = Field(default="MEDIUM_TERM",
                               description="SPOT | MEDIUM_TERM | LONG_TERM (aliases accepted)")
    vessel_preference: str | None = Field(default=None, max_length=32,
                                          description="optional vessel class")
    operational_params: dict[str, Any] | None = Field(
        default=None, description="optional free-form ops hints (stored verbatim)")

    @field_validator("horizon_days")
    @classmethod
    def _horizon_valid(cls, v: int) -> int:
        if v not in (7, 14, 30):
            raise ValueError("horizon_days must be one of 7, 14, 30")
        return v

    @field_validator("destination")
    @classmethod
    def _dest_known(cls, v: str) -> str:
        # Fail fast with 422 listing valid ports; canonicalization -> 404 path
        # handled in engine for case variants. Here just check non-empty.
        if not v or not v.strip():
            raise ValueError("destination is required")
        return v.strip()

    @field_validator("vessel_preference")
    @classmethod
    def _vessel_known(cls, v: str | None) -> str | None:
        if v is None:
            return None
        cand = v.strip()
        if not cand:
            return None
        valid = [x.lower() for x in ref.VALID_VESSELS]
        if cand.lower() not in valid:
            raise ValueError(
                f"vessel_preference must be one of {', '.join(ref.VALID_VESSELS)}"
            )
        return cand


class DemoScenario(BaseModel):
    request_example: DecisionRequest
    description: str


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    app: str
    data_disclosure: str
