# Dataset Design — SIH26006

## Schema (synthetic, data_source=synthetic)
| Column | Type | Description |
|--------|------|-------------|
| date | date | Daily |
| origin | cat | Australia_Hedland, Indonesia_Banjarmasin, SouthAfrica_RichardsBay, Brazil_Tubarao |
| destination | cat | Paradip, Visakhapatnam, Gangavaram, Dhamra |
| trade_lane | cat | origin_to_destination |
| vessel_type | cat | Handysize, Supramax, Panamax, Capesize |
| cargo_type | cat | Iron_Ore / Coal |
| cargo_quantity_t | int | Synthetic cargo lot |
| route_distance_nm | int | Great-circle proxy |
| voyage_duration_days | float | distance/speed + port days |
| freight_rate_usd_per_ton | float | TARGET current |
| bdi_proxy | float | Baltic Dry Index proxy |
| brent_proxy_usd | float | Fuel proxy |
| iron_ore_price_usd, coal_price_usd | float | Commodity proxies |
| demand_indicator, supply_indicator | float 0-1 | Synthetic market tightness |
| port_congestion_index 0-1 | float | Synthetic congestion |
| month, season, day_of_year etc. | int/cat | Time features engineered later |

## Engineered Features (no leakage, shift 1)
- lags: lag_1, lag_7, lag_14, lag_30
- rolling_mean_7/14/30, rolling_std_7/30 (window shifted 1)
- pct_change_1 (shifted), momentum_7/30
- bdi/brent lags and rolling means
- cyclic encodings: month_sin/cos, doy_sin/cos, dow_sin/cos
- monsoon/winter flags

Feature count: 41 numeric final (see dataset_metadata.json).

## Targets
- target_freight_7d/14d/30d = future freight shifted -h
- target_return_h = (target - current)/current
- timing_label_h = BUY_NOW (>5%), WAIT (<-3%), WATCH else (mathematically defined)
- risk_label = LOW/MEDIUM/HIGH by rolling_std_30 quantiles per group (33/66 pct)

## Split
Chronological 70/15/15, no shuffle:
- Train 2018-01-31 to 2023-07-27 (128,217)
- Val   2023-07-27 to 2024-09-28 (27,475)
- Test  2024-09-28 to 2025-12-01 (27,476)
Total after warmup 183,168.

## Provenance
See data_sources.md. Synthetic generator seed 42, assumptions in generate_synthetic_data.py header.
