"""POST /api/v1/decision — hybrid deterministic + ML charter decision.

Route contains zero business logic: validate (Pydantic) -> engine -> persist.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.logging import get_logger
from app.db.database import get_db
from app.db import repository as repo
from app.schemas.decision import DecisionRequest
from app.services import decision_engine

router = APIRouter(tags=["decision"])
log = get_logger("routes.decision")


@router.post("/decision", summary="Charter decision for a freight scenario")
async def create_decision(payload: DecisionRequest, db: Session = Depends(get_db)):
    outcome = decision_engine.run_decision(
        cargo_type=payload.cargo_type,
        cargo_quantity_t=float(payload.cargo_quantity_t),
        origin=payload.origin,
        destination=payload.destination,
        horizon_days=int(payload.horizon_days),
        contract_type=payload.contract_type,
        vessel_preference=payload.vessel_preference,
    )
    response = outcome["response"]
    persist = outcome["persist"]
    # Best-effort persistence: never fail a valid decision on DB errors.
    try:
        scenario_id, decision_id = repo.save_full_decision(
            db,
            scenario_fields=persist["scenario_fields"],
            forecasts=persist["forecasts"],
            vessel_evals=persist["vessel_evals"],
            decision_fields=persist["decision_fields"],
        )
        response = {**response, "scenario_id": scenario_id,
                    "decision_id": decision_id}
    except Exception as exc:
        log.warning("decision persistence failed (response still served): %s", exc)
    return response
