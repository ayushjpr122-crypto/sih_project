"""
XGBoost tabular model for SIH26006 freight forecasting — leakage-free, reproducible.
- Horizons: 7, 14, 30 days (separate regressors)
- Features: existing engineered numeric + optional categorical (route/origin/destination/vessel_class)
- Strict time-series: chronological split, lags/rolling already shifted by 1 in feature_engineering.py
- Early stopping on validation set
- Feature importance + persistence + inference
Seed 42 fixed everywhere.
"""
import json
import joblib
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import numpy as np
import pandas as pd

try:
    import xgboost as xgb
except ImportError as e:
    raise ImportError("xgboost not installed. Run pip install xgboost==2.1.4") from e

from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer

# Reproducibility
RANDOM_SEED = 42

# Sensible hyperparameters — computationally reasonable, no heavy tuning
XGB_PARAMS = dict(
    n_estimators=800,
    max_depth=6,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    colsample_bylevel=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    min_child_weight=3,
    gamma=0.0,
    objective="reg:squarederror",
    eval_metric="rmse",
    tree_method="hist",
    random_state=RANDOM_SEED,
    n_jobs=-1,
    verbosity=0,
)

CATEGORICAL_COLS = ["origin", "destination", "trade_lane", "vessel_type", "cargo_type"]
# season derived from month, but kept if available
OPTIONAL_CAT = ["season"]

# Feature engineering already ensures these are leakage-free
def get_numeric_feature_cols(df: pd.DataFrame) -> List[str]:
    """Same logic as train_light / evaluate: numeric only, exclude targets/labels."""
    from feature_engineering import get_feature_columns
    base = get_feature_columns(df)
    numeric = [c for c in base if pd.api.types.is_numeric_dtype(df[c])
               and not c.startswith("target_")
               and c not in ["timing_label_7d","timing_label_14d","timing_label_30d","risk_label"]]
    return numeric

def build_preprocessor(numeric_cols: List[str], categorical_cols: List[str]):
    """ColumnTransformer fitted only on train. Median imputation + one-hot."""
    # Check which cat cols exist
    # Pipeline for numeric: median impute
    # Categorical: one-hot with handle_unknown=ignore
    transformers = []
    transformers.append(("num", SimpleImputer(strategy="median"), numeric_cols))
    if categorical_cols:
        # sklearn 1.2+ uses sparse_output not sparse
        try:
            cat_enc = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        except TypeError:
            cat_enc = OneHotEncoder(handle_unknown="ignore", sparse=False)
        transformers.append(("cat", cat_enc, categorical_cols))
    pre = ColumnTransformer(transformers, remainder="drop", verbose_feature_names_out=False)
    return pre

def get_feature_lists(df: pd.DataFrame) -> Tuple[List[str], List[str]]:
    """Return numeric and categorical feature lists that exist in df and are valid at prediction time."""
    numeric = get_numeric_feature_cols(df)
    cats = [c for c in CATEGORICAL_COLS if c in df.columns]
    # add season if present and meaningful
    for c in OPTIONAL_CAT:
        if c in df.columns and c not in cats:
            cats.append(c)
    return numeric, cats

def prepare_X(df: pd.DataFrame, numeric_cols: List[str], categorical_cols: List[str], preprocessor: Optional[ColumnTransformer]=None, fit: bool=False):
    """Prepare feature matrix. If fit=True, fit preprocessor on df."""
    if preprocessor is None:
        preprocessor = build_preprocessor(numeric_cols, categorical_cols)
    if fit:
        X = preprocessor.fit_transform(df)
    else:
        X = preprocessor.transform(df)
    # Also capture feature names after transform if possible
    return X, preprocessor

