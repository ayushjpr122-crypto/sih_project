"""
SIH26006 Synthetic Freight Data Generator
==========================================
Organization: Ministry of Steel — East Coast India bulk chartering
Purpose: Generate reproducible synthetic time-series for ML pipeline development
         where real route-vessel freight rates are proprietary (Baltic Exchange / Clarksons).

SEED: 42 (fixed for reproducibility)

ASSUMPTIONS (documented, not hidden):
 1. Base freight rates scale inversely with vessel size (Capesize cheapest per ton) and
    linearly with route distance (NM). Values anchored to 2018-2023 published range
    summaries (UNCTAD, Clarksons headline averages), NOT exact quotes.
 2. Seasonality: annual sinusoid + Indian monsoon (Jun-Sep) dampening + Northern winter peak.
 3. Trend: 2% annual linear + 3-year commodity cycle sinusoid (~±10%).
 4. Volatility: heteroskedastic — higher when BDI proxy high, with GARCH-like persistence.
 5. Correlations:
      - freight ↔ BDI proxy: 0.7-0.85 (by construction: freight = f(BDI))
      - freight ↔ Brent (fuel): 0.35-0.45 via shared term
      - Capesize ↔ IronOre price: 0.5
      - congestion ↔ freight: 0.25
 6. All prices in USD; no FX conversion.
 7. Route distances are great-circle proxies (ports.com), rounded.
 8. Port feasibility is enforced downstream, not here — generator produces all combos;
    vessel recommendation layer filters by draft/LOA/beam.

LABELING:
  Every row has data_source="synthetic". Header of CSV contains generation metadata.
  DO NOT present synthetic metrics as real-world accuracy.

OUTPUT:
  data/synthetic/freight_rates_synthetic.csv
  ~64 series × 2922 days = ~187k rows (configurable)

USAGE:
  python src/data/generate_synthetic_data.py --start 2018-01-01 --end 2025-12-31

Author: SIH26006 ML Team — 2026-03
"""
import argparse
import numpy as np
import pandas as pd
from pathlib import Path

SEED = 42
np.random.seed(SEED)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ORIGINS = {
    "Australia_Hedland": {"distance_nm": 4800, "cargo": "Iron_Ore", "region": "Australia"},
    "Indonesia_Banjarmasin": {"distance_nm": 2600, "cargo": "Coal", "region": "Indonesia"},
    "SouthAfrica_RichardsBay": {"distance_nm": 5500, "cargo": "Coal", "region": "South_Africa"},
    "Brazil_Tubarao": {"distance_nm": 8500, "cargo": "Iron_Ore", "region": "Brazil"},
}

DESTINATIONS = {
    "Paradip": {"port_draft": 14.5},
    "Visakhapatnam": {"port_draft": 17.0},
    "Gangavaram": {"port_draft": 21.0},
    "Dhamra": {"port_draft": 18.0},
}

VESSELS = {
    "Handysize": {"base_rate_usd": 32.0, "dwt": 28000, "draft": 9.5},
    "Supramax": {"base_rate_usd": 24.0, "dwt": 58000, "draft": 12.5},
    "Panamax": {"base_rate_usd": 20.0, "dwt": 75000, "draft": 13.5},
    "Capesize": {"base_rate_usd": 14.0, "dwt": 175000, "draft": 17.5},
}

# Distance multiplier: longer route => higher per-ton but sublinear (economy of distance)
def distance_factor(nm):
    return 0.6 + 0.4 * (nm / 8500)

# Cargo multiplier
CARGO_MULT = {"Iron_Ore": 1.0, "Coal": 0.95, "Grains": 1.05}

