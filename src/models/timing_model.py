"""
Model C: Charter Timing — BUY_NOW / WAIT / WATCH.
Target defined mathematically: future return over horizon h
  ret = (target_freight_h - freight_t)/freight_t
  BUY_NOW if ret > +0.05 (prices rising)
  WAIT    if ret < -0.03 (prices falling)
  WATCH   else
We train a classifier on current features to predict timing label.
"""
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

def train_timing_classifier(train_df, val_df, feature_cols, label_col="timing_label_7d"):
    X_train = train_df[feature_cols].fillna(train_df[feature_cols].median())
    y_train = train_df[label_col]
    X_val = val_df[feature_cols].fillna(train_df[feature_cols].median())
    y_val = val_df[label_col]
    # filter NaNs
    mask_tr = y_train.notna()
    mask_val = y_val.notna()
    X_train, y_train = X_train[mask_tr], y_train[mask_tr]
    X_val, y_val = X_val[mask_val], y_val[mask_val]
    clf = Pipeline([("scaler", StandardScaler()), ("rf", RandomForestClassifier(n_estimators=200, max_depth=10, class_weight="balanced", random_state=42, n_jobs=-1))])
    clf.fit(X_train, y_train)
    pred = clf.predict(X_val)
    return clf, pred, y_val.values

