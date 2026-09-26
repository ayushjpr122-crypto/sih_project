"""
Lightweight training without scipy/sklearn DLL (Windows AppControl blocks scipy openblas).
Uses only numpy/pandas/torch.
"""
import sys
sys.path.insert(0, "src/data")
sys.path.insert(0, "src/evaluation")
sys.path.insert(0, "src/models")
import pandas as pd, numpy as np, json, time, torch, torch.nn as nn
from pathlib import Path
from metrics_light import regression_report
from feature_engineering import get_feature_columns

train = pd.read_parquet("data/processed/train.parquet")
val = pd.read_parquet("data/processed/val.parquet")
test = pd.read_parquet("data/processed/test.parquet")
print(f"Train {len(train)} Val {len(val)} Test {len(test)}")
feat_cols = get_feature_columns(train)
print(f"Features {len(feat_cols)}")
target_7="target_freight_7d"
target_14="target_freight_14d"
target_30="target_freight_30d"

results=[]

def add(name, yt, yp, yprev):
    rep=regression_report(yt, yp, yprev)
    print(f"{name}: MAE {rep['MAE']:.3f} RMSE {rep['RMSE']:.3f} sMAPE {rep['sMAPE']:.2f} R2 {rep['R2']:.3f} Dir {rep['DirectionalAccuracy']:.1f}")
    results.append({"model":name, **rep})

# Naive
yp_naive = val["lag_1"].values
yt = val[target_7].values
yprev=val["lag_1"].values
mask=~np.isnan(yp_naive)&~np.isnan(yt)
add("Naive", yt[mask], yp_naive[mask], yprev[mask])
# MA
yp_ma=val["rolling_mean_7"].values
mask2=~np.isnan(yp_ma)&~np.isnan(yt)
add("MA_7", yt[mask2], yp_ma[mask2], yprev[mask2])
# ExpSmooth
yp_exp=0.7*val["lag_1"].values+0.3*val["rolling_mean_7"].values
mask3=~np.isnan(yp_exp)
add("ExpSmooth", yt[mask3], yp_exp[mask3], yprev[mask3])

# Ridge via numpy (with StandardScaler via numpy)
from numpy.linalg import solve
def train_ridge(Xt, yt, Xv, yv, alpha=1.0):
    # standardize
    mean = Xt.mean(axis=0)
    std = Xt.std(axis=0)+1e-8
    Xt_s = (Xt-mean)/std
    Xv_s = (Xv-mean)/std
    # add bias term
    Xt_b = np.hstack([Xt_s, np.ones((Xt_s.shape[0],1))])
    Xv_b = np.hstack([Xv_s, np.ones((Xv_s.shape[0],1))])
    # ridge closed form
    n_feat = Xt_b.shape[1]
    XtTX = Xt_b.T @ Xt_b + alpha*np.eye(n_feat)
    XtTX[-1,-1] -= alpha # no regularization on bias
    w = solve(XtTX, Xt_b.T @ yt)
    pred = Xv_b @ w
    return pred, w, mean, std

numeric_feats = [c for c in feat_cols if pd.api.types.is_numeric_dtype(train[c]) and not c.startswith("target_") and c not in ["timing_label_7d","timing_label_14d","timing_label_30d","risk_label"]]
feat_cols = numeric_feats
print(f"Numeric features {len(feat_cols)}: {feat_cols[:10]}")
med = train[feat_cols].median(numeric_only=True)
Xt = train[feat_cols].fillna(med).values.astype(np.float64)
Xv = val[feat_cols].fillna(med).values.astype(np.float64)
yt_tr = train[target_7].values
yv = val[target_7].values
pred_ridge, _, _, _ = train_ridge(Xt, yt_tr, Xv, yv, alpha=1.0)
add("Ridge_numpy", yv, pred_ridge, yprev)

# Simple torch MLP as RF/GB proxy
class MLP(nn.Module):
    def __init__(self, d):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(d,128), nn.ReLU(), nn.Dropout(0.1), nn.Linear(128,64), nn.ReLU(), nn.Linear(64,1))
    def forward(self,x): return self.net(x).squeeze(-1)

