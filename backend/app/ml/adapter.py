"""Clean inference interface over the EXISTING trained ML code.

Reuses (never duplicates):
- src/models/inference.py   -> predict_freight / predict_timing / assess_risk
- src/models/vessel_model.py -> rank_feasible_vessels (hybrid scoring)
- src/models/risk_model.py   -> explain_risk (via inference.assess_risk)
- models/final/*             -> trained XGBoost + selection artifacts
- data/processed/ml_dataset.parquet -> latest-row feature context

No datasets, trained models, feature engineering, or inference logic
are reimplemented here.
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.config import settings
from app.core.logging import get_logger

log = get_logger("ml-adapter")

_REPO_ROOT = settings.repo_root
for _p in (str(_REPO_ROOT / "src" / "models"), str(_REPO_ROOT / "src" / "data")):
    if _p not in sys.path:
        sys.path.insert(0, _p)


def _require_inference():
    try:
        import inference as _inf  # type: ignore

        return _inf
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"ML inference module unavailable: {exc}") from exc


def _require_vessel_model():
    try:
        import vessel_model as _vm  # type: ignore

        return _vm
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"ML vessel module unavailable: {exc}") from exc


@lru_cache(maxsize=1)
def get_model_info() -> dict[str, Any]:
    """Describe the actual trained-model selection (data-driven, not assumed)."""
    info: dict[str, Any] = {"horizons": [7, 14, 30]}
    try:
        info["best_model_by_horizon"] = json.loads(
            settings.best_model_json.read_text()
        )
    except Exception:
        info["best_model_by_horizon"] = {"7": "unknown", "14": "unknown", "30": "unknown"}
    try:
        selection = json.loads(settings.model_selection_json.read_text())
        per_h: dict[str, Any] = {}
        for h, entry in (selection.get("per_horizon") or {}).items():
            per_h[str(h)] = {
                "model": entry.get("best_model_val"),
                "val_MAE": entry.get("val_MAE"),
                "val_RMSE": entry.get("val_RMSE"),
                "val_R2": entry.get("val_R2"),
                "test_MAE_of_best": entry.get("test_MAE_of_best"),
            }
        info["selection"] = per_h
        info["criterion"] = selection.get("criterion")
    except Exception as exc:
        log.warning("model selection metadata unreadable: %s", exc)
        info["selection"] = {}
    # Verify trained artifacts exist on disk.
    artifacts: dict[str, bool] = {}
    for h in (7, 14, 30):
        artifacts[str(h)] = (
            settings.repo_root / "models" / "final" / f"xgboost_{h}d.joblib"
        ).exists()
    info["artifacts_present"] = artifacts
    return info


def forecast_all_horizons(
    origin: str, destination: str, vessel_class: str, cargo_quantity_t: float
) -> tuple[dict[int, dict[str, Any]], float | None]:
    """Call the ACTUAL trained models for 7/14/30d. Never hardcode values.

    Returns (forecasts, current_freight_or_None).
    Raises RuntimeError on inference failure (mapped to HTTP 500 upstream).
    """
    inf = _require_inference()
    forecasts: dict[int, dict[str, Any]] = {}
    for h in (7, 14, 30):
        try:
            detail = inf.predict_freight(
                origin=origin,
                destination=destination,
                vessel_class=vessel_class,
                horizon=h,
                cargo_quantity_t=float(cargo_quantity_t),
                return_detail=True,
            )
        except Exception as exc:
            raise RuntimeError(f"forecast failed h={h}: {exc}") from exc
        if isinstance(detail, dict):
            forecasts[h] = {
                "forecast_usd_per_ton": float(detail["forecast_usd_per_ton"]),
                "model": str(detail.get("model", "unknown")),
            }
        else:  # pragma: no cover - legacy float return
            forecasts[h] = {
                "forecast_usd_per_ton": float(detail),
                "model": "unknown",
            }
    current = get_current_freight(origin, destination, vessel_class)
    return forecasts, current


def get_current_freight(origin: str, destination: str, vessel_class: str) -> float | None:
    """Current/proxy freight = latest observed rate from ml_dataset (no leakage)."""
    inf = _require_inference()
    try:
        row = inf._get_latest_row(origin, destination, vessel_class)
        if row is None:
            return None
        return float(row["freight_rate_usd_per_ton"])
    except Exception:
        return None


def get_market_context(
    origin: str, destination: str, cargo_quantity_t: float
) -> dict[str, Any]:
    """Latest feature row context (volatility, momentum, BDI/Brent) for uncertainty text."""
    inf = _require_inference()
    try:
        row = inf._get_latest_row(origin, destination, "Panamax")
        if row is None:
            return {}
        ctx = {
            "rolling_std_7": _safe_float(row.get("rolling_std_7")),
            "rolling_std_30": _safe_float(row.get("rolling_std_30")),
            "volatility_30": _safe_float(row.get("volatility_30")),
            "momentum_7": _safe_float(row.get("momentum_7")),
            "bdi_proxy": _safe_float(row.get("bdi_proxy")),
            "brent_proxy_usd": _safe_float(row.get("brent_proxy_usd")),
            "route_distance_nm": _safe_float(row.get("route_distance_nm")),
            "last_date": str(row.get("date", "")),
        }
        return {k: v for k, v in ctx.items() if v is not None}
    except Exception:
        return {}


def rank_vessels(
    destination: str,
    cargo_quantity_t: float,
    forecast_rate: float,
    ports_df,
    vessels_df,
    risk_score: float | None = None,
) -> list[dict[str, Any]]:
    """Delegate ranking to the existing hybrid vessel_model (no reimplementation)."""
    inf = _require_inference()
    vm = _require_vessel_model()
    # Canonical route context: latest row; destination overridden for port lookup.
    row = inf._get_latest_row("Australia_Hedland", destination, "Panamax")
    if row is None:  # pragma: no cover
        raise RuntimeError("no market context row for vessel ranking")
    row = row.copy()
    row["cargo_quantity_t"] = float(cargo_quantity_t)
    row["destination"] = destination
    try:
        return list(
            vm.rank_feasible_vessels(
                row, float(forecast_rate), ports_df, vessels_df, risk_score=risk_score
            )
        )
    except Exception as exc:
        raise RuntimeError(f"vessel ranking failed: {exc}") from exc


def assess_risk(
    origin: str,
    destination: str,
    vessel_class: str,
    cargo_quantity_t: float | None = None,
) -> dict[str, Any]:
    """Explainable risk via existing risk_model (through inference.assess_risk).

    When ``cargo_quantity_t`` is given, the parcel-specific drivers
    (vessel_feasibility, idle exposure) are evaluated on a copy of the
    latest market-context row with the requested parcel stamped in, by
    calling the SAME ``risk_model.explain_risk`` function upstream uses.
    No scoring logic is reimplemented here.

    NOTE: upstream vessel_model.load_constraints() uses a cwd-relative
    ``data/...`` path, so we patch it to the absolute-path CSVs for
    cwd-independence. Scoring logic itself is untouched (pure reuse).
    """
    inf = _require_inference()
    vm = _require_vessel_model()
    import pandas as _pd

    _orig = vm.load_constraints

    def _absolute_constraints():  # same return contract: (ports_df, vessels_df)
        return (
            _pd.read_csv(settings.ports_csv),
            _pd.read_csv(settings.vessels_csv),
        )

    vm.load_constraints = _absolute_constraints  # type: ignore[method-assign]
    try:
        if cargo_quantity_t is None:
            out = inf.assess_risk(origin, destination, vessel_class)
        else:
            import risk_model as _rm  # type: ignore

            row = inf._get_latest_row(origin, destination, vessel_class)
            if row is None:  # pragma: no cover
                raise RuntimeError("no market context row for risk assessment")
            row = row.copy()
            row["cargo_quantity_t"] = float(cargo_quantity_t)
            row["vessel_type"] = vessel_class
            unc = float(row.get("rolling_std_7", 1.5))
            ports_df, vessels_df = _absolute_constraints()
            out = _rm.explain_risk(
                row, forecast_uncertainty=unc,
                ports_df=ports_df, vessels_df=vessels_df,
            )
    except Exception as exc:
        raise RuntimeError(f"risk assessment failed: {exc}") from exc
    finally:
        vm.load_constraints = _orig  # type: ignore[method-assign]
    if isinstance(out, dict) and "overall" in out:
        return out
    return {"overall": "UNKNOWN", "drivers": {}}


def _safe_float(v) -> float | None:
    try:
        f = float(v)
        if f != f:  # NaN
            return None
        return f
    except Exception:
        return None


def data_disclosure() -> str:
    return (
        "Prototype uses synthetic/domain-informed data for demonstration. "
        "Production deployment requires validated historical freight, vessel, "
        "port, procurement, and voyage datasets."
    )
