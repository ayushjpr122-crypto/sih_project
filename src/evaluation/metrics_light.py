import numpy as np

def mae(y_true, y_pred): return float(np.mean(np.abs(np.array(y_true)-np.array(y_pred))))
def rmse(y_true, y_pred): return float(np.sqrt(np.mean((np.array(y_true)-np.array(y_pred))**2)))
def mape(y_true, y_pred):
    y_true,y_pred=np.array(y_true),np.array(y_pred)
    mask=y_true!=0
    return float(np.mean(np.abs((y_true[mask]-y_pred[mask])/y_true[mask])*100)) if mask.sum()>0 else float('nan')
def smape(y_true,y_pred):
    y_true,y_pred=np.array(y_true),np.array(y_pred)
    denom=(np.abs(y_true)+np.abs(y_pred))/2
    mask=denom!=0
    return float(np.mean(np.abs(y_true[mask]-y_pred[mask])/denom[mask]*100)) if mask.sum()>0 else float('nan')
def r2(y_true,y_pred):
    y_true,y_pred=np.array(y_true),np.array(y_pred)
    ss_res=np.sum((y_true-y_pred)**2); ss_tot=np.sum((y_true-y_true.mean())**2)
    return float(1-ss_res/(ss_tot+1e-12))
def directional_accuracy(y_true,y_pred,y_prev):
    true_dir=np.sign(np.array(y_true)-np.array(y_prev))
    pred_dir=np.sign(np.array(y_pred)-np.array(y_prev))
    return float(np.mean(true_dir==pred_dir)*100)
def regression_report(y_true,y_pred,y_prev=None):
    return {"MAE":mae(y_true,y_pred),"RMSE":rmse(y_true,y_pred),"MAPE":mape(y_true,y_pred),"sMAPE":smape(y_true,y_pred),"R2":r2(y_true,y_pred),"DirectionalAccuracy": directional_accuracy(y_true,y_pred,y_prev) if y_prev is not None else None}
