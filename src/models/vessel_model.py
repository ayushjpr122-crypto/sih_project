"""
Model B: Vessel Recommendation with physical feasibility constraints.
Step 1: Rule-based feasibility
  vessel draft <= port max_draft
  vessel LOA <= port max_loa
  vessel beam <= port max_beam
  cargo_quantity compatible (quantity <= DWT * 0.95 and >= DWT * 0.3)
Step 2: Rank feasible vessels by forecast freight cost + operational score
  total_cost = forecast_rate * cargo_quantity
  For demo, simple ranking by lowest total_cost among feasible; ML can learn preference from history.
"""
import pandas as pd
import numpy as np
from pathlib import Path

def load_constraints():
    ports = pd.read_csv("data/ports/east_coast_india_ports.csv")
    vessels = pd.read_csv("data/vessels/vessel_classes.csv")
    return ports, vessels

def feasible_vessels(cargo_qty_t, destination_port, ports_df, vessels_df):
    port_row = ports_df[ports_df["port_name"]==destination_port]
    if port_row.empty:
        return []
    max_draft = float(port_row.iloc[0]["max_draft_m"])
    max_loa = float(port_row.iloc[0]["max_loa_m"])
    max_beam = float(port_row.iloc[0]["max_beam_m"])
    feasible = []
    for _, v in vessels_df.iterrows():
        if v["draft_m"] <= max_draft and v["loa_m"] <= max_loa and v["beam_m"] <= max_beam:
            # cargo compatibility: allow 30% to 98% of DWT utilization
            if cargo_qty_t <= v["dwt_max_t"]*0.98 and cargo_qty_t >= v["dwt_min_t"]*0.3:
                feasible.append(v["vessel_class"])
    return feasible

def recommend_vessel_row(row, forecast_rate, ports_df, vessels_df):
    """
    Hybrid approach per SIH26006: hard constraints first, then economics-based ranking.
    Kept backward-compatible single-arg signature but now computes richer scoring.
    Use rank_feasible_vessels for detailed scoring; this wrapper returns top choice.
    """
    ranked_detail = rank_feasible_vessels(row, forecast_rate, ports_df, vessels_df)
    if not ranked_detail:
        return None, [], "NO_FEASIBLE"
    feasible = [r["vessel_class"] for r in ranked_detail]
    best = ranked_detail[0]["vessel_class"]
    return best, feasible, "RANKED_HYBRID"

