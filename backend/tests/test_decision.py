"""Decision engine + full /decision contract (14 required fields)."""
from tests.conftest import DEMO_PAYLOAD
from app.services import decision_engine

REQUIRED_KEYS = [
    "scenario_summary", "current_freight_usd_per_ton", "forecast",
    "forecast_trend", "forecast_uncertainty_proxy", "feasible_vessels",
    "infeasible_vessels", "recommended_vessel", "charter_timing", "risk",
    "risk_drivers", "idle_insight", "recommendation",
]


def test_engine_demo_scenario_shape():
    out = decision_engine.run_decision(
        cargo_type="Coking Coal", cargo_quantity_t=75000,
        origin="Australia", destination="Paradip",
        horizon_days=30, contract_type="Medium-term")
    resp = out["response"]
    for key in REQUIRED_KEYS:
        assert key in resp, f"missing {key}"
    assert resp["forecast"]["h7_usd_per_ton"] > 0
    assert resp["forecast"]["h30_usd_per_ton"] > 0
    assert resp["charter_timing"] in ("BUY_NOW", "WAIT", "WATCH")
    assert resp["risk"] in ("LOW", "MEDIUM", "HIGH")
    assert resp["recommended_vessel"] in ("Handysize", "Supramax", "Panamax", "Capesize")
    assert isinstance(resp["recommendation"], str) and len(resp["recommendation"]) > 50


def test_full_decision_endpoint(client):
    r = client.post("/api/v1/decision", json=DEMO_PAYLOAD)
    assert r.status_code == 200, r.text
    body = r.json()
    for key in REQUIRED_KEYS:
        assert key in body, f"missing {key}"
    assert body["normalized"]["origin"] == "Australia_Hedland"
    assert body["normalized"]["cargo_type"] == "Coal"
    # No stack traces leak
    assert "traceback" not in r.text.lower()


def test_decision_persists_ids(client):
    r = client.post("/api/v1/decision", json=DEMO_PAYLOAD)
    assert r.status_code == 200
    body = r.json()
    assert body["scenario_id"] >= 1
    assert body["decision_id"] >= 1
