"""Hybrid deterministic + ML decision engine.

Pipeline:
  normalize -> current/proxy freight -> ML forecasts (7/14/30) -> trend ->
  hard-constraint feasibility -> hybrid ranking -> timing -> risk ->
  idle insight -> explainable recommendation -> persistence payload
"""
from __future__ import annotations

from typing import Any

from app.core.errors import InferenceError
from app.ml import adapter
from app.services import (
    forecast_service,
    idle_service,
    reference_data as ref,
    risk_service,
    timing_service,
    vessel_service,
)

_RISK_TO_SCORE = {"LOW": 0.15, "MEDIUM": 0.45, "HIGH": 0.85, "UNKNOWN": 0.5}


def run_decision(
    cargo_type: str,
    cargo_quantity_t: float,
    origin: str,
    destination: str,
    horizon_days: int,
    contract_type: str,
    vessel_preference: str | None = None,
) -> dict[str, Any]:
    # 1. Normalize (raises 400/404 with useful messages).
    cargo_canonical = ref.normalize_cargo(cargo_type)
    origin_c = ref.normalize_origin(origin)
    dest_c = ref.normalize_destination(destination)
    contract_c = ref.normalize_contract(contract_type)
    preference_c = ref.normalize_vessel(vessel_preference) if vessel_preference else None

    # 2. Forecasts from ACTUAL trained models (proxy vessel = preference or Panamax).
    proxy_vessel = preference_c or "Panamax"
    try:
        forecasts, current, context = forecast_service.get_forecasts(
            origin_c, dest_c, float(cargo_quantity_t), vessel_class=proxy_vessel
        )
    except InferenceError:
        raise
    except Exception as exc:
        raise InferenceError(str(exc)) from exc

    f7 = forecasts[7]["forecast_usd_per_ton"]
    f14 = forecasts[14]["forecast_usd_per_ton"]
    f30 = forecasts[30]["forecast_usd_per_ton"]
    trend = timing_service.trend_label(current, f7, f30)

    # Uncertainty proxy: 7d rolling std from market context (labeled as proxy).
    unc = context.get("rolling_std_7", context.get("volatility_30"))

    # 3. Risk first (feeds ranking penalty), assessed on proxy vessel
    # with the requested parcel stamped in for parcel-accurate drivers.
    risk = risk_service.assess(
        origin_c, dest_c, proxy_vessel,
        cargo_quantity_t=float(cargo_quantity_t),
    )
    risk_score = _RISK_TO_SCORE.get(risk["overall"], 0.5)

    # 4. Feasibility + ranking.
    ranked, feasible, infeasible = vessel_service.evaluate_all_vessels(
        dest_c, float(cargo_quantity_t), cargo_canonical,
        forecast_rate_7d=f7, risk_score=risk_score,
    )

    # 5. Recommendation: honor a *feasible* preference, else top-ranked.
    recommended: str | None = None
    rec_detail: dict[str, Any] | None = None
    if preference_c and any(r["vessel_class"] == preference_c for r in feasible):
        recommended = preference_c
        rec_detail = next(r for r in feasible if r["vessel_class"] == preference_c)
    elif feasible:
        # feasible preserves rank order (ranked filtered); use ranked[0].
        top = ranked[0] if ranked else feasible[0]
        recommended = top["vessel_class"]
        rec_detail = top

    # 6. Timing on requested horizon.
    horizon_forecast = {7: f7, 14: f14, 30: f30}[horizon_days]
    timing, ret_pct, timing_reason = timing_service.decide_timing(current, horizon_forecast)

    # 7. Idle insight.
    idle = idle_service.describe(recommended, float(cargo_quantity_t), ranked)

    # 8. Explainable final recommendation.
    recommendation = build_recommendation(
        cargo_type=cargo_type, cargo_quantity_t=float(cargo_quantity_t),
        origin=origin, destination=dest_c, contract_c=contract_c,
        current=current, f7=f7, f14=f14, f30=f30, trend=trend,
        recommended=recommended, timing=timing, timing_reason=timing_reason,
        risk_overall=risk["overall"], infeasible=infeasible, idle_text=str(idle["insight"]),
    )

    scenario_summary = (
        f"{cargo_quantity_t:,.0f}t {cargo_type} from {origin} to {dest_c} "
        f"({contract_c}, {horizon_days}d horizon)"
    )

    response: dict[str, Any] = {
        "scenario_summary": scenario_summary,
        "normalized": {
            "cargo_type": cargo_canonical,
            "origin": origin_c,
            "destination": dest_c,
            "contract_type": contract_c,
            "vessel_preference": preference_c,
        },
        "current_freight_usd_per_ton": current,
        "current_freight_basis": (
            "latest observed synthetic rate for route/vessel proxy "
            f"({proxy_vessel})" if current is not None else None
        ),
        "forecast": {
            "h7_usd_per_ton": f7,
            "h14_usd_per_ton": f14,
            "h30_usd_per_ton": f30,
            "models": {str(k): v["model"] for k, v in forecasts.items()},
        },
        "forecast_trend": trend,
        "forecast_uncertainty_proxy": (
            {"rolling_std_7_usd_per_ton": unc,
             "basis": "7d rolling std proxy; not a calibrated interval"}
            if unc is not None else None
        ),
        "market_context": context,
        "feasible_vessels": feasible,
        "infeasible_vessels": infeasible,
        "recommended_vessel": recommended,
        "recommended_detail": rec_detail,
        "charter_timing": timing,
        "charter_timing_return_pct": ret_pct,
        "charter_timing_reason": timing_reason,
        "risk": risk["overall"],
        "risk_score": risk["score"],
        "risk_drivers": risk["driver_list"],
        "idle_insight": idle["insight"],
        "idle_utilization": idle["utilization"],
        "recommendation": recommendation,
        "data_disclosure": adapter.data_disclosure(),
    }

    persist = {
        "scenario_fields": {
            "cargo_type": cargo_canonical,
            "cargo_quantity_t": float(cargo_quantity_t),
            "origin": origin_c,
            "destination": dest_c,
            "horizon_days": int(horizon_days),
            "contract_type": contract_c,
            "vessel_preference": preference_c,
        },
        "forecasts": forecasts,
        "vessel_evals": (
            [{"vessel_class": r["vessel_class"], "feasible": True,
              "composite_score": r.get("composite_score"),
              "utilization": r.get("utilization"), "reason": r.get("explain")}
             for r in feasible]
            + [{"vessel_class": r["vessel_class"], "feasible": False,
                "composite_score": None, "utilization": None,
                "reason": r.get("reason")} for r in infeasible]
        ),
        "decision_fields": {
            "recommended_vessel": recommended,
            "timing": timing,
            "risk": risk["overall"],
            "summary": response,
        },
    }
    return {"response": response, "persist": persist}