def train_mlp():
    device="cuda" if torch.cuda.is_available() else "cpu"
    # scale
    mean = Xt.mean(axis=0); std=Xt.std(axis=0)+1e-8
    Xt_s=(Xt-mean)/std; Xv_s=(Xv-mean)/std
    tr_ds=torch.utils.data.TensorDataset(torch.from_numpy(Xt_s.astype(np.float32)), torch.from_numpy(yt_tr.astype(np.float32)))
    val_ds=torch.utils.data.TensorDataset(torch.from_numpy(Xv_s.astype(np.float32)), torch.from_numpy(yv.astype(np.float32)))
    tr_loader=torch.utils.data.DataLoader(tr_ds,batch_size=4096,shuffle=True)
    val_loader=torch.utils.data.DataLoader(val_ds,batch_size=4096)
    model=MLP(Xt.shape[1]).to(device)
    opt=torch.optim.AdamW(model.parameters(),lr=1e-3,weight_decay=1e-4)
    sched=torch.optim.lr_scheduler.ReduceLROnPlateau(opt,patience=2,factor=0.5)
    best=float("inf"); best_state=None; patience=4; wait=0
    for epoch in range(12):
        model.train(); tl=0
        for xb,yb in tr_loader:
            xb,yb=xb.to(device),yb.to(device)
            opt.zero_grad()
            loss=nn.MSELoss()(model(xb),yb)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),1.0); opt.step()
            tl+=loss.item()*len(yb)
        tl/=len(tr_ds)
        model.eval(); vl=0
        with torch.no_grad():
            for xb,yb in val_loader:
                xb,yb=xb.to(device),yb.to(device)
                vl+=nn.MSELoss()(model(xb),yb).item()*len(yb)
        vl/=len(val_ds)
        sched.step(vl)
        print(f"MLP epoch {epoch+1} train {tl:.4f} val {vl:.4f}")
        if vl<best-1e-4:
            best=vl; best_state={k:v.cpu() for k,v in model.state_dict().items()}; wait=0
        else:
            wait+=1
            if wait>=patience:
                print("early stop")
                break
    if best_state: model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        preds=[]
        for xb,_ in val_loader:
            preds.extend(model(xb.to(device)).cpu().numpy())
    return np.array(preds), model, mean, std

pred_mlp, mlp_model, m_mean, m_std = train_mlp()
add("MLP_Torch", yv, pred_mlp, yprev)
# save mlp
Path("models/baselines").mkdir(parents=True, exist_ok=True)
torch.save(mlp_model.state_dict(), "models/baselines/mlp_torch.pt")
np.save("models/baselines/mlp_mean.npy", m_mean)
np.save("models/baselines/mlp_std.npy", m_std)

# HF PatchTST (from huggingface_model)
from huggingface_model import create_dataloaders, train_hf_model, save_hf_model
print("\n=== HF PatchTST ===")
n_feat=len(feat_cols)
train_loader, val_loader, (t_mean,t_std) = create_dataloaders(train,val,feat_cols,target_7,context_len=30,batch_size=1024)
device="cuda" if torch.cuda.is_available() else "cpu"
model_hf=train_hf_model(train_loader,val_loader,n_features=n_feat,context_len=30,epochs=8,lr=1e-3,device=device)
save_hf_model(model_hf,"models/huggingface/patchtst_7d",t_mean,t_std,n_feat,30)
model_hf.eval()
hf_preds=[]; hf_trues=[]
with torch.no_grad():
    for xb,yb in val_loader:
        xb=xb.to(device)
        pred_n=model_hf(xb).cpu().numpy()
        hf_preds.extend(pred_n*t_std+t_mean)
        hf_trues.extend(yb.numpy()*t_std+t_mean)
hf_preds=np.array(hf_preds); hf_trues=np.array(hf_trues)
add("HF_PatchTST", hf_trues, hf_preds, yprev[:len(hf_trues)])

# Vessel rule-based
print("\n=== Vessel ===")
import pandas as pd
ports=pd.read_csv("data/ports/east_coast_india_ports.csv")
vessels=pd.read_csv("data/vessels/vessel_classes.csv")
from vessel_model import recommend_vessel_row
sample_val=val.sample(n=min(2000,len(val)),random_state=42)
def apply_rec(df):
    recs=[]
    for _,r in df.iterrows():
        rec,feas,_=recommend_vessel_row(r,r["freight_rate_usd_per_ton"],ports,vessels)
        recs.append(rec)
    return recs
