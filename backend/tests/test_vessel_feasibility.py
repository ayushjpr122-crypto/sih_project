"""Vessel feasibility: deterministic gates (draft/LOA/beam/capacity/cargo)."""
from app.services import vessel_service


def test_haldia_rejects_capesize_on_draft():
    ok, reason = vessel_service.check_feasibility(
        "Capesize", "Haldia", 75000, "Coal")
    assert ok is False
    assert "Draft" in reason


def test_gangavaram_accepts_panamax_75kt():
    ok, reason = vessel_service.check_feasibility(
        "Panamax", "Gangavaram", 75000, "Coal")
    assert ok is True
    assert reason is None


def test_oversize_parcel_rejected_everywhere_small_class():
    ok, _ = vessel_service.check_feasibility(
        "Handysize", "Paradip", 75000, "Coal")
    assert ok is False  # 75kt > 98% of 35kt DWT


def test_evaluate_all_vessels_demo_parcel():
    ranked, feasible, infeasible = vessel_service.evaluate_all_vessels(
        "Paradip", 75000, "Coal", forecast_rate_7d=22.0, risk_score=0.4)
    feasible_names = [r["vessel_class"] for r in feasible]
    assert "Panamax" in feasible_names  # 75kt matches Panamax typical 75kt DWT
    assert "Handysize" not in feasible_names
    assert any(r["vessel_class"] == "Handysize" for r in infeasible)
    # Ranked cheapest-first ordering present with real scores
    assert ranked[0]["composite_score"] is not None
