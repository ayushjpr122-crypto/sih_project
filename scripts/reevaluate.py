import sys
sys.path.insert(0, "src/data"); sys.path.insert(0, "src/evaluation"); sys.path.insert(0, "src/models")
import pandas as pd, numpy as np, json, torch, torch.nn as nn
from pathlib import Path
from metrics_light import regression_report
from feature_engineering import get_feature_columns
from xgboost_model import load_model

train = pd.read_parquet("data/processed/train.parquet")
val = pd.read_parquet("data/processed/val.parquet")
test = pd.read_parquet("data/processed/test.parquet")
numeric_feats = [c for c in get_feature_columns(train) if pd.api.types.is_numeric_dtype(train[c]) and not c.startswith("target_") and c not in ["timing_label_7d","timing_label_14d","timing_label_30d","risk_label"]]
med = train[numeric_feats].median(numeric_only=True)
from numpy.linalg import solve

# cache ridge per horizon
ridge_cache={}
for h in [7,14,30]:
    bundle = np.load(f"models/final/ridge_target_freight_{h}d.npz", allow_pickle=True)
    ridge_cache[h] = bundle

def get_preds(df, horizon, target_col, kind):
    yt = df[target_col].values
    yprev = df["lag_1"].values
    if kind=="naive":
        return df["lag_1"].values, yt, yprev
    if kind=="ma":
        return df["rolling_mean_7"].values, yt, yprev
    if kind=="expsmooth":
        return 0.7*df["lag_1"].values + 0.3*df["rolling_mean_7"].values, yt, yprev
    if kind=="ridge":
        bundle = ridge_cache[horizon]
        w=bundle["w"]; mean=bundle["mean"]; std=bundle["std"]
        feat_cols = list(bundle["feat_cols"]) if "feat_cols" in bundle else numeric_feats
        med_json = json.load(open(f"models/final/ridge_median_{horizon}d.json"))
        Xdf = df[feat_cols].fillna(pd.Series(med_json))
        X = Xdf.values.astype(np.float64)
        Xs = (X - mean)/(std+1e-8)
        Xb = np.hstack([Xs, np.ones((Xs.shape[0],1))])
        yp = Xb @ w
        return yp, yt, yprev
    if kind=="mlp":
        if horizon !=7:
            return np.full_like(yt, np.nan, dtype=float), yt, yprev
        mean_m = np.load("models/baselines/mlp_mean.npy")
        std_m = np.load("models/baselines/mlp_std.npy")
        Xdf = df[numeric_feats].fillna(med).values.astype(np.float32)
        mean_m32 = mean_m.astype(np.float32); std_m32 = std_m.astype(np.float32)
        Xs = (Xdf - mean_m32)/(std_m32+1e-8)
        Xs = Xs.astype(np.float32)
        class MLP2(nn.Module):
            def __init__(self,d):
                super().__init__()
                self.net=nn.Sequential(nn.Linear(d,128), nn.ReLU(), nn.Dropout(0.1), nn.Linear(128,64), nn.ReLU(), nn.Linear(64,1))
            def forward(self,x): return self.net(x).squeeze(-1)
        model = MLP2(len(numeric_feats))
        state = torch.load("models/baselines/mlp_torch.pt", map_location="cpu")
        model.load_state_dict(state); model.eval()
        with torch.no_grad():
            yp = model(torch.from_numpy(Xs)).numpy()
        return yp, yt, yprev
    if kind=="hfpatch":
        if horizon!=7:
            return np.full_like(yt, np.nan, dtype=float), yt, yprev
        from huggingface_model import load_hf_model, create_dataloaders
        model, cfg = load_hf_model("models/huggingface/patchtst_7d", device="cpu")
        t_mean, t_std = cfg["target_mean"], cfg["target_std"]
        train_loader, eval_loader, _ = create_dataloaders(train, df, numeric_feats, target_col, context_len=30, batch_size=1024)
        model.eval()
        preds=[]; trues=[]
        with torch.no_grad():
            for xb,yb in eval_loader:
                pred_n = model(xb).cpu().numpy()
                preds.extend(pred_n*t_std+t_mean)
                trues.extend(yb.numpy()*t_std+t_mean)
        yp = np.array(preds); yt2=np.array(trues); yprev2=yprev[:len(yp)]
        return yp, yt2, yprev2
    if kind=="xgboost":
        model, pre, meta = load_model(horizon)
        mask = df[target_col].notna()
        df_valid = df.loc[mask]
        X = pre.transform(df_valid)
        yp_valid = model.predict(X)
        yt_v = df_valid[target_col].values; yprev_v = df_valid["lag_1"].values
        return yp_valid, yt_v, yprev_v

