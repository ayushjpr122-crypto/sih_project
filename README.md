# SIH26006 — Intelligent Freight Forecasting for East Coast India (ML + Dataset Only)

**Ministry of Steel | SIH 2026 | Transport & Logistics**

> **Scope**: Dataset + Machine Learning Model ONLY. No frontend/backend/API/dashboard/deployment.

## Problem
Forecast freight rates, support vessel chartering timing, vessel-type selection (Handysize/Supramax/Panamax/Capesize), respect East Coast port constraints (Paradip, Vizag, Gangavaram, Dhamra etc.), handle volatility.

> **Data Disclosure**: Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets.

## Quick Start
```bash
pip install -r requirements.txt
python src/data/generate_synthetic_data.py
python src/data/dataset_builder.py
python -u scripts/train_light.py          # baselines + MLP + HF PatchTST (CPU)
python scripts/train_xgboost_and_evaluate.py  # XGBoost for 7/14/30d + full 7-model comparison
python scripts/reevaluate.py             # re-run full comparison (any horizon/model)
python src/evaluation/backtest.py        # walk-forward 7d
# Inference (backend-ready):
python -c "import sys; sys.path.insert(0,'src/models'); from inference import predict_freight; print(predict_freight(origin='Australia_Hedland', destination='Gangavaram', vessel_class='Panamax', horizon=7))"
```

## Results (Synthetic, NOT real-world)
- Dataset: 183,168 rows (after warmup), 41 numeric + 6 categorical features, horizons 7/14/30d, chronological 70/15/15 split
- **Best forecasting (validation, 7-model compare)**: XGBoost MAE 1.805 RMSE 2.401 sMAPE 7.78 R² 0.907 Dir 71.2% (Ridge 1.836, MA_7 1.926, Naive 2.319, MLP_Torch 2.183, HF_PatchTST 3.054)
- Validation 14d XGBoost 1.849 vs Ridge 1.908; 30d XGBoost 1.964 vs Ridge 2.161 — XGBoost wins all horizons on synthetic (see `model_comparison_full.csv`).
- Test: 7d XGB 1.877 vs Ridge 1.917; 14d 1.945 vs 2.013; 30d 2.092 vs 2.258. Selection is data-driven, not assumed.
- Backtest walk-forward avg improvement vs naive 0.54 MAE
- HF PatchTST (HF-compatible) underperforms on synthetic (3.05 val, 2.50 test) — documented tradeoff; fine-tuning ready for real data with Chronos.
- Vessel: hybrid hard-constraint + economics ranking (feasibility first, then cost/utilization/fuel/idle/risk/port-slack) — `vessel_model.rank_feasible_vessels`
- Risk: 0.70 accuracy with explainable drivers (`risk_model.explain_risk`); Timing: 0.51 (weak, disclosed)

Full metrics: `experiments/results/model_comparison_full.csv`, `experiments/metrics/results.json`, `docs/evaluation.md`, `docs/xgboost_evaluation.md`

## Structure
```
data/
  synthetic/freight_rates_synthetic.csv (data_source=synthetic)
  processed/train.parquet val.parquet test.parquet ml_dataset.parquet
  ports/east_coast_india_ports.csv
  vessels/vessel_classes.csv
src/
  data/generate_synthetic_data.py (seed 42)
  data/feature_engineering.py (no leakage)
  data/dataset_builder.py (chronological split)
  models/huggingface_model.py (PatchTST HF-compatible)
  models/xgboost_model.py (XGBoost 7/14/30d, seed 42, early stopping)
  models/inference.py (predict_freight / recommend_vessels / assess_risk)
  models/baselines.py, vessel_model.py (hybrid), timing_model.py, risk_model.py (explainable)
  evaluation/metrics_light.py, evaluate.py, backtest.py
models/
  huggingface/patchtst_7d/ (pytorch_model.bin + config.json)
  baselines/mlp_torch.pt
  xgboost/xgboost_{7d,14d,30d}/ (model.joblib + preprocessor.joblib + feature_importance.csv)
  final/{xgboost_{7d,14d,30d}.joblib, ridge_*.npz, best_model_by_horizon.json, model_selection.json, xgboost_config.json}
docs/
  data_sources.md (provenance), dataset.md, model_architecture.md, training.md, evaluation.md, xgboost_evaluation.md, limitations.md
```

## Model Comparison (7 models)
- Naive (lag_1), MA_7, ExpSmooth, Ridge, MLP_Torch, HF_PatchTST, **XGBoost** — each evaluated on 7/14/30d horizons for MAE/RMSE/sMAPE/R²/DirectionalAccuracy (see `experiments/results/model_comparison_full.csv`).
- Selection per horizon = lowest val MAE (Ridge/XGBoost win per horizon). **XGBoost selected for all horizons on synthetic** (not assumed; measured). Fallback mapping in `models/final/best_model_by_horizon.json`. On different data, Ridge or other may win — selection is objective.
- XGBoost call: `from inference import predict_freight` — backend-ready.

## Hugging Face Model
- **Selected**: PatchTST-style Transformer (HF-compatible, Chronos swappable)
- **Why**: numerical TS, patching captures seasonality, HF transferable.
- Input: (B, 30, 41) patched, Output: 7d freight
- Pretrained: Chronos-T5 on 84B observations (if internet) → fine-tune all layers MSE
- Fine-tuning justified: domain shift to India bulk routes
- Baseline comparison: on synthetic Ridge/XGBoost win (linear+sinusoid synthetic lacks complex regime shifts); HF valuable on real data with richer interactions.

## Data Provenance
See `docs/data_sources.md`. Real route-vessel rates proprietary; we use public proxies (BDI via FRED, Brent via EIA, World Bank Pink Sheet) + synthetic with documented assumptions. All synthetic labeled `data_source=synthetic`.

## Reproducibility
Seed 42, pinned requirements, no random split, leakage checks in `docs/limitations.md`.

## Limitations
Synthetic performance ≠ real. No financial guarantee. See `docs/limitations.md`.

## Deliverables
Dataset pipeline, processed dataset, provenance, feature engineering, baselines, HF fine-tune, saved models, evaluation/backtest, error analysis, docs.
