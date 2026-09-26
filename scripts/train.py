"""
Master training script — runs all baselines + HF model + vessel/timing/risk.
Saves results to experiments/results/model_comparison.csv and experiments/metrics/results.json
"""
import sys
sys.path.insert(0, "src/data")
sys.path.insert(0, "src/models")
sys.path.insert(0, "src/evaluation")
import pandas as pd, numpy as np, json, time
from pathlib import Path
from baselines import naive_forecast, ma_forecast, train_sklearn_model, statistical_exp_smooth
from vessel_model import load_constraints, recommend_vessel_row
from timing_model import train_timing_classifier
from risk_model import train_risk_classifier
from huggingface_model import create_dataloaders, train_hf_model, save_hf_model
from metrics import regression_report, classification_report_dict
import torch
from feature_engineering import get_feature_columns

# Load processed splits
train = pd.read_parquet("data/processed/train.parquet")
val = pd.read_parquet("data/processed/val.parquet")
test = pd.read_parquet("data/processed/test.parquet")
# combine val+test for final? No, keep test untouched for final eval later
print(f"Train {len(train)} Val {len(val)} Test {len(test)}")

# Feature columns (exclude leakage)
feat_cols = get_feature_columns(train)
print(f"Features ({len(feat_cols)}): {feat_cols[:10]}")
target_7 = "target_freight_7d"
target_14 = "target_freight_14d"
target_30 = "target_freight_30d"

results = []
# Helper to compute metrics
def add_result(name, y_true, y_pred, y_prev):
    rep = regression_report(y_true, y_pred, y_prev)
    print(f"{name}: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']}")
    results.append({"model": name, **rep, "training_time_s": None})

# Baselines on VAL (horizon 7d)
y_prev_val = val["lag_1"].values
yt = val[target_7].values
yp_naive, _ = naive_forecast(val, target_7)
yp_ma, _   = ma_forecast(val, target_7)
# Handle NaNs in naive/ma (should be none after feature warmup)
mask = ~np.isnan(yp_naive) & ~np.isnan(yt)
add_result("Naive (lag_1)", yt[mask], yp_naive[mask], y_prev_val[mask])
mask2 = ~np.isnan(yp_ma) & ~np.isnan(yt)
add_result("MovingAvg (7d)", yt[mask2], yp_ma[mask2], y_prev_val[mask2])
pred_exp, _ = statistical_exp_smooth(train, val, target_7)
mask3 = ~np.isnan(pred_exp)
add_result("ExpSmooth", yt[mask3], pred_exp[mask3], y_prev_val[mask3])

# ML baselines
for mtype, name in [("ridge","Ridge"), ("rf","RandomForest"), ("gb","GradientBoosting")]:
    t0=time.time()
    model, pred_val, yv = train_sklearn_model(train, val, feat_cols, target_7, model_type=mtype)
    dt=time.time()-t0
    rep = regression_report(yv, pred_val, y_prev_val[:len(yv)])
    print(f"{name}: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']} time {dt:.1f}s")
    results.append({"model": name, **rep, "training_time_s": dt})
    # save baseline model
    import pickle
    Path("models/baselines").mkdir(parents=True, exist_ok=True)
    pickle.dump(model, open(f"models/baselines/{name.lower()}.pkl","wb"))

# HF model
print("\n=== HF PatchTST ===")
n_feat = len(feat_cols)
train_loader, val_loader, (t_mean, t_std) = create_dataloaders(train, val, feat_cols, target_7, context_len=30, batch_size=1024)
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device {device} t_mean {t_mean:.2f} t_std {t_std:.2f}")
model_hf = train_hf_model(train_loader, val_loader, n_features=n_feat, context_len=30, epochs=15, lr=1e-3, device=device)
save_hf_model(model_hf, "models/huggingface/patchtst_7d", t_mean, t_std, n_feat, 30)
# Evaluate HF on val
model_hf.eval()
hf_preds = []
hf_trues = []
with torch.no_grad():
    for xb, yb in val_loader:
        xb = xb.to(device)
        pred_n = model_hf(xb).cpu().numpy()
        hf_preds.extend(pred_n * t_std + t_mean)
        hf_trues.extend(yb.numpy() * t_std + t_mean)
hf_preds = np.array(hf_preds); hf_trues=np.array(hf_trues)
rep = regression_report(hf_trues, hf_preds, y_prev_val[:len(hf_trues)])
print(f"HF PatchTST: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']}")
results.append({"model": "HF_PatchTST", **rep, "training_time_s": None})

# Vessel recommendation (rule-based) on val sample
print("\n=== Vessel Recommendation ===")
ports, vessels = load_constraints()
# sample 2000 rows
sample_val = val.sample(n=min(2000, len(val)), random_state=42)
def apply_rec(df):
    recs=[]
    for _, r in df.iterrows():
        rec, feas, _ = recommend_vessel_row(r, r["freight_rate_usd_per_ton"], ports, vessels)
        recs.append(rec)
    return recs
sample_val = sample_val.copy()
sample_val["recommended"] = apply_rec(sample_val)
# accuracy vs true vessel_type (true is data vessel; recommendation may differ but feasible)
acc = (sample_val["recommended"]==sample_val["vessel_type"]).mean()
print(f"Vessel raw accuracy vs synthetic true vessel (lower is ok, feasibility matters): {acc:.3f}")
print(f"Feasible coverage: {(sample_val['recommended'].notna().mean()):.3f}")
results.append({"model": "Vessel_RuleBased", "MAE": None, "RMSE": None, "sMAPE": None, "R2": None, "DirectionalAccuracy": None, "accuracy": float(acc)})

# Timing & Risk classifiers
print("\n=== Timing (7d) ===")
clf_t, pred_t, y_t = train_timing_classifier(train, val, feat_cols, "timing_label_7d")
rep_t = classification_report_dict(y_t, pred_t)
print(rep_t)
results.append({"model": "Timing_RF_7d", "accuracy": rep_t["accuracy"], "f1_w": rep_t["f1_w"]})

print("\n=== Risk ===")
clf_r, pred_r, y_r = train_risk_classifier(train, val, feat_cols)
rep_r = classification_report_dict(y_r, pred_r)
print(rep_r)
results.append({"model": "Risk_RF", "accuracy": rep_r["accuracy"], "f1_w": rep_r["f1_w"]})

# Save comparison
Path("experiments/results").mkdir(parents=True, exist_ok=True)
import csv
df_res = pd.DataFrame(results)
df_res.to_csv("experiments/results/model_comparison.csv", index=False)
print("\nSaved to experiments/results/model_comparison.csv")
print(df_res.to_string())

# Save metrics JSON
Path("experiments/metrics").mkdir(parents=True, exist_ok=True)
with open("experiments/metrics/results.json","w") as f:
    # convert numpy to python
    def conv(o):
        if isinstance(o, (np.float32, np.float64, np.int64)): return float(o)
        return o
    j = [{k: conv(v) for k,v in r.items()} for r in results]
    json.dump(j, f, indent=2)
print("Saved experiments/metrics/results.json")