def generate_external_series(dates, rng):
    """Generate shared external regressors (BDI proxy, Brent, Iron Ore, Coal).
    These are GLOBAL series, broadcast to all routes, then route-specific noise added.
    """
    n = len(dates)
    t = np.arange(n)  # days since start
    # Time in years for trend
    years = t / 365.25

    # --- Baltic Dry Index proxy ---
    # BDI typical 500-4000, highly volatile
    bdi_trend = 1400 + 30 * years + 200 * np.sin(2 * np.pi * t / (365.25*3))  # 3-yr cycle
    bdi_season = 180 * np.sin(2*np.pi*(t - 30)/365.25) + 80*np.sin(4*np.pi*t/365.25)  # biannual bump
    # volatility clustering: GARCH-like
    bdi_vol = np.zeros(n)
    bdi_vol[0] = 120
    resid = rng.normal(0, 1, n)
    for i in range(1, n):
        bdi_vol[i] = 0.92 * bdi_vol[i-1] + 0.08 * abs(resid[i-1]) * 150 + 10
    bdi_noise = resid * (bdi_vol/150) * 140
    # add shock periods (2021 post-covid boom, 2022 volatility)
    shock = np.zeros(n)
    # 2021-01 to 2021-12 boom
    mask_2021 = (dates >= "2021-03-01") & (dates < "2022-01-01")
    shock[mask_2021] = 800 * np.exp(-((np.where(mask_2021)[0] - np.where(mask_2021)[0][0] - 150)**2)/(2*80**2)) if np.any(mask_2021) else 0
    # simple loop for shock
    # regenerate shock more simply
    shock = np.zeros(n)
    for i, d in enumerate(dates):
        y = pd.Timestamp(d).year
        if y == 2021:
            # triangular boom peak mid-year
            day_of_year = pd.Timestamp(d).dayofyear
            shock[i] = 900 * max(0, 1 - abs(day_of_year-180)/120)
    bdi = bdi_trend + bdi_season + bdi_noise + shock
    bdi = np.clip(bdi, 400, 4500)

    # --- Brent crude proxy (fuel) ---
    # around 60-120, random walk + seasonality
    brent = np.zeros(n)
    brent[0] = 68
    for i in range(1, n):
        drift = 0.015 + 4*np.sin(2*np.pi*t[i]/365.25)/365
        brent[i] = brent[i-1] * (1 + rng.normal(drift/365, 0.015))  # daily vol ~1.5%
        # correlate with BDI shock
        brent[i] += 0.006 * (bdi[i] - bdi[i-1])
    brent = np.clip(brent, 35, 140)
    # 2022 spike
    for i, d in enumerate(dates):
        if pd.Timestamp(d).year == 2022 and 60 <= pd.Timestamp(d).dayofyear <= 180:
            brent[i] += 25 * np.sin(np.pi*(pd.Timestamp(d).dayofyear-60)/120)

    # --- Iron ore price (62% CFR) ---
    iron = 95 + 12*years + 25*np.sin(2*np.pi*t/(365.25*1.8)) + 15*np.sin(2*np.pi*t/365.25)
    iron_noise = rng.normal(0, 6, n)
    # correlate with BDI and Capesize demand
    iron += 0.012 * (bdi - 1400) + iron_noise
    iron = np.clip(iron, 45, 220)

    # --- Coal price (Australia FOB) ---
    coal = 85 + 8*years + 18*np.sin(2*np.pi*t/(365.25*2.2)) + 10*np.sin(2*np.pi*t/365.25)
    coal_noise = rng.normal(0, 5, n)
    coal += 0.008 * (bdi - 1400) + 0.15*(brent - 68) + coal_noise
    coal = np.clip(coal, 40, 250)

    # --- Demand & Supply indicators (0-1) ---
    demand = 0.55 + 0.15*np.sin(2*np.pi*t/365.25 + 0.3) + 0.08*np.sin(2*np.pi*t/(365.25*3))
    demand += rng.normal(0, 0.06, n)
    # monsoon dip Jun-Sep
    for i, d in enumerate(dates):
        m = pd.Timestamp(d).month
        if m in [6,7,8,9]:
            demand[i] -= 0.08
    demand = np.clip(demand, 0.2, 0.95)

    supply = 0.5 + 0.12*np.sin(2*np.pi*t/365.25 + 2.1) + rng.normal(0, 0.05, n)
    supply = np.clip(supply, 0.25, 0.9)

    # --- Port congestion (0-1) ---
    congestion = 0.4 + 0.15*np.sin(2*np.pi*t/365.25 + 1.0) + rng.normal(0, 0.08, n)
    # correlate with demand
    congestion += 0.12*(demand - 0.55)
    congestion = np.clip(congestion, 0.05, 0.95)

    return {
        "bdi_proxy": bdi,
        "brent_proxy": brent,
        "iron_ore_price": iron,
        "coal_price": coal,
        "demand_indicator": demand,
        "supply_indicator": supply,
        "port_congestion": congestion,
    }