def rank_feasible_vessels(row, forecast_rate, ports_df, vessels_df, risk_score: float = None):
    """
    Rank feasible vessels using hybrid scoring that respects SIH26006 charter optimization.
    Hard constraints already applied via feasible_vessels (draft/LOA/beam/cargo).

    Economics & operations scoring (lower score = better):
      total_cost = forecast_rate * cargo_quantity_t
      utilization = cargo_quantity_t / typical_dwt_t  (penalize <60% or >95% utilization)
      voyage_cost_proxy = (route_distance_nm * brent_proxy_usd * 0.02) / 1000  # fuel proxy per vessel size scaling
      idle_penalty = (1 - utilization) * 8   # deadheading/idle exposure: underutilized vessel wastes capacity
      risk_penalty = (risk_score or get_risk_from_row(row)) * 2  # high volatility -> prefer smaller vessel
      port_slack = port_max_draft - vessel_draft  (prefer slack for safety, but not too much overspec)

    All components weighted and normalized. Returns sorted list of dicts with breakdown.
    Does NOT claim to be real-world optimal without validated voyage datasets — synthetic/demo proxy.
    """
    feasible = feasible_vessels(row["cargo_quantity_t"], row["destination"], ports_df, vessels_df)
    if not feasible:
        return []
    cargo_qty = float(row.get("cargo_quantity_t", 50000))
    route_distance = float(row.get("route_distance_nm", 3000))
    brent = float(row.get("brent_proxy_usd", 70))
    bdi = float(row.get("bdi_proxy", 1400))
    # risk_score from risk model if supplied, else derive from volatility_30 or rolling_std_30
    if risk_score is None:
        try:
            vol = float(row.get("volatility_30", row.get("rolling_std_30", 2.0)))
            # normalize to 0-1 via simple scaling
            risk_score = min(1.0, max(0.0, vol / 6.0))
        except Exception:
            risk_score = 0.5
    # Port slack lookup
    port_row = ports_df[ports_df["port_name"] == row.get("destination")]
    port_max_draft = float(port_row.iloc[0]["max_draft_m"]) if not port_row.empty else 21.0

    results = []
    base_rate_proxy = float(forecast_rate) if forecast_rate is not None else float(row.get("freight_rate_usd_per_ton", 20))
    # vessel size cost scaler: larger vessels cheaper per ton (from generator base rates)
    size_cost_factor = {"Handysize": 1.6, "Supramax": 1.25, "Panamax": 1.05, "Capesize": 0.85}
    for _, v in vessels_df.iterrows():
        vc = v["vessel_class"]
        if vc not in feasible:
            continue
        typical_dwt = float(v["typical_dwt_t"])
        dwt_max = float(v["dwt_max_t"])
        draft = float(v["draft_m"])
        loa = float(v["loa_m"])
        beam = float(v["beam_m"])
        utilization = cargo_qty / typical_dwt if typical_dwt > 0 else 1.0
        # Utilization penalty: ideal 0.75-0.95, penalize outside
        if 0.75 <= utilization <= 0.95:
            util_penalty = 0.0
        elif utilization < 0.75:
            util_penalty = (0.75 - utilization) * 12  # underutilized -> idle/deadheading
        else:
            util_penalty = (utilization - 0.95) * 18  # overutilized -> risky
        # Voyage economics
        freight_proxy = base_rate_proxy * size_cost_factor.get(vc, 1.0)
        total_cost = freight_proxy * cargo_qty
        # Fuel proxy scaled by size (larger burns more but more efficient per ton)
        fuel_cost = (route_distance * brent * 0.018 * (typical_dwt / 50000)**0.45) / 1000
        # Idle/deadheading penalty already via util_penalty; add absolute low-util deadhead extra
        deadhead_extra = (1.0 - min(utilization, 1.0)) * 500 if utilization < 0.5 else 0
        # Risk adjustment: high risk -> slight preference for smaller (more flexible) vessels
        risk_adj = risk_score * (0 if vc in ["Capesize"] else 0.5 if vc=="Panamax" else 1.0)
        # Port feasibility slack: prefer not too much overspec but also safe margin
        draft_slack = port_max_draft - draft
        port_slack_penalty = max(0, (3.0 - draft_slack)) * 0.3 if draft_slack < 3 else 0  # too tight = risk

        # Composite score: weighted sum (lower better). Weights chosen to be interpretable, not overfit to synthetic.
        composite = (
            0.45 * (total_cost / 100000)  # normalize
            + 0.20 * util_penalty
            + 0.15 * (fuel_cost / 100)
            + 0.10 * deadhead_extra / 1000
            + 0.06 * risk_adj
            + 0.04 * port_slack_penalty
        )
        results.append({
            "vessel_class": vc,
            "feasible": True,
            "composite_score": float(composite),
            "total_cost_usd": float(total_cost),
            "cost_per_ton_proxy": float(freight_proxy),
            "utilization": float(utilization),
            "util_penalty": float(util_penalty),
            "fuel_proxy_usd": float(fuel_cost),
            "deadhead_penalty": float(deadhead_extra / 1000),
            "risk_adj": float(risk_adj),
            "draft_slack_m": float(draft_slack),
            "explain": f"util={utilization:.2f} cost/ton={freight_proxy:.2f} slack={draft_slack:.1f}m risk={risk_score:.2f}",
        })
    # Sort by composite ascending
    results = sorted(results, key=lambda x: x["composite_score"])
    return results

def get_risk_from_row(row) -> float:
    rl = str(row.get("risk_label", "")).upper()
    if rl == "HIGH":
        return 0.85
    if rl == "MEDIUM":
        return 0.45
    if rl == "LOW":
        return 0.15
    # fallback from volatility
    try:
        vol = float(row.get("volatility_30", 2.5))
        return min(1.0, max(0.0, vol/6.0))
    except Exception:
        return 0.5

def evaluate_vessel_accuracy(df_test, pred_col="recommended", true_col="vessel_type", ports_df=None, vessels_df=None):
    # Accuracy only over rows where recommendation feasible
    mask = df_test[pred_col].notna() & df_test[true_col].notna()
    if mask.sum()==0:
        return {"accuracy": 0, "feasible_coverage": 0}
    acc = (df_test.loc[mask, pred_col]==df_test.loc[mask, true_col]).mean()
    return {"accuracy": float(acc), "feasible_coverage": float(mask.mean()), "n": int(mask.sum())}
