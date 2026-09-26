"""Validation: 422 pydantic errors, 404 unknown refs."""
from tests.conftest import DEMO_PAYLOAD


def test_quantity_must_be_positive(client):
    bad = {**DEMO_PAYLOAD, "cargo_quantity_t": -5}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 422


def test_horizon_must_be_valid(client):
    bad = {**DEMO_PAYLOAD, "horizon_days": 10}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 422


def test_unknown_destination_404(client):
    bad = {**DEMO_PAYLOAD, "destination": "Atlantis"}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 404


def test_unknown_origin_400(client):
    bad = {**DEMO_PAYLOAD, "origin": "Mars"}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 400


def test_unknown_cargo_400(client):
    bad = {**DEMO_PAYLOAD, "cargo_type": "Unobtainium"}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 400


def test_bad_vessel_preference_422(client):
    bad = {**DEMO_PAYLOAD, "vessel_preference": "Rowboat"}
    r = client.post("/api/v1/decision", json=bad)
    assert r.status_code == 422
