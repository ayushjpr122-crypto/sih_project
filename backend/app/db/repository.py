"""Repository: intent-based persistence helpers (services never touch ORM directly)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Decision, Forecast, Scenario, VesselEvaluation


def save_full_decision(
    db: Session,
    scenario_fields: dict[str, Any],
    forecasts: dict[int, dict[str, Any]],
    vessel_evals: list[dict[str, Any]],
    decision_fields: dict[str, Any],
) -> tuple[int, int]:
    """Persist scenario + forecasts + vessel evals + decision. Returns (scenario_id, decision_id)."""
    scenario = Scenario(**scenario_fields)
    db.add(scenario)
    db.flush()  # assign scenario.id
    for horizon, f in forecasts.items():
        db.add(
            Forecast(
                scenario_id=scenario.id,
                horizon_days=int(horizon),
                forecast_usd_per_ton=float(f["forecast_usd_per_ton"]),
                model_name=str(f.get("model", "unknown")),
            )
        )
    for ev in vessel_evals:
        db.add(
            VesselEvaluation(
                scenario_id=scenario.id,
                vessel_class=ev["vessel_class"],
                feasible=bool(ev["feasible"]),
                composite_score=ev.get("composite_score"),
                utilization=ev.get("utilization"),
                reason=ev.get("reason"),
            )
        )
    decision = Decision(
        scenario_id=scenario.id,
        recommended_vessel=decision_fields.get("recommended_vessel"),
        timing=decision_fields["timing"],
        risk=decision_fields["risk"],
        summary_json=json.dumps(decision_fields.get("summary", {})),
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)
    return scenario.id, decision.id
