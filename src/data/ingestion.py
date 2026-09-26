"""
Ingestion stubs — placeholder for future real public proxy ingestion (FRED, World Bank).
Currently synthetic data is used; this module documents how to replace with real data.
"""
import pandas as pd

def fetch_fred_series(series_id: str, api_key: str = None) -> pd.DataFrame:
    """Fetch FRED series (e.g., BDIY, DCOILBRENTEU). Requires FRED_API_KEY."""
    raise NotImplementedError("Implement with fredapi or requests to https://api.stlouisfed.org/fred/series/observations")
    # Example:
    # from fredapi import Fred
    # fred = Fred(api_key=api_key)
    # s = fred.get_series(series_id, start_date="2018-01-01")
    # return s.reset_index().rename(columns={"index":"date", series_id:"value"})

def fetch_worldbank_commodity() -> pd.DataFrame:
    raise NotImplementedError("Use World Bank Commodity Pink Sheet CSV: https://www.worldbank.org/en/research/commodity-markets")

def ingest_real_data() -> pd.DataFrame:
    """
    Future pipeline: merge FRED BDI + EIA Brent + WB iron/coal onto calendar.
    Returns DataFrame with columns: date, bdi_proxy, brent_proxy_usd, iron_ore_price_usd, coal_price_usd
    """
    raise NotImplementedError("No free route-vessel freight available; use synthetic until paid source obtained")
