"""Idle/deadheading insight from capacity utilization (no fake telemetry)."""
from __future__ import annotations

from app.services import reference_data as ref


def describe(
    recommended: str | None, cargo_quantity_t: float, feasible_ranked: list[dict]
) -> dict[str, str | float | None]:
    if recommended is None:
        return {
            "insight": "No feasible vessel: any charter would deadhead or "
                       "require transshipment/lighterage.",
            "utilization": None,
        }
    typical = {"Handysize": 28000, "Supramax": 58000,
               "Panamax": 75000, "Capesize": 175000}
    dwt = typical.get(recommended, 58000)
    util = float(cargo_quantity_t) / dwt
    if util > 0.98:
        text = (f"{recommended} at {util:.0%} of typical DWT: tight fit, "
                "minimal idle but loading/trim risk.")
    elif util >= 0.75:
        text = (f"{recommended} at {util:.0%} of typical DWT: efficient band, "
                "low idle/deadheading exposure.")
    elif util >= 0.5:
        text = (f"{recommended} at {util:.0%} of typical DWT: moderate "
                "underutilization; part-load or backhaul opportunity reduces "
                "deadheading.")
    else:
        text = (f"{recommended} at {util:.0%} of typical DWT: high "
                "underutilization; consider smaller class or split parcel to "
                "avoid deadheading penalty.")
    return {"insight": text, "utilization": round(util, 4)}
