"""
Dataset builder — chronological split + target horizons for SIH26006.
- Input: data/synthetic/freight_rates_synthetic.csv
- Output: data/processed/ml_dataset.parquet + train/val/test splits
- Also builds MODEL B/C/D targets (vessel feasibility, timing signal, risk)
"""
import pandas as pd
import numpy as np
from pathlib import Path
from feature_engineering import build_features, get_feature_columns, TARGET

def add_targets(df: pd.DataFrame, horizons=[7,14,30], group_cols=["trade_lane","vessel_type"]) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values(group_cols+["date"])
    for h in horizons:
        # future freight rate h days ahead
        df[f"target_freight_{h}d"] = df.groupby(group_cols)[TARGET].shift(-h)
        # future return direction
        df[f"target_return_{h}d"] = (df[f"target_freight_{h}d"] - df[TARGET]) / df[TARGET]
        # charter timing label for horizon 14d: BUY/WAIT/WATCH based on future return quantiles per group history
        # Define thresholds mathematically:
        #   BUY_NOW (WAIT inverse) if future return > +5%  -> prices rising, buy now before increase
        #   WAIT if future return < -3% -> prices falling, wait
        #   else WATCH
        # These thresholds are documented, not financial advice.
        def label_ret(r):
            if pd.isna(r):
                return np.nan
            if r > 0.05:
                return "BUY_NOW"
            elif r < -0.03:
                return "WAIT"
            else:
                return "WATCH"
        df[f"timing_label_{h}d"] = df[f"target_return_{h}d"].apply(label_ret)
        # risk label based on rolling volatility quantile (within group)
        # HIGH if rolling_std_30 > 75th percentile of group's history, etc. — computed during build
    # Risk labels using rolling_std_30 quantiles per group (loop to avoid groupby apply column dropping in pandas 3.x)
    df["risk_label"] = np.nan
    df["risk_label"] = df["risk_label"].astype(object)
    for _, g in df.groupby(group_cols):
        idx = g.index
        q33 = g["rolling_std_30"].quantile(0.33)
        q66 = g["rolling_std_30"].quantile(0.66)
        def lab(v):
            if pd.isna(v):
                return np.nan
            if v > q66:
                return "HIGH"
            elif v > q33:
                return "MEDIUM"
            else:
                return "LOW"
        df.loc[idx, "risk_label"] = g["rolling_std_30"].apply(lab).values
    return df

def chronological_split(df: pd.DataFrame, train_ratio=0.70, val_ratio=0.15):
    """Chronological split — no shuffle. Assumes df sorted by date."""
    df = df.sort_values("date")
    n = len(df)
    i_train = int(n*train_ratio)
    i_val = int(n*(train_ratio+val_ratio))
    # date thresholds
    train_end = df.iloc[i_train]["date"]
    val_end = df.iloc[i_val]["date"]
    print(f"Split thresholds: train_end={train_end} val_end={val_end} n={n}")
    train = df.iloc[:i_train].copy()
    val = df.iloc[i_train:i_val].copy()
    test = df.iloc[i_val:].copy()
    # ensure no overlap leakage: test start strictly after val
    assert train["date"].max() <= val["date"].min()
    assert val["date"].max() <= test["date"].min()
    return train, val, test

def save_splits(train, val, test, out_dir="data/processed"):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    train.to_parquet(out / "train.parquet", index=False)
    val.to_parquet(out / "val.parquet", index=False)
    test.to_parquet(out / "test.parquet", index=False)
    # combined
    pd.concat([train,val,test]).to_parquet(out / "ml_dataset.parquet", index=False)
    print(f"Saved to {out}: train {len(train)} val {len(val)} test {len(test)}")

def main(synth_path="data/synthetic/freight_rates_synthetic.csv", out_dir="data/processed"):
    df_raw = pd.read_csv(synth_path)
    print(f"Raw synthetic: {len(df_raw)} rows")
    df_feat = build_features(df_raw)
    df_targets = add_targets(df_feat)
    # drop rows where any target horizon NaN (last 30 days per series)
    # keep rows where 7d and 14d and 30d targets exist for evaluation completeness
    df_targets = df_targets.dropna(subset=["target_freight_7d","target_freight_30d"])
    print(f"After target horizon warmup drop: {len(df_targets)} rows")
    # chronological split on global timeline
    train, val, test = chronological_split(df_targets)
    # report periods
    for name, d in [("train", train), ("val", val), ("test", test)]:
        print(f"{name}: {d['date'].min()} to {d['date'].max()} ({len(d)} rows)")
    # feature columns
    feats = get_feature_columns(df_targets)
    print(f"Feature count: {len(feats)}")
    print(feats[:15])
    save_splits(train, val, test, out_dir)
    # sidecar JSON
    import json, datetime
    meta = {
        "seed": 42,
        "raw_rows": len(df_raw),
        "feature_rows": len(df_targets),
        "features": feats,
        "feature_count": len(feats),
        "targets": ["target_freight_7d","target_freight_14d","target_freight_30d", "timing_label_14d", "risk_label"],
        "split": {"train": len(train), "val": len(val), "test": len(test)},
        "periods": {
            "train": [str(train["date"].min()), str(train["date"].max())],
            "val": [str(val["date"].min()), str(val["date"].max())],
            "test": [str(test["date"].min()), str(test["date"].max())],
        },
        "generated_at": datetime.datetime.utcnow().isoformat()+"Z",
        "leakage_check": "lags/rolling shifted by 1; targets shifted -h; chronological split; test untouched",
    }
    Path(out_dir, "dataset_metadata.json").write_text(json.dumps(meta, indent=2))
    print("Metadata written")

if __name__ == "__main__":
    import sys
    synth = sys.argv[1] if len(sys.argv)>1 else "data/synthetic/freight_rates_synthetic.csv"
    out = sys.argv[2] if len(sys.argv)>2 else "data/processed"
    main(synth, out)