models=[("Naive","naive"),("MA_7","ma"),("ExpSmooth","expsmooth"),("Ridge","ridge"),("MLP_Torch","mlp"),("HF_PatchTST","hfpatch"),("XGBoost","xgboost")]
rows=[]
for split_name, df in [("val",val),("test",test)]:
    for h in [7,14,30]:
        target_col=f"target_freight_{h}d"
        for name,kind in models:
            yp, yt, yprev = get_preds(df, h, target_col, kind)
            mask = ~(np.isnan(yp)|np.isnan(yt)|np.isnan(yprev))
            if mask.sum()<10:
                rep={"MAE":np.nan,"RMSE":np.nan,"sMAPE":np.nan,"R2":np.nan,"DirectionalAccuracy":np.nan}
            else:
                rep = regression_report(yt[mask].tolist(), yp[mask].tolist(), yprev[mask].tolist())
            print(f"{split_name} {h}d {name:12s} MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']}")
            rows.append({"split":split_name,"horizon":h,"model":name, **rep, "n":int(mask.sum())})

import pandas as pd
df_comp=pd.DataFrame(rows)
df_comp.to_csv("experiments/results/model_comparison_full.csv",index=False)
print(df_comp.to_string())
# pivots
print(df_comp[df_comp["split"]=="val"].pivot(index="model",columns="horizon",values="MAE"))
print(df_comp[df_comp["split"]=="test"].pivot(index="model",columns="horizon",values="MAE"))
# selection
selection_by_horizon={}
for h in [7,14,30]:
    sub_val = df_comp[(df_comp["split"]=="val")&(df_comp["horizon"]==h)].sort_values(["MAE","RMSE"])
    best_val = sub_val.iloc[0]
    sub_test = df_comp[(df_comp["split"]=="test")&(df_comp["horizon"]==h)&(df_comp["model"]==best_val["model"])]
    test_mae=float(sub_test.iloc[0]["MAE"]) if not sub_test.empty else float("nan")
    selection_by_horizon[h]={"horizon":h,"best_model_val":best_val["model"],"val_MAE":float(best_val["MAE"]),"val_RMSE":float(best_val["RMSE"]),"val_sMAPE":float(best_val["sMAPE"]),"val_R2":float(best_val["R2"]),"val_DirAcc":float(best_val["DirectionalAccuracy"]), "test_MAE_of_best":test_mae, "all_val_ranking": sub_val[["model","MAE","RMSE","sMAPE","R2","DirectionalAccuracy"]].round(3).to_dict(orient="records")}
    print(h, best_val["model"], best_val["MAE"], test_mae)
from collections import Counter
best_list=[v["best_model_val"] for v in selection_by_horizon.values()]
overall=Counter(best_list).most_common(1)[0][0]
print("overall",overall)
import json, pathlib
with open("models/final/best_model_by_horizon.json","w") as f: json.dump({str(k):v["best_model_val"] for k,v in selection_by_horizon.items()},f,indent=2)
with open("models/final/model_selection.json","w") as f: json.dump({"selected_for_inference":overall,"per_horizon":{str(k):v for k,v in selection_by_horizon.items()},"criterion":"Best val MAE primary; test for reporting only","seed":42},f,indent=2)
with open("experiments/metrics/model_selection.json","w") as f: json.dump({"per_horizon":selection_by_horizon,"overall_best":overall},f,indent=2)
print("saved")
