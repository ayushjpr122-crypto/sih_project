"""
Baselines for freight forecasting (Model A).
- Naive (lag_1)
- Moving average (rolling_mean_7)
- Linear Regression
- Random Forest
- Gradient Boosting (HistGradientBoosting)
- Statistical: Exponential Smoothing-like via naive + trend (simple AR)
All use same feature set except naive/MA which are raw lags.
"""
import pandas as pd
import numpy as np
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def naive_forecast(df, horizon_col="target_freight_7d"):
    # Predict lag_1 as horizon forecast (naive persistence)
    # For horizon 7d, more appropriate is lag_1 vs future; but naive baseline = last observed
    return df["lag_1"].values, df[horizon_col].values

def ma_forecast(df, horizon_col="target_freight_7d"):
    return df["rolling_mean_7"].values, df[horizon_col].values

def train_sklearn_model(train_df, val_df, feature_cols, target_col, model_type="ridge"):
    X_train = train_df[feature_cols].fillna(train_df[feature_cols].median())
    y_train = train_df[target_col]
    X_val = val_df[feature_cols].fillna(train_df[feature_cols].median())
    y_val = val_df[target_col]

    if model_type == "ridge":
        model = Pipeline([("scaler", StandardScaler()), ("reg", Ridge(alpha=1.0))])
    elif model_type == "rf":
        model = RandomForestRegressor(n_estimators=200, max_depth=12, n_jobs=-1, random_state=42)
    elif model_type == "gb":
        model = HistGradientBoostingRegressor(max_iter=300, max_depth=6, learning_rate=0.08, random_state=42)
    else:
        raise ValueError(model_type)
    model.fit(X_train, y_train)
    pred_val = model.predict(X_val)
    return model, pred_val, y_val.values

def statistical_exp_smooth(train_df, val_df, target_col="target_freight_7d", alpha=0.3):
    """Simple exponential smoothing baseline: EWMA of past freight as forecast."""
    # EWMA of lag_1 series per group? Simplified global: predict rolling weighted avg
    # Use lag_1 * 0.7 + rolling_mean_7 *0.3 as crude exp smooth
    pred = 0.7*val_df["lag_1"].values + 0.3*val_df["rolling_mean_7"].values
    return pred, val_df[target_col].values