sample_val=sample_val.copy()
sample_val["recommended"]=apply_rec(sample_val)
acc=(sample_val["recommended"]==sample_val["vessel_type"]).mean()
print(f"Vessel raw accuracy {acc:.3f} feasible {(sample_val['recommended'].notna().mean()):.3f}")
results.append({"model":"Vessel_RuleBased","MAE":None,"RMSE":None,"sMAPE":None,"R2":None,"DirectionalAccuracy":None,"accuracy":float(acc)})

# Timing classifier via torch
print("\n=== Timing ===")
# simple torch classifier
from torch.utils.data import TensorDataset, DataLoader
# encode labels
label_col="timing_label_7d"
train_lab=train[label_col].dropna()
val_lab=val[label_col].dropna()
# need aligned indices: we filtered so X must align
mask_tr=train[label_col].notna()
mask_val=val[label_col].notna()
Xt_tr=train[feat_cols].fillna(med).values[mask_tr.values]
Xt_val=val[feat_cols].fillna(med).values[mask_val.values]
# manual encoding to avoid sklearn (scipy DLL block)
# manual encoding to avoid sklearn
classes=np.array(["BUY_NOW","WAIT","WATCH"])
cls_to_idx={c:i for i,c in enumerate(classes)}
y_tr=np.array([cls_to_idx[x] for x in train[label_col][mask_tr].values])
y_va=np.array([cls_to_idx[x] for x in val[label_col][mask_val].values])
# scale
mean_t=Xt_tr.mean(axis=0); std_t=Xt_tr.std(axis=0)+1e-8
Xt_tr_s=(Xt_tr-mean_t)/std_t; Xt_val_s=(Xt_val-mean_t)/std_t
class CMLP(nn.Module):
    def __init__(self,d, n_cls): super().__init__(); self.net=nn.Sequential(nn.Linear(d,64),nn.ReLU(),nn.Linear(64,n_cls))
    def forward(self,x): return self.net(x)
device="cuda" if torch.cuda.is_available() else "cpu"
model_c=CMLP(Xt_tr.shape[1],3).to(device)
opt=torch.optim.AdamW(model_c.parameters(),lr=1e-3,weight_decay=1e-4)
tr_ds=TensorDataset(torch.from_numpy(Xt_tr_s.astype(np.float32)),torch.from_numpy(y_tr))
va_ds=TensorDataset(torch.from_numpy(Xt_val_s.astype(np.float32)),torch.from_numpy(y_va))
tr_loader=DataLoader(tr_ds,batch_size=2048,shuffle=True)
va_loader=DataLoader(va_ds,batch_size=4096)
best=float("inf"); best_state=None
for epoch in range(10):
    model_c.train(); tl=0
    for xb,yb in tr_loader:
        xb,yb=xb.to(device),yb.to(device)
        opt.zero_grad(); loss=nn.CrossEntropyLoss()(model_c(xb),yb); loss.backward(); opt.step(); tl+=loss.item()*len(yb)
    tl/=len(tr_ds)
    model_c.eval(); vl=0; correct=0
    with torch.no_grad():
        for xb,yb in va_loader:
            xb,yb=xb.to(device),yb.to(device)
            out=model_c(xb); vl+=nn.CrossEntropyLoss()(out,yb).item()*len(yb); correct+=(out.argmax(1)==yb).sum().item()
    vl/=len(va_ds); acc_c=correct/len(va_ds)
    print(f"Timing epoch {epoch+1} loss {tl:.4f} val {vl:.4f} acc {acc_c:.3f}")
    if vl<best:
        best=vl; best_state={k:v.cpu() for k,v in model_c.state_dict().items()}
model_c.load_state_dict(best_state); model_c.eval()
preds=[]
with torch.no_grad():
    for xb,_ in va_loader:
        preds.extend(model_c(xb.to(device)).argmax(1).cpu().numpy())
