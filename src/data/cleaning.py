"""
Cleaning utilities — shared for synthetic & future real data.
"""
import pandas as pd
import numpy as np

def clip_outliers(df: pd.DataFrame, cols, q_low=0.001, q_high=0.999):
    df = df.copy()
    for c in cols:
        lo, hi = df[c].quantile([q_low, q_high])
        df[c] = df[c].clip(lo, hi)
    return df

def forward_fill_small_gaps(df: pd.DataFrame, group_cols, max_gap=3):
    """Forward fill up to max_gap days per group for external regressors."""
    df = df.sort_values(group_cols + ["date"])
    for col in ["bdi_proxy","brent_proxy_usd","iron_ore_price_usd","coal_price_usd"]:
        if col in df.columns:
            df[col] = df.groupby(group_cols)[col].transform(lambda s: s.ffill(limit=max_gap))
    return df
