# XGBoost Evaluation — SIH26006

> Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets.

## Comparison (7 models × 3 horizons) — VAL and TEST

See `experiments/results/model_comparison_full.csv` for full numbers (42 rows). Metrics: MAE/RMSE/sMAPE/R2/DirectionalAccuracy per model/horizon/split.

### VAL

| Model | 7d MAE | 14d MAE | 30d MAE | 7d RMSE | 7d sMAPE | 7d R2 | 7d Dir |
|-------|--------|---------|---------|---------|----------|-------|--------|
| Naive | 2.319 | 2.317 | 2.627 | 3.081 | 9.95 | 0.846 | 0.0 |
| MA_7 | 1.926 | 2.009 | 2.320 | 2.568 | 8.27 | 0.893 | 68.6 |
| ExpSmooth | 2.104 | 2.124 | 2.446 | 2.796 | 9.03 | 0.873 | 68.6 |
| Ridge | 1.836 | 1.908 | 2.161 | 2.433 | 7.91 | 0.904 | 70.4 |
| MLP_Torch (7d only) | 2.183 | — | — | 2.755 | 9.86 | 0.877 | 65.8 |
| HF_PatchTST (7d only) | 3.054 | — | — | 3.715 | 13.64 | 0.776 | 60.1 |
| **XGBoost** | **1.805** | **1.849** | **1.964** | **2.401** | **7.78** | **0.907** | **71.2** |

### TEST (untouched)

| Model | 7d MAE | 14d MAE | 30d MAE | 7d RMSE | 7d sMAPE | 7d R2 | 7d Dir |
|-------|--------|---------|---------|---------|----------|-------|--------|
| Naive | 2.392 | 2.465 | 2.746 | 3.190 | 9.67 | 0.850 | 0.0 |
| MA_7 | 2.012 | 2.103 | 2.441 | 2.673 | 8.14 | 0.895 | 68.3 |
| ExpSmooth | 2.180 | 2.263 | 2.572 | 2.906 | 8.81 | 0.876 | 68.3 |
| Ridge | 1.917 | 2.013 | 2.258 | 2.540 | 7.80 | 0.905 | 70.6 |
| MLP_Torch (7d only) | 2.048 | — | — | 2.684 | 8.45 | 0.894 | 67.6 |
| HF_PatchTST (7d only) | 2.502 | — | — | 3.306 | 10.52 | 0.839 | 63.1 |
| **XGBoost** | **1.877** | **1.945** | **2.092** | **2.518** | **7.61** | **0.907** | **71.1** |

MLP and HF only trained/evaluated for 7d (HF architecture swappable to 14/30, MLP could be retrained per horizon but omitted since synthetic performance already below Ridge; not assumed to be competitive). For 14/30 they are shown as — to avoid claiming proxy as real.

## Selection (data-driven, not assumed)

- **7d**: `XGBoost` (val MAE 1.805, test MAE 1.877; 2nd Ridge 1.836/1.917)
- **14d**: `XGBoost` (val MAE 1.849, test MAE 1.945; 2nd Ridge 1.908/2.013)
- **30d**: `XGBoost` (val MAE 1.964, test MAE 2.092; 2nd Ridge 2.161/2.258)

**Overall fallback inference model**: `XGBoost` (per-horizon mapping in `models/final/best_model_by_horizon.json`). Procedure: rank by val MAE primary, RMSE/sMAPE/R2/DirAcc as tie-breakers; test only for reporting not selection. If synthetic were different or real data used, selection would objectively change (file would show different winner).

## XGBoost Details
- Params: `{"n_estimators": 800, "max_depth": 6, "learning_rate": 0.05, "subsample": 0.8, "colsample_bytree": 0.8, "colsample_bylevel": 0.8, "reg_alpha": 0.1, "reg_lambda": 1.0, "min_child_weight": 3, "gamma": 0.0, "objective": "reg:squarederror", "eval_metric": "rmse", "tree_method": "hist", "random_state": 42, "n_jobs": -1, "verbosity": 0}`
- Seed: 42 (numpy, torch, xgboost random_state)
- Early stopping: 50 rounds on val RMSE; best iterations 96 (7d), 116 (14d), 134 (30d) < 800 max
- Features: 41 numeric (lag_1/7/14/30, rolling_mean_7/14/30, rolling_std_7/30, pct_change_1, momentum_7/30, bdi/brent/iron/coal lags, bdi/brent roll means, volatility_30, seasonality sin/cos, monsoon/winter flags, cargo qty, distance, voyage duration, bdi/brent/iron/coal, demand/supply/congestion, calendar) + 6 categorical one-hot (origin, destination, trade_lane, vessel_type, cargo_type, season) fitted on train only. Total expanded dims ~90 after one-hot. Leakage-free (lags shifted by 1).
- Training data: chronological 70% train (2018-01-31 to 2023-07-27, 128,217 rows) | val 15% (2023-07-27 to 2024-09-28, 27,475) | test 15% untouched.
- Importance: see `models/xgboost/xgboost_*d/feature_importance.csv` — gain-based; top consistently rolling_mean_7/14/30, lag_1, vessel_type_Handysize/Capesize, seasonality (is_winter_peak, doy_cos, month_cos, season_Monsoon/Winter), destination_Gangavaram, trade_lane.
- Artifacts: `models/xgboost/xgboost_{7d,14d,30d}/{model.joblib, preprocessor.joblib, metadata.json, feature_importance.csv, xgboost_model.json}` mirrored to `models/final/xgboost_{7d,14d,30d}.joblib` + `models/final/xgboost_config.json` + `models/final/best_model_by_horizon.json`
- Inference: `from inference import predict_freight` selects per-horizon best; XGBoost if selected else fallback to Ridge. Backend can call predict_freight(origin, destination, vessel_class, horizon=7).

## Leakage & Reproducibility
Seed 42, chronological split, lags/rolling shifted by 1, targets shifted -h, categorical encoders fitted on train only, validation early stopping not test. See `docs/limitations.md` for full checks.
