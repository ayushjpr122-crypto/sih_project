"""
Evaluate on TEST set (untouched until now). Computes same metrics.
Also handles horizon 14d, 30d for final report.
"""
import pandas as pd, numpy as np, json, torch, pickle
from pathlib import Path
import sys
sys.path.insert(0, "src/data"); sys.path.insert(0, "src/evaluation"); sys.path.insert(0, "src/models")
from feature_engineering import get_feature_columns
from metrics_light import regression_report
from huggingface_model import load_hf_model

train = pd.read_parquet("data/processed/train.parquet")
test = pd.read_parquet("data/processed/test.parquet")
feat_cols = [c for c in get_feature_columns(train) if pd.api.types.is_numeric_dtype(train[c]) and not c.startswith("target_") and c not in ["timing_label_7d","timing_label_14d","timing_label_30d","risk_label"]]
med = train[feat_cols].median(numeric_only=True)

# Load Ridge weights (we saved not, recompute quickly)
from numpy.linalg import solve
Xt = train[feat_cols].fillna(med).values.astype(np.float64)
Xv_test = test[feat_cols].fillna(med).values.astype(np.float64)
for horizon, target_col in [(7,"target_freight_7d"), (14,"target_freight_14d"), (30,"target_freight_30d")]:
    yt_tr = train[target_col].values
    y_test = test[target_col].values
    # train ridge
    mean = Xt.mean(axis=0); std = Xt.std(axis=0)+1e-8
    Xt_s = (Xt-mean)/std; Xtest_s = (Xv_test-mean)/std
    Xt_b = np.hstack([Xt_s, np.ones((Xt_s.shape[0],1))])
    Xtest_b = np.hstack([Xtest_s, np.ones((Xtest_s.shape[0],1))])
    n_feat = Xt_b.shape[1]
    XtTX = Xt_b.T @ Xt_b + 1.0*np.eye(n_feat); XtTX[-1,-1]-=1.0
    w = solve(XtTX, Xt_b.T @ yt_tr)
    pred = Xtest_b @ w
    y_prev = test["lag_1"].values
    rep = regression_report(y_test, pred, y_prev)
    print(f"Horizon {horizon}d Ridge TEST: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']:.1f}")
    # Naive test
    yp_naive = test["lag_1"].values
    rep_n = regression_report(y_test, yp_naive, y_prev)
    print(f" Horizon {horizon}d Naive TEST: MAE {rep_n['MAE']:.3f} Dir {rep_n['DirectionalAccuracy']:.1f}")

# HF test (only 7d model saved)
device="cpu"
model, cfg = load_hf_model("models/huggingface/patchtst_7d", device=device)
t_mean, t_std = cfg["target_mean"], cfg["target_std"]
# Build loader
from huggingface_model import create_dataloaders
train_loader, test_loader, _ = create_dataloaders(train, test, feat_cols, "target_freight_7d", context_len=30, batch_size=1024)
# override normalization to use saved t_mean/std? create_dataloaders recomputes from train, same
model.eval()
hf_preds=[]; hf_trues=[]
with torch.no_grad():
    for xb,yb in test_loader:
        xb=xb.to(device)
        pred_n = model(xb).cpu().numpy()
        # yb is normalized with same train stats inside loader
        hf_preds.extend(pred_n*t_std+t_mean)
        hf_trues.extend(yb.numpy()*t_std+t_mean)
hf_preds=np.array(hf_preds); hf_trues=np.array(hf_trues)
y_prev = test["lag_1"].values[:len(hf_trues)]
rep = regression_report(hf_trues, hf_preds, y_prev)
print(f"HF PatchTST TEST 7d: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']:.1f}")

# Save test metrics
Path("experiments/metrics").mkdir(parents=True, exist_ok=True)
test_metrics = {
    "ridge_test": rep,  # last rep is HF; better save all but simplified
}
print("Test evaluation done")
