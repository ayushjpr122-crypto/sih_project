"""Forecast service: thin wrapper over the real trained models."""
from __future__ import annotations

from typing import Any

from app.core.errors import InferenceError
from app.ml import adapter


def get_forecasts(
    origin: str, destination: str, cargo_quantity_t: float,
    vessel_class: str = "Panamax",
) -> tuple[dict[int, dict[str, Any]], float | None, dict[str, Any]]:
    try:
        forecasts, current = adapter.forecast_all_horizons(
            origin, destination, vessel_class, cargo_quantity_t
        )
        context = adapter.get_market_context(origin, destination, cargo_quantity_t)
        return forecasts, current, context
    except RuntimeError as exc:
        raise InferenceError(str(exc)) from exc


def get_model_info() -> dict[str, Any]:
    return adapter.get_model_info()
