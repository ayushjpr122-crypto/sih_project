"""
Forecasting metrics (SIH26006: do NOT use accuracy for regression).
"""
import numpy as np
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, precision_recall_fscore_support, confusion_matrix

def mae(y_true, y_pred): return mean_absolute_error(y_true, y_pred)
def rmse(y_true, y_pred): return mean_squared_error(y_true, y_pred) ** 0.5
def mape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    mask = y_true != 0
    return np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
def smape(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    denom = (np.abs(y_true) + np.abs(y_pred)) / 2
    mask = denom != 0
    return np.mean(np.abs(y_true[mask] - y_pred[mask]) / denom[mask]) * 100
def directional_accuracy(y_true, y_pred, y_prev):
    """% correct direction vs previous value. y_prev is previous observed (lag_1)."""
    true_dir = np.sign(y_true - y_prev)
    pred_dir = np.sign(y_pred - y_prev)
    # zero direction considered correct if both zero or both non-zero same sign
    return np.mean(true_dir == pred_dir) * 100

def r2(y_true, y_pred): return r2_score(y_true, y_pred)

def regression_report(y_true, y_pred, y_prev=None):
    return {
        "MAE": mae(y_true, y_pred),
        "RMSE": rmse(y_true, y_pred),
        "MAPE": mape(y_true, y_pred),
        "sMAPE": smape(y_true, y_pred),
        "R2": r2(y_true, y_pred),
        "DirectionalAccuracy": directional_accuracy(y_true, y_pred, y_prev) if y_prev is not None else None,
    }

def classification_report_dict(y_true, y_pred, labels=None):
    acc = accuracy_score(y_true, y_pred)
    prec, rec, f1, _ = precision_recall_fscore_support(y_true, y_pred, average="weighted", zero_division=0)
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    return {"accuracy": acc, "precision_w": prec, "recall_w": rec, "f1_w": f1, "confusion_matrix": cm.tolist() if hasattr(cm, "tolist") else cm}
