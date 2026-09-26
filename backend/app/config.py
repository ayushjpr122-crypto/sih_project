"""Centralized configuration. Only source of env vars (12-factor).

Reads environment variables with safe defaults for hackathon prototype.
No secrets hardcoded.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]  # backend/
REPO_ROOT = BACKEND_DIR.parent  # sih/


def _csv_env(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [o.strip() for o in raw.split(",") if o.strip()]


@dataclass
class Settings:
    app_name: str = "SIH26006 Freight Forecasting API"
    # Prototype uses synthetic/domain-informed data for demonstration.
    data_disclosure: str = (
        "Prototype uses synthetic/domain-informed data for demonstration. "
        "Production deployment requires validated historical freight, vessel, "
        "port, procurement, and voyage datasets."
    )
    database_url: str = field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL", f"sqlite:///{(BACKEND_DIR / 'data' / 'app.db').as_posix()}"
        )
    )
    cors_origins: list[str] = field(
        default_factory=lambda: _csv_env(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,"
            "http://localhost:5173,http://127.0.0.1:5173",
        )
    )
    log_level: str = field(default_factory=lambda: os.getenv("LOG_LEVEL", "INFO"))
    # Absolute paths into the existing ML project (reuse, never duplicate).
    repo_root: Path = REPO_ROOT
    ports_csv: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "PORTS_CSV",
                str(REPO_ROOT / "data" / "ports" / "east_coast_india_ports.csv"),
            )
        )
    )
    vessels_csv: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "VESSELS_CSV",
                str(REPO_ROOT / "data" / "vessels" / "vessel_classes.csv"),
            )
        )
    )
    model_selection_json: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "MODEL_SELECTION_JSON",
                str(REPO_ROOT / "models" / "final" / "model_selection.json"),
            )
        )
    )
    best_model_json: Path = field(
        default_factory=lambda: Path(
            os.getenv(
                "BEST_MODEL_JSON",
                str(REPO_ROOT / "models" / "final" / "best_model_by_horizon.json"),
            )
        )
    )


settings = Settings()
