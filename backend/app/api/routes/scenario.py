"""GET /api/v1/demo-scenario — canonical example POST /decision body."""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["reference"])

DEMO = {
    "cargo_type": "Coking Coal",
    "cargo_quantity_t": 75000,
    "origin": "Australia",
    "destination": "Paradip",
    "horizon_days": 30,
    "contract_type": "Medium-term",
    "vessel_preference": None,
    "operational_params": {},
}


@router.get("/demo-scenario", summary="Example decision request")
async def demo_scenario():
    return {
        "description": "Coking Coal, 75000t, Australia -> Paradip, "
                       "medium-term, 30d horizon. POST this body to "
                       "/api/v1/decision.",
        "request_example": DEMO,
    }