def generate_for_route(origin, dest, vessel, dates, extern, rng, route_idx):
    info_o = ORIGINS[origin]
    info_v = VESSELS[vessel]
    nm = info_o["distance_nm"]
    cargo = info_o["cargo"]

    # base per-ton rate
    base = info_v["base_rate_usd"] * (0.7 + 0.3*distance_factor(nm)) * CARGO_MULT[cargo]
    # Adjust for port draft constraint penalty (shallow port -> higher rate due to inefficiency)
    # Not needed as filter later, just slight premium for Haldia-like constraints
    base_adj = base

    n = len(dates)
    t = np.arange(n)

    # Systematic components shared + route-specific phase
    phase = (route_idx * 37) % 365  # route-specific seasonality phase shift
    trend = 1 + 0.02 * (t/365.25) + 0.10*np.sin(2*np.pi*t/(365.25*3) + route_idx*0.4)
    seasonality = 1 + 0.12*np.sin(2*np.pi*(t-phase)/365.25) + 0.05*np.sin(4*np.pi*t/365.25)
    # monsoon: longer routes from Australia/Indonesia more affected
    monsoon = np.ones(n)
    for i, d in enumerate(dates):
        if pd.Timestamp(d).month in [6,7,8,9]:
            monsoon[i] = 0.96 if nm > 4000 else 0.93

    # External influence: BDI and fuel
    # Normalize extern series
    bdi_norm = (extern["bdi_proxy"] - 1400) / 800  # ~ [-1,3]
    fuel_norm = (extern["brent_proxy"] - 68) / 30
    demand_norm = extern["demand_indicator"] - 0.55
    supply_norm = extern["supply_indicator"] - 0.55

    extern_factor = 1 + 0.18*bdi_norm + 0.08*fuel_norm + 0.06*demand_norm - 0.04*supply_norm
    extern_factor = np.clip(extern_factor, 0.65, 1.65)

    # Heteroskedastic noise: volatility higher when BDI high
    vol = 0.06 + 0.04 * np.clip((extern["bdi_proxy"]/2000), 0.5, 1.8) + 0.02*extern["port_congestion"]
    # route-specific persistence
    route_noise = rng.normal(0, 1, n)
    # add autocorrelation (AR1 phi=0.6)
    ar_noise = np.zeros(n)
    ar_noise[0] = route_noise[0] * vol[0]
    for i in range(1, n):
        ar_noise[i] = 0.6*ar_noise[i-1] + route_noise[i]*vol[i]
    # small vessel more volatile
    if vessel in ["Handysize", "Supramax"]:
        ar_noise *= 1.12

    freight = base_adj * trend * seasonality * monsoon * extern_factor * np.exp(ar_noise * 0.5)
    # clip to reasonable bounds
    freight = np.clip(freight, base_adj*0.55, base_adj*1.95)

    # Route-specific iron ore / coal price slight variation (±3%)
    iron = extern["iron_ore_price"] * (1 + rng.normal(0, 0.015, n))
    coal = extern["coal_price"] * (1 + rng.normal(0, 0.015, n))

    # Voyage duration: distance / speed (12-14 knots avg) + port days
    speed_knots = {"Handysize": 12.5, "Supramax": 13.0, "Panamax": 13.5, "Capesize": 14.0}[vessel]
    voyage_days = nm / (speed_knots*24) + rng.uniform(1.5, 4.0, n)  # sea + port time
    route_distance = np.full(n, nm)

    df = pd.DataFrame({
        "date": dates,
        "origin": origin,
        "destination": dest,
        "trade_lane": origin + "_to_" + dest,
        "vessel_type": vessel,
        "cargo_type": cargo,
        "cargo_quantity_t": np.where(
            np.array([info_v["dwt"]]*n) > 80000, 
            rng.integers(70000, 170000, n), 
            rng.integers(15000, 55000, n)
        ),
        "route_distance_nm": route_distance,
        "voyage_duration_days": np.round(voyage_days, 2),
        "freight_rate_usd_per_ton": np.round(freight, 3),
        "bdi_proxy": np.round(extern["bdi_proxy"], 1),
        "brent_proxy_usd": np.round(extern["brent_proxy"], 2),
        "iron_ore_price_usd": np.round(iron, 2),
        "coal_price_usd": np.round(coal, 2),
        "demand_indicator": np.round(extern["demand_indicator"] + rng.normal(0,0.02,n), 3),
        "supply_indicator": np.round(extern["supply_indicator"] + rng.normal(0,0.02,n), 3),
        "port_congestion_index": np.round(np.clip(extern["port_congestion"] + rng.normal(0,0.03,n),0.05,0.95),3),
        "month": pd.to_datetime(dates).month,
        "season": pd.to_datetime(dates).month.map(lambda m: {12: "Winter",1:"Winter",2:"Winter",3:"Spring",4:"Spring",5:"Spring",6:"Monsoon",7:"Monsoon",8:"Monsoon",9:"Monsoon",10:"Autumn",11:"Autumn"}[m]),
        "data_source": "synthetic",
    })
    # clip indicators after noise
    df["demand_indicator"] = df["demand_indicator"].clip(0.1, 0.99)
    df["supply_indicator"] = df["supply_indicator"].clip(0.1, 0.99)
    return df

