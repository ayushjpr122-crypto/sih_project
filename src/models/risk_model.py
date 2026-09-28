"""
Model D: Risk classification LOW/MEDIUM/HIGH based on rolling volatility quantile.
Defined mathematically per group (see dataset_builder.py):
  HIGH if rolling_std_30 > 66th pct
  MEDIUM if >33rd pct else LOW
Classifier predicts risk from current features (excluding direct volatility circularity? We keep it but evaluate).
"""
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def train_risk_classifier(train_df, val_df, feature_cols):
    label_col = "risk_label"
    X_train = train_df[feature_cols].fillna(train_df[feature_cols].median())
    y_train = train_df[label_col]
    X_val = val_df[feature_cols].fillna(train_df[feature_cols].median())
    y_val = val_df[label_col]
    mask_tr = y_train.notna()
    mask_val = y_val.notna()
    X_train, y_train = X_train[mask_tr], y_train[mask_tr]
    X_val, y_val = X_val[mask_val], y_val[mask_val]
    clf = Pipeline([("scaler", StandardScaler()), ("rf", RandomForestClassifier(n_estimators=200, max_depth=8, random_state=42, n_jobs=-1))])
    clf.fit(X_train, y_train)
    pred = clf.predict(X_val)
    return clf, pred, y_val.values

def explain_risk(row, forecast_uncertainty: float = None, ports_df=None, vessels_df=None) -> dict:
    """
    Explainable risk assessment per SIH26006: returns risk drivers as human-readable dict.
    Drivers checked (all leakage-free, based on current observability):
      - freight_volatility: rolling_std_30 / volatility_30
      - forecast_uncertainty: optional residual/std from ensemble or provided
      - market_indicator_movement: bdi_proxy vs its 7d roll mean, brent movement
      - port_constraint: draft slack for destination
      - vessel_feasibility: feasible count / infeasible reason
      - idle_deadheading_exposure: 1 - utilization proxy
    """
    drivers = {}
    try:
        vol = float(row.get("volatility_30", row.get("rolling_std_30", 0)))
        drivers["freight_volatility"] = {"value": round(vol, 3), "level": "HIGH" if vol > 3.5 else "MEDIUM" if vol > 2.0 else "LOW",
                                         "explain": f"30d rolling std {vol:.2f} (high vol -> higher charter risk)"}
    except Exception:
        drivers["freight_volatility"] = {"value": None, "level": "UNKNOWN", "explain": "vol unavailable"}
    if forecast_uncertainty is not None:
        drivers["forecast_uncertainty"] = {"value": round(float(forecast_uncertainty),3),
                                           "level": "HIGH" if forecast_uncertainty>2.5 else "LOW",
                                           "explain": "Residual spread among models/ensemble; higher => less trust in forecast"}
    # market indicators
    try:
        bdi = float(row.get("bdi_proxy", 0))
        bdi_roll = float(row.get("bdi_proxy_roll_mean_7", bdi))
        bdi_delta = bdi - bdi_roll
        brent = float(row.get("brent_proxy_usd", 0))
        brent_lag = float(row.get("brent_proxy_usd_lag_7", brent))
        brent_delta = brent - brent_lag
        level = "HIGH" if abs(bdi_delta) > 150 or abs(brent_delta) > 6 else "LOW"
        drivers["market_indicator_movement"] = {"value": {"bdi_delta_7d": round(bdi_delta,1), "brent_delta_7d": round(brent_delta,2)},
                                                "level": level,
                                                "explain": f"BDI 7d delta {bdi_delta:.1f}, Brent 7d delta {brent_delta:.2f}: large swing => market risk"}
    except Exception:
        drivers["market_indicator_movement"] = {"value": None, "level": "UNKNOWN", "explain": "market regressors unavailable"}
    # port constraint
    try:
        dest = row.get("destination", None)
        if ports_df is not None and dest is not None:
            pr = ports_df[ports_df["port_name"]==dest]
            if not pr.empty:
                maxd = float(pr.iloc[0]["max_draft_m"])
                vessel = str(row.get("vessel_type", ""))
                # vessel draft lookup if vessels_df provided
                vd = None
                if vessels_df is not None and not vessels_df.empty:
                    vr = vessels_df[vessels_df["vessel_class"]==vessel]
                    if not vr.empty:
                        vd = float(vr.iloc[0]["draft_m"])
                if vd is not None:
                    slack = maxd - vd
                    drivers["port_constraint"] = {"value": round(slack,2), "level": "HIGH" if slack < 1.0 else "LOW",
                                                  "explain": f"Draft slack {slack:.1f}m at {dest} for {vessel}: <1m => berthing/tide risk"}
                else:
                    drivers["port_constraint"] = {"value": round(maxd,1), "level": "LOW", "explain": f"Port {dest} max draft {maxd}m"}
    except Exception:
        pass
    # vessel feasibility driver — uses existing feasible_vessels if available
    try:
        # lazy import to avoid circular
        from vessel_model import feasible_vessels
        if ports_df is not None and vessels_df is not None:
            feasible = feasible_vessels(float(row.get("cargo_quantity_t", 50000)), row.get("destination"), ports_df, vessels_df)
            level = "LOW" if len(feasible) >=2 else "HIGH" if len(feasible)==0 else "MEDIUM"
            drivers["vessel_feasibility"] = {"value": len(feasible), "level": level,
                                             "explain": f"{len(feasible)} feasible classes of 4: fewer options => chartering risk {'(NO_FEASIBLE)' if len(feasible)==0 else ''}"}
    except Exception:
        pass
    # idle/deadheading exposure from utilization
    try:
        cargo_qty = float(row.get("cargo_quantity_t", 50000))
        # approximate typical dwt from vessel_type
        dwt_map = {"Handysize":28000,"Supramax":58000,"Panamax":75000,"Capesize":175000}
        dwt = dwt_map.get(str(row.get("vessel_type","")), 58000)
        util = cargo_qty / dwt if dwt>0 else 1.0
        idle_exposure = max(0, 1.0 - min(util,1.0))
        level = "HIGH" if idle_exposure > 0.40 else "LOW"
        drivers["idle_deadheading_exposure"] = {"value": round(idle_exposure,3), "level": level,
                                                "explain": f"Utilization {util:.2f}: underutilized => deadheading/idle penalty {idle_exposure:.2f}"}
    except Exception:
        pass
    # overall risk bucket
    high_count = sum(1 for v in drivers.values() if v.get("level")=="HIGH")
    if high_count >=3:
        overall = "HIGH"
    elif high_count >=1:
        overall = "MEDIUM"
    else:
        overall = "LOW"
    return {"overall": overall, "drivers": drivers, "high_driver_count": high_count}