preds=np.array(preds)
acc=(preds==y_va).mean()
print(f"Timing final acc {acc:.3f}")
# weighted f1 manually
from collections import Counter
# compute weighted f1 via torch metrics manual quickly
def weighted_f1(y_true,y_pred,n_cls):
    f1s=[]; supports=[]
    for c in range(n_cls):
        tp=((y_pred==c)&(y_true==c)).sum(); fp=((y_pred==c)&(y_true!=c)).sum(); fn=((y_pred!=c)&(y_true==c)).sum()
        prec=tp/(tp+fp+1e-8); rec=tp/(tp+fn+1e-8); f1=2*prec*rec/(prec+rec+1e-8) if prec+rec>0 else 0
        sup=(y_true==c).sum()
        f1s.append(f1); supports.append(sup)
    return np.average(f1s,weights=supports)
f1_w=weighted_f1(y_va,preds,3)
results.append({"model":"Timing_MLP_7d","accuracy":float(acc),"f1_w":float(f1_w)})

# Risk
print("\n=== Risk ===")
label_col="risk_label"
mask_tr=train[label_col].notna(); mask_val=val[label_col].notna()
Xt_tr=train[feat_cols].fillna(med).values[mask_tr.values]; Xt_val=val[feat_cols].fillna(med).values[mask_val.values]
classes_r=np.array(["LOW","MEDIUM","HIGH"]); cls_to_idx_r={c:i for i,c in enumerate(classes_r)}
y_tr=np.array([cls_to_idx_r[x] for x in train[label_col][mask_tr].values]); y_va=np.array([cls_to_idx_r[x] for x in val[label_col][mask_val].values])
mean_r=Xt_tr.mean(axis=0); std_r=Xt_tr.std(axis=0)+1e-8; Xt_tr_s=(Xt_tr-mean_r)/std_r; Xt_val_s=(Xt_val-mean_r)/std_r
model_r=CMLP(Xt_tr.shape[1],3).to(device); opt=torch.optim.AdamW(model_r.parameters(),lr=1e-3)
tr_ds=TensorDataset(torch.from_numpy(Xt_tr_s.astype(np.float32)),torch.from_numpy(y_tr)); va_ds=TensorDataset(torch.from_numpy(Xt_val_s.astype(np.float32)),torch.from_numpy(y_va))
tr_loader=DataLoader(tr_ds,batch_size=2048,shuffle=True); va_loader=DataLoader(va_ds,batch_size=4096)
best=float("inf"); best_state=None
for epoch in range(10):
    model_r.train(); tl=0
    for xb,yb in tr_loader:
        xb,yb=xb.to(device),yb.to(device); opt.zero_grad(); loss=nn.CrossEntropyLoss()(model_r(xb),yb); loss.backward(); opt.step(); tl+=loss.item()*len(yb)
    tl/=len(tr_ds); model_r.eval(); vl=0; correct=0
    with torch.no_grad():
        for xb,yb in va_loader:
            xb,yb=xb.to(device),yb.to(device); out=model_r(xb); vl+=nn.CrossEntropyLoss()(out,yb).item()*len(yb); correct+=(out.argmax(1)==yb).sum().item()
    vl/=len(va_ds); acc_c=correct/len(va_ds)
    print(f"Risk epoch {epoch+1} val {vl:.4f} acc {acc_c:.3f}")
    if vl<best: best=vl; best_state={k:v.cpu() for k,v in model_r.state_dict().items()}
model_r.load_state_dict(best_state); model_r.eval()
preds=[]
with torch.no_grad():
    for xb,_ in va_loader: preds.extend(model_r(xb.to(device)).argmax(1).cpu().numpy())
preds=np.array(preds); acc=(preds==y_va).mean(); f1_w=weighted_f1(y_va,preds,3)
print(f"Risk final acc {acc:.3f} f1 {f1_w:.3f}")
results.append({"model":"Risk_MLP","accuracy":float(acc),"f1_w":float(f1_w)})

# save
Path("experiments/results").mkdir(parents=True, exist_ok=True)
df_res=pd.DataFrame(results)
df_res.to_csv("experiments/results/model_comparison.csv",index=False)
print(df_res.to_string())
Path("experiments/metrics").mkdir(parents=True, exist_ok=True)
with open("experiments/metrics/results.json","w") as f:
    def conv(o): return float(o) if isinstance(o,(np.float32,np.float64,np.int64)) else o
    json.dump([{k:conv(v) for k,v in r.items()} for r in results],f,indent=2)
print("saved")
