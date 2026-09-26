# SIH26006 Data Directory — Freight Forecasting for East Coast India

## Structure
```
data/
├── raw/            # Raw pulls from public sources (if any) — currently empty; see docs/data_sources.md
├── processed/      # Processed ML-ready datasets (parquet/csv)
├── synthetic/      # Synthetic time-series (clearly labeled data_source=synthetic)
├── ports/          # Port physical constraints
├── vessels/        # Vessel class specifications
└── README.md
```

## Data Provenance Principle
- **Never fabricate real data**. All real/public/proxy/synthetic labeled explicitly.
- Route-specific freight rates are **not publicly available free** at required granularity → synthetic generator used with realistic distributions.
- Public proxies identified: Baltic Dry Index (BDI), FRED commodity/bunker proxies, World Bank commodity prices.

## Files
| File | Description | Source Type |
|------|-------------|-------------|
| `ports/east_coast_india_ports.csv` | East coast port constraints | proxy_representative |
| `vessels/vessel_classes.csv` | Vessel class specs | representative_range |
| `synthetic/freight_rates_synthetic.csv` | Daily freight proxy per route/vessel | synthetic |
| `processed/ml_dataset.parquet` | Feature-engineered ML dataset | synthetic-derived |

## Reproducibility
- Synthetic generator seed = 42 (see `src/data/generate_synthetic_data.py`)
- All feature engineering uses same pipeline for train/val/test/inference (no leakage)
- Chronological split 70/15/15

## Limitations
See `docs/limitations.md` and `docs/data_sources.md` for full provenance and limitations.
