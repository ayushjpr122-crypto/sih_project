"""Reference data: ports, vessels, alias normalization.

CSVs are project data files (kept as files, not DB, per prototype scope).
Loaded once and cached.
"""
from __future__ import annotations

from functools import lru_cache

import pandas as pd

from app.config import settings
from app.core.errors import NotFoundError, ScenarioError

VALID_VESSELS = ["Handysize", "Supramax", "Panamax", "Capesize"]
VALID_HORIZONS = [7, 14, 30]
VALID_CONTRACTS = ["SPOT", "MEDIUM_TERM", "LONG_TERM"]

# User-facing origin aliases -> canonical synthetic origin keys.
ORIGIN_ALIASES = {
    "australia": "Australia_Hedland",
    "australia_hedland": "Australia_Hedland",
    "hedland": "Australia_Hedland",
    "indonesia": "Indonesia_Banjarmasin",
    "indonesia_banjarmasin": "Indonesia_Banjarmasin",
    "banjarmasin": "Indonesia_Banjarmasin",
    "south africa": "SouthAfrica_RichardsBay",
    "south_africa": "SouthAfrica_RichardsBay",
    "southafrica_richardsbay": "SouthAfrica_RichardsBay",
    "richards bay": "SouthAfrica_RichardsBay",
    "richardsbay": "SouthAfrica_RichardsBay",
    "brazil": "Brazil_Tubarao",
    "brazil_tubarao": "Brazil_Tubarao",
    "tubarao": "Brazil_Tubarao",
}

# Cargo aliases -> canonical cargo keys used by the ML dataset.
CARGO_ALIASES = {
    "coking coal": "Coal",
    "coking_coal": "Coal",
    "coal": "Coal",
    "thermal coal": "Coal",
    "iron ore": "Iron_Ore",
    "iron_ore": "Iron_Ore",
    "iron ore fines": "Iron_Ore",
    "grains": "Grains",
    "grain": "Grains",
}

CONTRACT_ALIASES = {
    "spot": "SPOT",
    "medium-term": "MEDIUM_TERM",
    "medium term": "MEDIUM_TERM",
    "medium_term": "MEDIUM_TERM",
    "long-term": "LONG_TERM",
    "long term": "LONG_TERM",
    "long_term": "LONG_TERM",
}


@lru_cache(maxsize=1)
def load_ports_df() -> pd.DataFrame:
    try:
        return pd.read_csv(settings.ports_csv)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"ports reference data unreadable: {exc}") from exc


@lru_cache(maxsize=1)
def load_vessels_df() -> pd.DataFrame:
    try:
        return pd.read_csv(settings.vessels_csv)
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(f"vessels reference data unreadable: {exc}") from exc


def normalize_origin(raw: str) -> str:
    key = raw.strip().lower()
    if key in ORIGIN_ALIASES:
        return ORIGIN_ALIASES[key]
    # Already canonical (case-insensitive)?
    for canonical in set(ORIGIN_ALIASES.values()):
        if key == canonical.lower():
            return canonical
    raise ScenarioError(
        f"Unknown origin '{raw}'. Known origins: Australia, Indonesia, "
        "South Africa, Brazil."
    )


def normalize_cargo(raw: str) -> str:
    key = raw.strip().lower()
    if key in CARGO_ALIASES:
        return CARGO_ALIASES[key]
    raise ScenarioError(
        f"Unknown cargo type '{raw}'. Supported: Coking Coal, Iron Ore, Grains."
    )


def normalize_contract(raw: str) -> str:
    key = raw.strip().lower()
    if key in CONTRACT_ALIASES:
        return CONTRACT_ALIASES[key]
    raise ScenarioError(
        f"Unknown contract type '{raw}'. Use SPOT, MEDIUM_TERM, or LONG_TERM."
    )


def normalize_destination(raw: str) -> str:
    """Destination must exist in ports CSV (case-insensitive). Else 404."""
    ports = load_ports_df()
    want = raw.strip().lower()
    for name in ports["port_name"].tolist():
        if str(name).lower() == want:
            return str(name)
    raise NotFoundError(
        f"Unknown destination port '{raw}'. See GET /api/v1/ports."
    )


def normalize_vessel(raw: str) -> str:
    for v in VALID_VESSELS:
        if raw.strip().lower() == v.lower():
            return v
    raise NotFoundError(
        f"Unknown vessel class '{raw}'. Valid: {', '.join(VALID_VESSELS)}."
    )


def vessel_row(vessel_class: str) -> dict:
    df = load_vessels_df()
    hit = df[df["vessel_class"] == vessel_class]
    if hit.empty:  # pragma: no cover
        raise NotFoundError(f"Unknown vessel class '{vessel_class}'.")
    return hit.iloc[0].to_dict()


def port_row(port_name: str) -> dict:
    df = load_ports_df()
    hit = df[df["port_name"] == port_name]
    if hit.empty:  # pragma: no cover
        raise NotFoundError(f"Unknown port '{port_name}'.")
    return hit.iloc[0].to_dict()
