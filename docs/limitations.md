# Limitations & Leakage Checks — SIH26006

> **Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets. No synthetic metric is claimed as real-world accuracy.**

## Data Leakage Checks Performed
1. **Lag/rolling shifted by 1**: All lag and rolling features computed via `shift(1)` before rolling, so only past values (feature_engineering.py L38-60).
2. **Target shifted -h**: `target_freight_hd = freight.shift(-h)` — future value used ONLY as label, never as input (dataset_builder.py L17-19).
3. **Chronological split**: 70/15/15 by time, not random. Test max train date <= min val date (dataset_builder.py L71-72).
4. **Feature engineering identical for train/val/test/inference**: same pipeline class (`build_features`), no fit on test; categorical OneHot fitted on train only (xgboost_model.py).
5. **Normalization**: mean/std from train only, applied to val/test (xgboost_model + ridge npz); no test stats leak.
6. **No future externals**: bdi/brent lags also shifted by 7 and rolling shifted by 1 (feature_engineering L67-76).
7. **Timing labels use future return only for label**: `timing_label_h = f((target-freight)/freight)` (dataset_builder L26-36); inputs exclude target_* columns entirely.
8. **Test untouched**: not used for hyperparameter selection; early stopping monitors val only; final test evaluation separate via `reevaluate.py`.

## What Could Still Leak (future work)
- Global median imputation uses train median only — safe, but if new route appears, median may be stale.
- Port/vessel static tables are proxies, not verified berth-level; feasibility is conservative.

## Data Limitations
- **Synthetic**: 187k rows, 2018-2025 daily, 4 origins × 4 destinations × 4 vessels = 64 series. Clearly labeled synthetic. NOT real freight; performance not transferable.
- **No real freight**: route-vessel spot rates proprietary (Baltic Exchange/Clarksons/Platts subscriptions). Free public proxy only BDI composite.
- **Port constraints**: representative max values (e.g., Paradip 14.5m) — actual draft varies by berth/tide/lock; we use proxy_representative.
- **Vessel specs**: class ranges, not single vessel; DWT/draft/LOA/beam are medians.

## Model Limitations
- **Synthetic nature**: XGBoost wins on synthetic (1.80 val MAE) because synthetic is dominated by rolling means + vessel/season splits that trees exploit well; on real data with nonlinear regime shifts, sanctions, weather, congestion shocks, gap may narrow and HF fine-tune may overtake — hence per-horizon selection stored in `best_model_by_horizon.json` is data-driven, not hardcoded to XGBoost.
- **Ridge vs tree tradeoff**: Ridge best among linear models on synthetic but underperforms XGBoost by ~0.03-0.20 MAE across horizons (small but consistent). Real market may favor tree ensembles for threshold effects.
- **HF PatchTST underperforms here**: overparameterized for synthetic; would benefit from real data + pretrained Chronos weights. Fine-tuning config documented for swap.
- **MLP weak on synthetic**: 7d MAE 2.18 vs Ridge 1.84; not trained for 14/30d (reported as proxy). Architecture kept for completeness.
- **Timing classifier weak**: threshold labels produce balanced but noisy target; accuracy 0.51 suggests no edge on synthetic — do not use for financial decisions. Defined mathematically (ret>5% BUY, ret<-3% WAIT), not guarantee; future never in inputs.
- **Risk classifier moderate circularity**: risk label derived from rolling_std which is also a feature — some leakage via feature-target correlation; mitigated by explainable driver output via `explain_risk` rather than claiming independent prediction.
- **Vessel recommendation**: hybrid not pure ML classifier because synthetic labels random; feasibility is primary metric. No charter history to learn ML ranking — economics scoring is proxy, requires voyage cost dataset for production tuning.

## Operational Limitations
- No live ingestion (FRED/WB/Baltic) wired — stub in src/data/ingestion.py for future.
- No probabilistic forecasting (prediction intervals) yet — could add via quantile regression.
- No deadheading/idle analysis beyond voyage_duration proxy — would need AIS/position data.

## Reproducibility
- Seed 42 fixed everywhere (python, numpy, torch, xgboost), configs in experiments/configs, requirements pinned, dataset_metadata.json.
- To reproduce: `python src/data/generate_synthetic_data.py && python src/data/dataset_builder.py && python scripts/train_light.py && python scripts/train_xgboost_and_evaluate.py && python scripts/reevaluate.py`
- Artifacts versioned by content hash, not by trust claim; every metric paired with split horizon and n.
