# SIH26006 — Freight Intelligence Prototype Frontend

React + TypeScript + Vite + Tailwind CSS + Recharts dashboard for the
FastAPI decision engine. **Prototype only — synthetic/domain-informed data.**

> Never present prototype numbers as actual SAIL operational data.

## Run

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
```

Backend must be running first:

```bash
cd backend
uvicorn app.main:app --port 8000 --reload
```

Optional: `cp .env.example .env` to override `VITE_API_BASE_URL`
(default `http://127.0.0.1:8000/api/v1`).

## Demo flow

1. Open dashboard → header shows backend status from `GET /health`.
2. Click **Load Demo Scenario** (`GET /demo-scenario`).
3. Click **Analyze Scenario** (`POST /decision`).
4. Forecast → vessels → timing → risk → final decision render from the real response.

## Build

```bash
npm run build
npm run preview
```