def train_single_horizon(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    numeric_cols: List[str],
    categorical_cols: List[str],
    target_col: str,
    params: Optional[Dict]=None,
    early_stopping_rounds: int=50,
    verbose: bool=False,
) -> Tuple[xgb.XGBRegressor, ColumnTransformer, Dict]:
    """Train one XGB regressor for a horizon with early stopping on val."""
    if params is None:
        params = XGB_PARAMS
    # Build preprocessor fitted on train only
    pre = build_preprocessor(numeric_cols, categorical_cols)
    # Fit transform train, transform val
    # Need to handle target NaN rows — drop them
    mask_tr = train_df[target_col].notna()
    mask_va = val_df[target_col].notna()
    X_train_raw = train_df.loc[mask_tr]
    X_val_raw = val_df.loc[mask_va]
    pre.fit(X_train_raw)  # fit only on train
    X_train = pre.transform(X_train_raw)
    X_val = pre.transform(X_val_raw)
    y_train = X_train_raw[target_col].values
    y_val = X_val_raw[target_col].values

    model = xgb.XGBRegressor(**params, early_stopping_rounds=early_stopping_rounds)
    # eval_set needs (X_val, y_val)
    try:
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            verbose=verbose,
        )
    except TypeError:
        # older xgboost may not support early_stopping_rounds in constructor
        model = xgb.XGBRegressor(**{k:v for k,v in params.items() if k != "early_stopping_rounds"})
        model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=verbose)

    # training metadata
    best_iter = getattr(model, "best_iteration", None)
    # Some versions store best_iteration as None; use n_estimators
    if best_iter is None:
        best_iter = params.get("n_estimators", 800)
    meta = {
        "target": target_col,
        "best_iteration": int(best_iter) if best_iter is not None else None,
        "n_train": int(len(y_train)),
        "n_val": int(len(y_val)),
        "numeric_features": numeric_cols,
        "categorical_features": categorical_cols,
        "feature_names_after_encoding": _get_feature_names(pre, numeric_cols, categorical_cols),
    }
    return model, pre, meta

def _get_feature_names(pre: ColumnTransformer, numeric_cols: List[str], categorical_cols: List[str]) -> List[str]:
    """Best-effort to get output feature names after ColumnTransformer."""
    try:
        # sklearn >=1.0 supports get_feature_names_out
        names = pre.get_feature_names_out()
        return list(names)
    except Exception:
        # fallback: numeric + expanded cats
        out = list(numeric_cols)
        if categorical_cols and "cat" in pre.named_transformers_:
            enc = pre.named_transformers_["cat"]
            try:
                cats = enc.get_feature_names_out(categorical_cols).tolist()
                out.extend(cats)
            except Exception:
                pass
        return out

def train_all_horizons(
    train_df: pd.DataFrame,
    val_df: pd.DataFrame,
    horizons: List[int] = [7, 14, 30],
    params: Optional[Dict]=None,
) -> Dict[int, Tuple[xgb.XGBRegressor, ColumnTransformer, Dict]]:
    """Train one XGB model per horizon. Returns dict horizon -> (model, preprocessor, meta)."""
    numeric_cols, categorical_cols = get_feature_lists(train_df)
    # ensure categorical cols are not in numeric list
    print(f"[XGBoost] Numeric features: {len(numeric_cols)} | Categorical: {categorical_cols}")
    print(f"[XGBoost] Numeric sample: {numeric_cols[:8]}")
    results = {}
    for h in horizons:
        target_col = f"target_freight_{h}d"
        if target_col not in train_df.columns:
            print(f"[XGBoost] WARNING target {target_col} missing, skipping")
            continue
        print(f"\n[XGBoost] Training horizon {h}d -> {target_col}")
        model, pre, meta = train_single_horizon(train_df, val_df, numeric_cols, categorical_cols, target_col, params=params)
        results[h] = (model, pre, meta)
        # Quick val MAE
        from metrics_light import mae as mae_fn
        # Re-compute val predictions for logging
        mask_va = val_df[target_col].notna()
        Xv = pre.transform(val_df.loc[mask_va])
        yv = val_df.loc[mask_va, target_col].values
        pred = model.predict(Xv)
        print(f"  -> Val MAE {mae_fn(yv, pred):.4f} best_iter {meta.get('best_iteration')}")
    return results

def get_feature_importance(model: xgb.XGBRegressor, preprocessor: ColumnTransformer, numeric_cols: List[str], categorical_cols: List[str], top_n: int=20) -> pd.DataFrame:
    """Return gain-based importance mapped to feature names."""
    # Use booster gain
    try:
        booster = model.get_booster()
        # get_score with feature_names default f0,f1...
        scores = booster.get_score(importance_type="gain")
        # Map f0 -> names
        feat_names = _get_feature_names(preprocessor, numeric_cols, categorical_cols)
        # scores keys like f0
        rows = []
        for k, gain in scores.items():
            try:
                idx = int(k[1:])
                name = feat_names[idx] if idx < len(feat_names) else k
            except Exception:
                name = k
            rows.append((name, gain))
        df = pd.DataFrame(rows, columns=["feature", "gain"]).sort_values("gain", ascending=False)
        # Also add sklearn-style importances for completeness
        # model.feature_importances_ is weight-based
        return df.head(top_n)
    except Exception as e:
        # fallback to sklearn importances
        imp = getattr(model, "feature_importances_", None)
        if imp is not None:
            feat_names = _get_feature_names(preprocessor, numeric_cols, categorical_cols)
            df = pd.DataFrame({"feature": feat_names[:len(imp)], "gain": imp}).sort_values("gain", ascending=False)
            return df.head(top_n)
        else:
            return pd.DataFrame(columns=["feature","gain"])

