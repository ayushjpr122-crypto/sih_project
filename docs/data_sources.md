# Data Sources & Provenance — SIH26006

> Ministry of Steel — Intelligent Freight Forecasting for Vessel Chartering to East Coast India
>
> **Prototype uses synthetic/domain-informed data for demonstration. Production deployment requires validated historical freight, vessel, port, procurement, and voyage datasets. No synthetic metric is claimed as real SAIL data.**

## 1. Summary
| Dataset | Source | URL | Date Range | Variables | Frequency | License/Access | Type | Limitations |
|---------|--------|-----|------------|-----------|-----------|----------------|------|-------------|
| Baltic Dry Index (proxy for freight rates) | FRED / Quandl / Investing — Federal Reserve Economic Data (BDIY) | https://fred.stlouisfed.org/series/BDIY ; https://www.balticexchange.com/en/data-services/indices.html | 1985-present (public series) | BDI index value (overall dry bulk proxy) | Daily | Public (free via FRED); Baltic Exchange subscription for route-level | **Public proxy** | BDI is composite; not route/vessel specific; used as trend/seasonality proxy, not as claimed real rate |
| Brent Crude / Bunker proxy | U.S. EIA / FRED (DCOILBRENTEU) | https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm ; https://fred.stlouisfed.org/series/DCOILBRENTEU | 1987-present | Crude oil price USD/bbl (fuel cost proxy) | Daily/Weekly | Public | Not VLSFO/MGO exact bunker price; proxy for fuel cost hypothesis |
| Iron Ore & Coal Commodity Prices | World Bank Commodity Price Data (Pink Sheet) + FRED (PIORECRUSDM etc.) | https://www.worldbank.org/en/research/commodity-markets ; https://fred.stlouisfed.org/series/PIORECRUSDM | 1960-present monthly / daily proxies | Iron ore 62% CFR, Coal Australia | Monthly (WB), daily proxy via FRED | Public (CC BY 4.0 WB) | Monthly granularity mismatch; use daily interpolation |
| FX / Economic indicators | FRED / World Bank WDI | https://fred.stlouisfed.org ; https://databank.worldbank.org | 2000-present | USD/INR, India IIP proxy | Daily/Monthly | Public | Low direct correlation; included as optional external regressor |
| Port characteristics | Port authorities (Paradip, Vizag, Gangavaram, Dhamra) + IPA | https://paradipport.gov.in ; https://vizagport.com ; https://ipa.nic.in | Static (verified Dec 2024) | max_draft, LOA, beam, capacity | Static | Public web | Values vary by berth/tide; we publish representative max; marked proxy_representative |
| Vessel characteristics | Clarksons Research, UNCTAD, BIMCO | https://www.clarksons.net ; https://unctad.org/topic/transport/review-of-maritime-transport | Static class ranges | DWT, draft, LOA, beam | Static | Public summaries free; detailed Clarksons subscription | Representative ranges not single vessel spec |
| Route distances | Searoutes / Ports.com great-circle proxy | https://ports.com/sea-route/ ; https://sea-distances.org | Static | NM distance East Coast India origins | Static | Public lookup | Great-circle underestimates real voyage; used as feature proxy |
| **Synthetic freight rates (THIS PROJECT)** | Generated via `src/data/generate_synthetic_data.py` (seed 42) | — | 2018-01-01 to 2025-12-31 daily | freight_rate_USD_per_ton + all features above with synthetic seasonality/trend/volatility/correlations | Daily | Synthetic (MIT-like internal) | **Clearly labeled data_source=synthetic**; NOT real market data; for pipeline dev/demo only; performance NOT real-world accuracy |

## 2. Why Synthetic?
- Route-vessel-specific spot freight (e.g., Australia–Paradip Panamax coking coal rate) is **proprietary**: Baltic Exchange, Clarksons, Platts charge subscriptions ($10k+/year) and forbid redistribution.
- No free public dataset provides daily freight by trade lane + vessel class at required granularity (confirmed via search of FRED, World Bank, UNCTAD, data.gov.in, Kaggle).
- Therefore: use **public proxies (BDI etc.) for trend/seasonality shape** + **synthetic generator** that simulates correlation, seasonality, volatility for ML pipeline development.
- Generator assumptions documented in `src/data/generate_synthetic_data.py` and `docs/dataset.md`.

## 3. Provenance Handling in Code
- Every record has `data_source` column: `synthetic` or `public_proxy` or `real` (future).
- Synthetic file header contains generation metadata: seed, date, assumptions.
- No synthetic performance reported as real-world accuracy (see `docs/evaluation.md`).

## 4. Access Instructions (for real data extension)
1. FRED API: `https://fred.stlouisfed.org/docs/api/fred/` with `FRED_API_KEY`
2. World Bank: `https://api.worldbank.org/v2/country/IND/indicator/...`
3. Baltic Exchange (paid): contact `https://www.balticexchange.com`
4. Replace synthetic generator with real ingestion in `src/data/ingestion.py` (stub provided).
