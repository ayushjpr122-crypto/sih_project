# Model Architecture — SIH26006

> **Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets.**

## Task Decomposition
- **Model A (Freight forecasting)**: regression, horizons 7/14/30 days. Input: 41 numeric + 6 categorical (one-hot) features incl. lags/rolling/externals/seasonality/monsoon. Output: USD/ton. 7 models compared: Naive, MA_7, ExpSmooth, Ridge, MLP_Torch, HF_PatchTST, **XGBoost** (selected per horizon by val MAE).
- **Model B (Vessel recommendation)**: hybrid — hard constraints (draft/LOA/beam/cargo) first → rank feasible via economics (forecast freight * qty), utilization, voyage fuel proxy (route_distance * brent), idle/deadheading penalty, risk, port slack. No blind classification; physical feasibility first. See `vessel_model.rank_feasible_vessels`.
- **Model C (Charter timing)**: 3-class BUY_NOW/WAIT/WATCH defined by future return thresholds (ret>5% BUY, ret<-3% WAIT else WATCH). Labels use future freight only; inputs never contain future. Trained MLP (weak on synthetic, disclosed).
- **Model D (Risk)**: 3-class LOW/MEDIUM/HIGH by volatility quantile + explainable drivers (volatility, forecast uncertainty, market movement, port constraint, vessel feasibility, idle exposure) via `risk_model.explain_risk`.

## Hugging Face Model Selection
**Selected: PatchTST-style Transformer (HF-compatible)**

Why not LLM:
- Problem is numerical time-series, not language. LLM fine-tuning would be misapplied.

Why PatchTST:
- Patching converts long sequences into tokens, captures seasonality/trend better than vanilla Transformer.
- Proven SOTA on long-horizon forecasting (Nie et al. 2022).
- HF-compatible: can swap with `amazon/chronos-t5-small` (pretrained on 84B observations, HF `AutoModel`) or `huggingface/time-series-transformer`.

Input format:
- (B, context_len=30, n_features=41) → patched (patch_len 6, stride 3 → 8 patches) → TransformerEncoder (d_model 64, 4 heads, 2 layers) → mean pool → regression head.

Pretrained knowledge used:
- Chronos option: pretrained seasonal/trend priors from diverse TS corpora.
- Our lightweight version trains from scratch on synthetic (due to offline constraint) but architecture is HF-transferable; fine-tuning would reuse pretrained weights and update all layers with MSE loss.

Why fine-tuning appropriate:
- Domain shift: general TS corpora ≠ East Coast India bulk routes; fine-tuning adapts to route-specific seasonality (monsoon, winter peak, 3-year commodity cycle).

Alternatives considered:
- Temporal Fusion Transformer (TFT): heavier, needs more data.
- Time Series Transformer (Informer): similar but PatchTST more efficient.

## Baselines (must beat) + XGBoost
- Naive (lag_1), MA_7, ExpSmooth, Ridge (numpy closed-form, alpha 1.0), MLP_Torch ([128,64] ReLU), HF_PatchTST, **XGBoost** (hist, see below).
- XGBoost: `n_estimators=800, max_depth=6, lr=0.05, subsample=0.8, colsample_bytree=0.8, reg_alpha=0.1, reg_lambda=1.0, min_child_weight=3, tree_method=hist, seed 42`, early stopping 50 on val RMSE, 3 models for 7/14/30d. Feature importance via gain (top: rolling_mean_7/14/30, lag_1, vessel_type, seasonality). Saved to `models/xgboost/xgboost_*d/` + `models/final/xgboost_*d.joblib`. Single `predict_freight` selects per-horizon best by measured val MAE (file `models/final/best_model_by_horizon.json`). Not assumed winner.

## Training
- Ridge: closed-form, alpha 1.0, median imputed, standardized on train only.
- MLP: AdamW 1e-3, ReduceLROnPlateau patience 2, early stopping patience 4, 12 epochs, batch 4096.
- PatchTST: AdamW 1e-3, MSE on normalized target, early stopping patience 5, batch 1024, 8 epochs, context 30 patch 6 stride 3.
- XGBoost: as above, reproducible seed 42, validation set, early stopping, feature importance, persistence.

## Vessel Feasibility (Hybrid SIH26006 charter optimization)
```
# Hard constraints (filter):
feasible if:
  draft <= port_max_draft
  LOA   <= port_max_LOA
  beam  <= port_max_beam
  cargo_qty between 0.3*DWT_min and 0.98*DWT_max
if no feasible: NO_FEASIBLE (charter risk HIGH)

# Rank feasible by composite (lower better):
composite = 0.45*(total_cost/100k)          # forecast freight * qty * size_factor
          + 0.20*util_penalty              # <0.75 or >0.95 penalized (idle/overload)
          + 0.15*(fuel_proxy/100)          # route_distance * brent * dwt^0.45
          + 0.10*deadhead/1000             # 1-util if util<0.5
          + 0.06*risk_adj                  # HIGH risk -> prefer smaller flexible vessel
          + 0.04*port_slack_penalty        # tight draft slack penalized
size_factor: Capesize 0.85 < Panamax 1.05 < Supramax 1.25 < Handysize 1.6 (cheaper per ton for larger)
Explain per vessel: utilization, cost_per_ton_proxy, draft_slack, risk. See rank_feasible_vessels().
```
Sources: ports/east_coast_india_ports.csv, vessels/vessel_classes.csv (proxy representative, verify berth/tide).

## Fine-tuning Config
See models/huggingface/patchtst_7d/config.json: n_features 41, context_len 30, d_model 64, target_mean/std from train.
Checkpoints: pytorch_model.bin, early stopping on val MAE.