def save_models(results: Dict[int, Tuple[xgb.XGBRegressor, ColumnTransformer, Dict]], out_dir: str="models/xgboost", numeric_cols=None, categorical_cols=None):
    """Persist each horizon model + preprocessor + metadata."""
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    # Also save to models/final for unified final artifacts?
    saved = {}
    for h, (model, pre, meta) in results.items():
        horizon_dir = out / f"xgboost_{h}d"
        horizon_dir.mkdir(parents=True, exist_ok=True)
        # Save model via joblib (sklearn wrapper) and booster json
        joblib.dump(model, horizon_dir / "model.joblib")
        joblib.dump(pre, horizon_dir / "preprocessor.joblib")
        # Also save booster in json for inspection
        try:
            model.get_booster().save_model(str(horizon_dir / "xgboost_model.json"))
        except Exception:
            pass
        # Save meta
        with open(horizon_dir / "metadata.json", "w") as f:
            json.dump(meta, f, indent=2)
        # Feature importance
        try:
            imp_df = get_feature_importance(model, pre, meta["numeric_features"], meta["categorical_features"], top_n=30)
            imp_df.to_csv(horizon_dir / "feature_importance.csv", index=False)
        except Exception as e:
            print(f"Importance save failed for {h}d: {e}")
        # Also copy to models/final flat structure for inference convenience
        final_dir = Path("models/final")
        final_dir.mkdir(parents=True, exist_ok=True)
        # Save single file per horizon
        joblib.dump({"model": model, "preprocessor": pre, "meta": meta, "params": XGB_PARAMS}, final_dir / f"xgboost_{h}d.joblib")
        saved[h] = str(horizon_dir)
        print(f"[XGBoost] Saved {h}d to {horizon_dir} and models/final/xgboost_{h}d.joblib")
    # Global config
    global_meta = {
        "seed": RANDOM_SEED,
        "params": XGB_PARAMS,
        "horizons": list(results.keys()),
        "numeric_count": len(numeric_cols) if numeric_cols else None,
        "categorical_cols": categorical_cols,
    }
    with open(out / "xgboost_config.json", "w") as f:
        json.dump(global_meta, f, indent=2)
    with open(Path("models/final") / "xgboost_config.json", "w") as f:
        json.dump(global_meta, f, indent=2)
    return saved

def load_model(horizon: int, base_dir: str="models/xgboost"):
    """Load model + preprocessor + meta for horizon."""
    # Prefer models/final single joblib
    final_path = Path(f"models/final/xgboost_{horizon}d.joblib")
    if final_path.exists():
        bundle = joblib.load(final_path)
        return bundle["model"], bundle["preprocessor"], bundle["meta"]
    # fallback to directory
    horizon_dir = Path(base_dir) / f"xgboost_{horizon}d"
    model = joblib.load(horizon_dir / "model.joblib")
    pre = joblib.load(horizon_dir / "preprocessor.joblib")
    meta = json.load(open(horizon_dir / "metadata.json"))
    return model, pre, meta

def predict_single(model: xgb.XGBRegressor, preprocessor: ColumnTransformer, df_row: pd.DataFrame) -> float:
    """Predict for a single-row DataFrame (must have required numeric/cat cols)."""
    X = preprocessor.transform(df_row)
    pred = model.predict(X)
    return float(pred[0])

# Quick smoke test
if __name__ == "__main__":
    import sys
    sys.path.insert(0, "src/data")
    sys.path.insert(0, "src/evaluation")
    train = pd.read_parquet("data/processed/train.parquet")
    val = pd.read_parquet("data/processed/val.parquet")
    numeric_cols, cat_cols = get_feature_lists(train)
    print("Numeric:", numeric_cols[:10])
    print("Cat:", cat_cols)
    res = train_all_horizons(train, val, horizons=[7])
    print("Done")
