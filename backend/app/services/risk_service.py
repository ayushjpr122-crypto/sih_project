"""Risk service: explainable LOW/MEDIUM/HIGH via existing risk_model."""
from __future__ import annotations

from typing import Any

from app.core.errors import InferenceError
from app.ml import adapter

_RISK_TO_SCORE = {"LOW": 0.15, "MEDIUM": 0.45, "HIGH": 0.85}


def assess(
    origin: str, destination: str, vessel_class: str,
    cargo_quantity_t: float | None = None,
) -> dict[str, Any]:
    try:
        out = adapter.assess_risk(
            origin, destination, vessel_class,
            cargo_quantity_t=cargo_quantity_t,
        )
    except RuntimeError as exc:
        raise InferenceError(str(exc)) from exc
    overall = str(out.get("overall", "UNKNOWN")).upper()
    if overall not in ("LOW", "MEDIUM", "HIGH"):
        overall = "MEDIUM" if out.get("drivers") else "UNKNOWN"
    drivers = out.get("drivers", {}) or {}
    flat = [
        {"driver": name, "level": d.get("level"),
         "value": d.get("value"), "explain": d.get("explain")}
        for name, d in drivers.items()
    ]
    return {
        "overall": overall,
        "score": _RISK_TO_SCORE.get(overall),
        "drivers": drivers,
        "driver_list": flat,
        "high_driver_count": out.get("high_driver_count", 0),
    }
