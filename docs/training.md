# Training — SIH26006

## Reproducibility
- Seed 42, deterministic numpy/torch.
- Dependencies pinned in requirements.txt.
- Configs in experiments/configs (if added).

## Commands
```bash
python src/data/generate_synthetic_data.py --start 2018-01-01 --end 2025-12-31
python src/data/dataset_builder.py
python -u scripts/train_light.py                        # baselines + MLP + HF PatchTST (CPU)
python scripts/train_xgboost_and_evaluate.py            # XGBoost 7/14/30d + full 7-model x 3-horizon comparison (writes model_comparison_full.csv)
python scripts/reevaluate.py                            # same as above but skip training (fast re-table)
python src/evaluation/backtest.py                       # walk-forward Ridge (or swap to XGB by editing)
# Inference
python -c "import sys; sys.path.insert(0,'src/models'); from inference import predict_freight; print(predict_freight('Australia_Hedland','Gangavaram','Panamax',7))"
```

## Hyperparameters
- Ridge alpha 1.0 (closed-form, standardized on train)
- MLP: 128→64, dropout 0.1, AdamW 1e-3, ReduceLROnPlateau patience 2, early stopping 4, 12 epochs, batch 4096
- PatchTST: d_model 64, n_heads 4, n_layers 2, patch_len 6 stride 3, context 30, AdamW 1e-3, early stopping patience 5, 8 epochs, batch 1024
- XGBoost: n_estimators 800, max_depth 6, lr 0.05, subsample 0.8, colsample_bytree 0.8, reg_alpha 0.1, reg_lambda 1.0, min_child_weight 3, tree_method hist, seed 42, early_stopping_rounds 50, eval_metric rmse — 3 models (7/14/30d) with one-hot categoricals

## Checkpointing & Saving
- Baselines: models/baselines/mlp_torch.pt + mean/std npy
- HF: models/huggingface/patchtst_7d/pytorch_model.bin + config.json (target_mean/std)
- XGBoost: models/xgboost/xgboost_{7,14,30}d/{model.joblib, preprocessor.joblib, metadata.json, feature_importance.csv, xgboost_model.json} + mirror `models/final/xgboost_{7,14,30}d.joblib` + `models/final/xgboost_config.json`
- Ridge: models/final/ridge_target_freight_{7,14,30}d.npz + ridge_median_{7,14,30}d.json
- Selection: models/final/best_model_by_horizon.json + model_selection.json (per-horizon best by val MAE, not assumed)
- Full table: experiments/results/model_comparison_full.csv + experiments/metrics/xgboost_results.json

## Early Stopping
Monitor val loss/MAE (XGBoost RMSE) ; patience as above. XGBoost early stopping 50 rounds on val.

## Inference
```python
# src/models/inference.py — backend can import directly
from inference import predict_freight, recommend_vessels, assess_risk
forecast = predict_freight(origin="Australia_Hedland", destination="Gangavaram",
                           vessel_class="Panamax", horizon=7)  # uses best per-horizon model
ranked = recommend_vessels(origin="Australia_Hedland", destination="Gangavaram",
                          cargo_quantity_t=65000, horizon=7)
risk = assess_risk(origin="Australia_Hedland", destination="Gangavaram", vessel_class="Panamax")
```

## Hardware
CPU-only (torch 2.14 CPU). Training time ~ 8-12 min total. HF needs ~5 min.

## Fine-tuning Narrative
- If Chronos available: `AutoModel.from_pretrained("amazon/chronos-t5-small")`, freeze encoder? No, fine-tune all with lower lr 5e-5, 3 epochs, same data.
- Our patchTST trained from scratch due to offline; architecture is HF-compatible for swap.
