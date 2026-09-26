"""Vessel service: hard-constraint feasibility + ML-hybrid ranking.

Step 1 (deterministic): draft / LOA / beam / capacity / cargo-compatibility /
port restrictions. Only feasible vessels proceed.
Step 2 (ranking): delegates to existing vessel_model.rank_feasible_vessels
(economics + utilization + fuel + idle + risk + port-slack). No fake scores.
"""
from __future__ import annotations

from typing import Any

from app.core.errors import InferenceError
from app.ml import adapter
from app.services import reference_data as ref


def check_feasibility(
    vessel_class: str, destination: str, cargo_quantity_t: float, cargo_canonical: str
) -> tuple[bool, str | None]:
    """Single-vessel hard-constraint check with human-readable reason."""
    v = ref.vessel_row(vessel_class)
    p = ref.port_row(destination)
    qty = float(cargo_quantity_t)

    if float(v["draft_m"]) > float(p["max_draft_m"]):
        return False, (
            f"Draft {v['draft_m']}m exceeds {destination} max "
            f"{p['max_draft_m']}m"
        )
    if float(v["loa_m"]) > float(p["max_loa_m"]):
        return False, (
            f"LOA {v['loa_m']}m exceeds {destination} max {p['max_loa_m']}m"
        )
    if float(v["beam_m"]) > float(p["max_beam_m"]):
        return False, (
            f"Beam {v['beam_m']}m exceeds {destination} max {p['max_beam_m']}m"
        )
    if qty > float(v["dwt_max_t"]) * 0.98:
        return False, (
            f"Cargo {qty:,.0f}t exceeds {vessel_class} usable capacity "
            f"({float(v['dwt_max_t']) * 0.98:,.0f}t @98% DWT)"
        )
    if qty < float(v["dwt_min_t"]) * 0.3:
        return False, (
            f"Cargo {qty:,.0f}t below {vessel_class} economic minimum "
            f"({float(v['dwt_min_t']) * 0.3:,.0f}t @30% DWT)"
        )
    typical = str(v.get("typical_cargo_types", "")).lower()
    if "coal" in cargo_canonical.lower() and "coal" not in typical:
        return False, f"{vessel_class} not compatible with coal cargoes"
    if "iron_ore" in cargo_canonical.lower() and "iron ore" not in typical:
        return False, f"{vessel_class} not compatible with iron-ore cargoes"
    if cargo_canonical.lower() == "grains" and "grain" not in typical:
        return False, f"{vessel_class} not suited for grain cargoes"
    return True, None


def evaluate_all_vessels(
    destination: str,
    cargo_quantity_t: float,
    cargo_canonical: str,
    forecast_rate_7d: float,
    risk_score: float | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Returns (feasible_ranked, feasible_list, infeasible_list)."""
    ports_df = ref.load_ports_df()
    vessels_df = ref.load_vessels_df()

    # Deterministic gate first (auditable reasons).
    feasible_names: list[str] = []
    infeasible: list[dict[str, Any]] = []
    for vc in ref.VALID_VESSELS:
        ok, reason = check_feasibility(vc, destination, cargo_quantity_t, cargo_canonical)
        if ok:
            feasible_names.append(vc)
        else:
            infeasible.append(
                {"vessel_class": vc, "feasible": False, "reason": reason}
            )

    ranked: list[dict[str, Any]] = []
    if feasible_names:
        try:
            all_ranked = adapter.rank_vessels(
                destination, cargo_quantity_t, forecast_rate_7d,
                ports_df, vessels_df, risk_score=risk_score,
            )
        except RuntimeError as exc:
            raise InferenceError(str(exc)) from exc
        # Keep only deterministically-feasible (belt & braces) with reasons.
        for r in all_ranked:
            if r["vessel_class"] in feasible_names:
                ranked.append(
                    {
                        "vessel_class": r["vessel_class"],
                        "feasible": True,
                        "composite_score": round(float(r["composite_score"]), 4),
                        "total_cost_usd": round(float(r["total_cost_usd"]), 2),
                        "cost_per_ton_proxy": round(float(r["cost_per_ton_proxy"]), 3),
                        "utilization": round(float(r["utilization"]), 4),
                        "fuel_proxy_usd": round(float(r["fuel_proxy_usd"]), 2),
                        "draft_slack_m": round(float(r["draft_slack_m"]), 2),
                        "explain": r.get("explain", ""),
                    }
                )
        # Any feasible vessel the ML ranker dropped (shouldn't happen) -> append plainly.
        ranked_names = {r["vessel_class"] for r in ranked}
        for vc in feasible_names:
            if vc not in ranked_names:
                ranked.append(
                    {"vessel_class": vc, "feasible": True,
                     "composite_score": None, "utilization": None,
                     "reason": "passed hard constraints; ranker returned no score"}
                )
    feasible = [r for r in ranked if r.get("vessel_class") in feasible_names]
    return ranked, feasible, infeasible
