"""Forecast service hits the REAL trained models (no hardcoding)."""
from app.services import forecast_service


def test_forecasts_all_horizons_real_models():
    forecasts, current, context = forecast_service.get_forecasts(
        "Australia_Hedland", "Gangavaram", 75000.0, vessel_class="Panamax"
    )
    assert set(forecasts) == {7, 14, 30}
    for h, f in forecasts.items():
        assert f["forecast_usd_per_ton"] > 0
        assert "xgboost" in f["model"].lower()
    assert current is not None and current > 0
    assert "rolling_std_7" in context or "volatility_30" in context


def test_model_info_reports_xgboost():
    info = forecast_service.get_model_info()
    assert info["best_model_by_horizon"]["30"] == "XGBoost"
    assert info["selection"]["7"]["model"] == "XGBoost"