def main(start="2018-01-01", end="2025-12-31", out_path="data/synthetic/freight_rates_synthetic.csv"):
    rng = np.random.default_rng(SEED)
    dates = pd.date_range(start, end, freq="D")
    extern = generate_external_series(dates, rng)
    # Use separate RNG stream for route noise to keep extern deterministic
    route_rng = np.random.default_rng(SEED+1)

    all_dfs = []
    idx = 0
    for origin in ORIGINS:
        for dest in DESTINATIONS:
            for vessel in VESSELS:
                df = generate_for_route(origin, dest, vessel, dates, extern, np.random.default_rng(SEED+100+idx), idx)
                all_dfs.append(df)
                idx += 1

    df_full = pd.concat(all_dfs, ignore_index=True)
    df_full = df_full.sort_values(["date","trade_lane","vessel_type"]).reset_index(drop=True)

    # Add generation metadata header via separate json sidecar
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    df_full.to_csv(out, index=False)
    # metadata
    meta = Path(str(out).replace(".csv","_metadata.json"))
    import json, datetime
    meta.write_text(json.dumps({
        "data_source": "synthetic",
        "seed": SEED,
        "generated_at": datetime.datetime.utcnow().isoformat()+"Z",
        "date_range": [start, end],
        "rows": len(df_full),
        "columns": list(df_full.columns),
        "origins": list(ORIGINS.keys()),
        "destinations": list(DESTINATIONS.keys()),
        "vessel_types": list(VESSELS.keys()),
        "assumptions": "See file header docstring",
        "warning": "NOT real freight data — for pipeline development only"
    }, indent=2))
    print(f"Generated {len(df_full)} rows -> {out}")
    print(f"Metadata -> {meta}")
    print(df_full.head(3).to_string())
    print(df_full.describe().round(2).to_string())

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", default="2018-01-01")
    parser.add_argument("--end", default="2025-12-31")
    parser.add_argument("--out", default="data/synthetic/freight_rates_synthetic.csv")
    args = parser.parse_args()
    main(args.start, args.end, args.out)
