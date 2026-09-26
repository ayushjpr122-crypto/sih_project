"""
Feature engineering — identical pipeline for train/val/test/inference (no leakage).
All lags/rollings are shifted by 1 to avoid look-ahead.
"""
import pandas as pd
import numpy as np

TARGET = "freight_rate_usd_per_ton"

def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["day_of_year"] = df["date"].dt.dayofyear
    df["day_of_week"] = df["date"].dt.dayofweek
    df["week_of_year"] = df["date"].dt.isocalendar().week.astype(int)
    # cyclic encodings
    df["month_sin"] = np.sin(2*np.pi*df["month"]/12)
    df["month_cos"] = np.cos(2*np.pi*df["month"]/12)
    df["doy_sin"] = np.sin(2*np.pi*df["day_of_year"]/365.25)
    df["doy_cos"] = np.cos(2*np.pi*df["day_of_year"]/365.25)
    df["dow_sin"] = np.sin(2*np.pi*df["day_of_week"]/7)
    df["dow_cos"] = np.cos(2*np.pi*df["day_of_week"]/7)
    # monsoon flag
    df["is_monsoon"] = df["month"].isin([6,7,8,9]).astype(int)
    df["is_winter_peak"] = df["month"].isin([1,2,11,12]).astype(int)
    return df

def add_lag_rolling_features(df: pd.DataFrame, group_cols=["trade_lane","vessel_type"]) -> pd.DataFrame:
    """
    Per group, sorted by date. Adds lag and rolling features using only past data (shift 1).
    Must be called AFTER sorting and BEFORE splitting, but leakage-free per group.
    """
    df = df.copy()
    df = df.sort_values(group_cols + ["date"])

    # Target lags
    for lag in [1,7,14,30]:
        df[f"lag_{lag}"] = df.groupby(group_cols)[TARGET].shift(lag)
    # Rolling means/stds on past window (shift 1 then rolling)
    for win in [7,14,30]:
        s = df.groupby(group_cols)[TARGET].shift(1).rolling(win, min_periods=max(1, win//2))
        # Use transform-like via groupby apply is slower; we do manual via rolling grouped?
        # Simpler: use groupby + transform with rolling via apply
        # We'll do looped calculation per group to avoid leakage bugs.
        pass
    # Rolling features: compute per group using explicit loop to avoid pandas groupby-apply column dropping (pandas 3.x)
    # Initialize columns
    for win in [7,14,30]:
        df[f"rolling_mean_{win}"] = np.nan
        if win in [7,30]:
            df[f"rolling_std_{win}"] = np.nan
    # Loop per group
    for _, g in df.groupby(group_cols):
        idx = g.sort_values("date").index
        s = df.loc[idx, TARGET].shift(1)
        for win in [7,14,30]:
            df.loc[idx, f"rolling_mean_{win}"] = s.rolling(win, min_periods=max(1, win//2)).mean().values
            if win in [7,30]:
                df.loc[idx, f"rolling_std_{win}"] = s.rolling(max(win,7), min_periods=max(1, win//2)).std().values

    # Additional features
    df["pct_change_1"] = df.groupby(group_cols)[TARGET].pct_change(1)
    df["pct_change_1"] = df.groupby(group_cols)["pct_change_1"].shift(1)
    df["momentum_7"] = df["lag_1"] - df["lag_7"]
    df["momentum_30"] = df["lag_1"] - df["lag_30"]
    # bdi/fuel lags
    for col in ["bdi_proxy","brent_proxy_usd","iron_ore_price_usd","coal_price_usd"]:
        df[f"{col}_lag_7"] = df.groupby(group_cols)[col].shift(7)
    # extern rolling mean 7 per group
    for col in ["bdi_proxy","brent_proxy_usd"]:
        df[f"{col}_roll_mean_7"] = np.nan
    for _, g in df.groupby(group_cols):
        idx = g.sort_values("date").index
        for col in ["bdi_proxy","brent_proxy_usd"]:
            df.loc[idx, f"{col}_roll_mean_7"] = df.loc[idx, col].shift(1).rolling(7, min_periods=4).mean().values
    # Historical volatility (rolling std) already have; add volatility lag
    df["volatility_30"] = df["rolling_std_30"]
    # Distance interaction (static)
    df["freight_per_nm"] = df["freight_rate_usd_per_ton"] / df["route_distance_nm"]  # TARGET-derived, only for analysis; remove from features
    return df

def build_features(df: pd.DataFrame) -> pd.DataFrame:
    df = add_time_features(df)
    df = add_lag_rolling_features(df)
    # One-hot vessel_type/origin/destination for ML (kept as categorical later)
    # Drop leakage column
    if "freight_per_nm" in df.columns:
        df = df.drop(columns=["freight_per_nm"])
    # Drop rows where lag features NaN (first 30 days per series)
    lag_cols = [c for c in df.columns if c.startswith("lag_") or c.startswith("rolling_") or c.startswith("momentum") or c.startswith("pct_change")]
    # keep rows with at least lag_30 available
    before = len(df)
    df = df.dropna(subset=["lag_30","rolling_mean_30","rolling_std_30"])
    after = len(df)
    print(f"Feature engineering: dropped {before-after} rows due to lag warmup; {after} rows remain")
    return df

# Feature list for modeling (exclude target, date, groups, data_source)
EXCLUDE = {"date","trade_lane","vessel_type","origin","destination","cargo_type","season","data_source", TARGET, "freight_per_nm"}

def get_feature_columns(df: pd.DataFrame):
    return [c for c in df.columns if c not in EXCLUDE and df[c].dtype != "object"]

if __name__ == "__main__":
    import sys
    p = sys.argv[1] if len(sys.argv)>1 else "data/synthetic/freight_rates_synthetic.csv"
    df = pd.read_csv(p)
    df = build_features(df)
    print(df.head())
    print("Features:", get_feature_columns(df))