def build_recommendation(**k) -> str:
    lines = [
        f"Scenario: {k['cargo_quantity_t']:,.0f}t {k['cargo_type']} "
        f"{k['origin']} -> {k['destination']} ({k['contract_c']}).",
    ]
    if k["current"] is not None:
        lines.append(
            f"Current/proxy freight ~${k['current']:.2f}/t; ML forecasts: "
            f"7d ${k['f7']:.2f}/t, 14d ${k['f14']:.2f}/t, 30d ${k['f30']:.2f}/t "
            f"(trend {k['trend']})."
        )
    else:
        lines.append(
            f"ML forecasts: 7d ${k['f7']:.2f}/t, 14d ${k['f14']:.2f}/t, "
            f"30d ${k['f30']:.2f}/t (trend {k['trend']})."
        )
    if k["recommended"]:
        lines.append(
            f"Recommended vessel: {k['recommended']} after hard-constraint "
            f"filtering and hybrid cost/utilization/risk ranking."
        )
    else:
        lines.append(
            "No feasible vessel class for this parcel/port combination; "
            "options: split parcel, transshipment/lighterage, or alternate "
            "discharge port."
        )
    lines.append(f"Charter timing: {k['timing']} ({k['timing_reason']}).")
    lines.append(f"Risk: {k['risk_overall']}. {k['idle_text']}")
    if k["infeasible"]:
        reasons = "; ".join(
            f"{r['vessel_class']}: {r['reason']}" for r in k["infeasible"]
        )
        lines.append(f"Infeasible: {reasons}.")
    lines.append(
        "Note: prototype uses synthetic/domain-informed data for demonstration; "
        "validate against firm freight, vessel, port, and voyage data before "
        "commercial use."
    )
    return " ".join(lines)
