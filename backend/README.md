# SIH26006 — Backend (FastAPI)

Intelligent freight forecasting for optimized vessel chartering and bulk cargo
procurement (overseas → East Coast of India). Problem ID **SIH26006**.

> **Data disclosure:** Prototype uses synthetic/domain-informed data for
> demonstration. Production deployment requires validated historical freight,
> vessel, port, procurement, and voyage datasets. Never present prototype
> values as actual SAIL operational data.

## What this backend does

- Serves the **actual trained ML models** (`models/final/xgboost_{7,14,30}d.joblib`,
  selected data-driven via `model_selection.json`) — no hardcoded forecasts.
- Hybrid charter decision: **deterministic hard constraints first**
  (draft / LOA / beam / capacity / cargo compatibility / port limits), then
  **ML-hybrid ranking** via the existing `src/models/vessel_model.py`.
- Explainable risk via existing `src/models/risk_model.py`, timing labels
  consistent with `src/models/timing_model.py` thresholds.
- Persists scenarios / forecasts / vessel evaluations / decisions with
  timestamps (PostgreSQL-compatible SQLAlchemy; SQLite fallback for prototype).
- **No duplication:** datasets, trained models, feature engineering, and
  inference logic live in the existing ML project and are reused through
  `app/ml/adapter.py`.

## Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# Linux/macOS:
# source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # adjust if needed
```

Prerequisites: the ML artifacts must exist (they do in this repo):
`models/final/xgboost_{7,14,30}d.joblib`,
`models/final/{model_selection,best_model_by_horizon}.json`,
`data/processed/ml_dataset.parquet`,
`data/ports/east_coast_india_ports.csv`,
`data/vessels/vessel_classes.csv`.

## Environment variables

| Var | Default | Purpose |
|-----|---------|---------|
| `DATABASE_URL` | `sqlite:///./data/app.db` | PostgreSQL URL for prod, e.g. `postgresql+psycopg2://user:pw@host:5432/sih26006` |
| `CORS_ORIGINS` | `http://localhost:3000,...,http://localhost:5173,...` | Allowed React dev origins |
| `LOG_LEVEL` | `INFO` | Logging verbosity |
| `PORTS_CSV` / `VESSELS_CSV` / `MODEL_SELECTION_JSON` / `BEST_MODEL_JSON` | repo paths | Override reference/model artifact locations |

See `.env.example`.

## Database setup

No migration step needed for the prototype: tables (`scenarios`, `forecasts`,
`vessel_evaluations`, `decisions`) are created on startup. The SQLite file
lives at `backend/data/app.db`. Point `DATABASE_URL` at PostgreSQL for
production (same models work unchanged). Large ML datasets stay as
files/artifacts — only decision-level records are stored.

## Running the server

```bash
cd backend
uvicorn app.main:app --port 8000 --reload
```

- Swagger UI: http://127.0.0.1:8000/docs
- Health: `GET /api/v1/health`

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Service health + data disclosure |
| GET | `/api/v1/ports` | East-coast ports with draft/LOA/beam limits |
| GET | `/api/v1/vessels` | Vessel classes with dimensions/capacity |
| GET | `/api/v1/models` | Trained-model selection per horizon + metrics |
| GET | `/api/v1/demo-scenario` | Example `POST /decision` body |
| POST | `/api/v1/decision` | **Charter decision** (scenario → forecast → vessels → timing/risk) |

Accepted aliases: origins `Australia/Indonesia/South Africa/Brazil`
(→ `*_Hedland/Banjarmasin/RichardsBay/Tubarao`), cargo
`Coking Coal→Coal`, `Iron Ore→Iron_Ore`, `Grains`, contracts
`SPOT/MEDIUM_TERM/LONG_TERM` (`"Medium-term"` accepted).

Errors: `400` invalid scenario · `404` unknown port/vessel ·
`422` validation error · `500` internal model/inference error (sanitized,
no stack traces).

## Example request (curl)

```bash
curl -X POST http://127.0.0.1:8000/api/v1/decision \
  -H "Content-Type: application/json" \
  -d '{"cargo_type":"Coking Coal","cargo_quantity_t":75000, \
       "origin":"Australia","destination":"Paradip", \
       "horizon_days":30,"contract_type":"Medium-term"}'
```

## Example response (abridged, live values vary)

```json
{
  "scenario_summary": "75,000t Coking Coal from Australia to Paradip (MEDIUM_TERM, 30d horizon)",
  "current_freight_usd_per_ton": 16.409,
  "forecast": {"h7_usd_per_ton": 16.26, "h14_usd_per_ton": 17.05,
               "h30_usd_per_ton": 17.58,
               "models": {"7": "xgboost_7d", "14": "xgboost_14d", "30": "xgboost_30d"}},
  "forecast_trend": "RISING",
  "forecast_uncertainty_proxy": {"rolling_std_7_usd_per_ton": 1.01},
  "feasible_vessels": [{"vessel_class": "Panamax", "composite_score": 5.982,
                        "utilization": 1.0, "total_cost_usd": 1280706.48}],
  "infeasible_vessels": [
    {"vessel_class": "Handysize", "reason": "Cargo 75,000t exceeds Handysize usable capacity (34,300t @98% DWT)"},
    {"vessel_class": "Supramax", "reason": "Cargo 75,000t exceeds Supramax usable capacity (58,800t @98% DWT)"},
    {"vessel_class": "Capesize", "reason": "Draft 17.5m exceeds Paradip max 14.5m"}],
  "recommended_vessel": "Panamax",
  "charter_timing": "BUY_NOW",
  "risk": "LOW",
  "idle_insight": "Panamax at 100% of typical DWT: tight fit, minimal idle but loading/trim risk.",
  "recommendation": "Scenario: 75,000t Coking Coal Australia -> Paradip ...",
  "scenario_id": 1,
  "decision_id": 1
}
```

## Testing

```bash
cd backend
python -m pytest tests -q
```

20 tests: health/ports/vessels/models/demo-scenario, validation
(422/404/400), forecast service (real XGBoost), vessel feasibility gates,
decision engine shape, full `/decision` contract + DB persistence.

## Structure

```
backend/
├── app/
│   ├── main.py            # app factory, /api/v1, CORS, error handlers
│   ├── config.py          # env-only config (no hardcoded secrets)
│   ├── api/routes/        # health, ports, vessels, models, scenario, decision
│   ├── schemas/           # Pydantic v2 request/response validation
│   ├── services/          # forecast/vessel/timing/risk/idle + decision_engine
│   ├── ml/adapter.py      # ONLY bridge to existing src/models + artifacts
│   ├── db/                # SQLAlchemy models + repository (scenarios, forecasts,
│   │                      # vessel_evaluations, decisions, timestamps)
│   └── core/              # errors (400/404/422/500, no stack leaks), logging
├── tests/                 # pytest suite (20 tests)
├── requirements.txt
├── pytest.ini
├── .env.example
└── README.md
```
