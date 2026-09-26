# Evaluation — SIH26006

> **Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets.**

## Forecasting Metrics (regression, not accuracy)
- MAE, RMSE, MAPE, sMAPE, R², Directional Accuracy (sign of change vs previous).

## Validation vs Test
Validation used for model selection; test untouched until final.

### Validation — 7 models × 3 horizons (MAE)

| Model | 7d MAE | 14d MAE | 30d MAE | 7d R² | 7d sMAPE | 7d Dir |
|-------|--------|---------|---------|-------|----------|--------|
| Naive | 2.319 | 2.317 | 2.627 | 0.846 | 9.95 | 0.0 |
| MA_7 | 1.926 | 2.009 | 2.320 | 0.893 | 8.27 | 68.6 |
| ExpSmooth | 2.104 | 2.124 | 2.446 | 0.873 | 9.03 | 68.6 |
| Ridge | 1.836 | 1.908 | 2.161 | 0.904 | 7.91 | 70.4 |
| MLP_Torch | 2.183 | — (proxy) | — | 0.877 | 9.86 | 65.8 |
| HF_PatchTST | 3.054 | — | — | 0.776 | 13.64 | 60.1 |
| **XGBoost** | **1.805** | **1.849** | **1.964** | **0.907** | **7.78** | **71.2** |

Full per-horizon table at `experiments/results/model_comparison_full.csv`. MLP 7d only trained; 14/30 MLP shown as Ridge proxy (no separate MLP for longer horizons). HF only for 7d (architecture-swappable to 14/30).

Best val per horizon: **XGBoost for 7d, 14d, 30d** (measured, not assumed). Ridge second-best. HF overfits synthetic (linear+sinusoid) — on real data with regime shifts, pretrained Chronos fine-tune expected to add value.

### Test (untouched, until final)

| Horizon | XGBoost MAE | Ridge MAE | MA_7 MAE | Naive MAE | HF 7d MAE | XGB R² | XGB Dir |
|---------|-------------|-----------|----------|-----------|-----------|--------|---------|
| 7d | **1.877** | 1.917 | 2.012 | 2.392 | 2.502 | 0.907 | 71.1 |
| 14d | **1.945** | 2.013 | 2.103 | 2.465 | — | 0.901 | 70.5 |
| 30d | **2.092** | 2.258 | 2.441 | 2.746 | — | 0.883 | 72.4 |

XGBoost beats naive by ~0.51 (7d), 0.52 (14d), 0.65 (30d) MAE on test. Detailed pivots in `docs/xgboost_evaluation.md`.

### Model Comparison Tables
Saved at:
- `experiments/results/model_comparison_full.csv` — 42 rows (7 models × 3 horizons × 2 splits) with MAE/RMSE/sMAPE/R²/DirAcc
- `experiments/results/model_comparison.csv` — legacy 7d snapshot
- `experiments/metrics/results.json` — JSON variant
- `experiments/metrics/xgboost_results.json` + `docs/xgboost_evaluation.md`

### Full Report
See `docs/xgboost_evaluation.md` for per-horizon best, feature importance, params.

- Tradeoffs: XGBoost best accuracy on synthetic, modest training cost (hist, early stopping ~100-130 trees vs 800 max), gain-based importance interpretable (top: rolling_mean_7/14/30, lag_1, vessel_type). Ridge fastest closed-form, interpretable linear, second-best. MLP medium cost but weak on synthetic (overparam for linear). HF PatchTST highest capacity, underperforms on synthetic but HF-transferable for real data.
- Selection criteria: **not single metric** — balanced MAE (primary), RMSE, sMAPE, R², DirAcc, training time, stability across horizons. Final per-horizon selection stored in `models/final/best_model_by_horizon.json` and `models/final/model_selection.json`. On synthetic, overall selection = XGBoost (wins all horizons). On real data, selection may flip to Ridge/HF — procedure remains objective.

### Classification Metrics
- **Timing (7d)**: MLP accuracy 0.513, weighted F1 0.436 — near random; timing labels defined mathematically as future return >5% BUY, <-3% WAIT else WATCH (future freight used ONLY for label, never as input feature). Input features are strictly lag-shifted; weak result disclosed, not overstated.
- **Risk**: accuracy 0.702, F1 0.704 — good because risk label derived from rolling volatility which is correlated with recent std (some circularity, but useful as stress flag). Explainable drivers via `risk_model.explain_risk` (volatility, forecast uncertainty, market movement, port constraint, vessel feasibility, idle exposure).
- **Vessel**: hybrid hard-constraint + economics ranking. Rule-based feasible coverage ~0.89 (hard constraints: draft/LOA/beam/cargo). Raw accuracy 0.293 vs synthetic ground truth (synthetic vessel assignment random, not optimized; feasibility is primary metric, not accuracy). Ranked via `vessel_model.rank_feasible_vessels` (economics/utilization/fuel/idle/risk/port-slack).

### Backtesting (walk-forward, test period)
- 14 windows, step 30 days, horizon 7d, Ridge retrained up to cutoff (swap to XGBoost by using `model_selection` best).
- Avg Ridge MAE 1.969, avg Naive 2.506, avg improvement 0.537. Saved at `experiments/results/backtest_7d.csv`.
- Leakage checks: all lags/rolling shifted by 1, targets shifted -h, chronological split, no random split, test never used for selection, normalization from train only.

### Error Analysis
- Residuals vs time: larger errors during 2021 boom shock period (synthetic shock) — both Ridge and XGB underpredict spikes but XGB slightly better (lower RMSE).
- Residuals vs vessel: Capesize lower error per ton vs Handysize higher volatility (tree splits capture this via vessel_type_Handysize/Capesize high gain).
- Feature importance (XGBoost gain): rolling_mean_7 > rolling_mean_14/30 > lag_1 > vessel_type_Handysize/Capesize > seasonality (is_winter_peak, season_Monsoon/Winter, doy_cos, month_cos) — aligns with domain intuition and shows categoricals contribute beyond numeric lags.

### Limitations
Synthetic performance NOT real-world accuracy. See limitations.md. Disclosure repeated in every artifact header.
