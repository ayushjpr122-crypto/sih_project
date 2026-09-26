from tests.conftest import DEMO_PAYLOAD


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "synthetic" in body["data_disclosure"].lower()


def test_ports(client):
    r = client.get("/api/v1/ports")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] >= 4
    names = [p["port_name"] for p in body["ports"]]
    assert "Paradip" in names


def test_vessels(client):
    r = client.get("/api/v1/vessels")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 4
    names = [v["vessel_class"] for v in body["vessels"]]
    assert names == ["Handysize", "Supramax", "Panamax", "Capesize"]


def test_models(client):
    r = client.get("/api/v1/models")
    assert r.status_code == 200
    body = r.json()
    assert body["best_model_by_horizon"]["7"] == "XGBoost"
    assert body["artifacts_present"]["7"] is True


def test_demo_scenario(client):
    r = client.get("/api/v1/demo-scenario")
    assert r.status_code == 200
    body = r.json()
    assert body["request_example"]["cargo_quantity_t"] == 75000
    assert body["request_example"]["destination"] == "Paradip"
