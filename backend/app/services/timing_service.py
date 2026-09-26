"""Timing service: BUY_NOW / WAIT / WATCH from forecast-vs-current return.

Thresholds mirror the trained timing_model definition
(ret > +5% => BUY_NOW, ret < -3% => WAIT, else WATCH) so the API stays
consistent with the ML labeling even though the live signal uses the
real forecast (no future leakage).
"""
from __future__ import annotations


def decide_timing(current: float | None, forecast_h: float | None) -> tuple[str, float | None, str]:
    if current is None or forecast_h is None or current <= 0:
        return "WATCH", None, "insufficient baseline; default WATCH"
    ret = (forecast_h - current) / current
    if ret > 0.05:
        return (
            "BUY_NOW",
            round(ret * 100, 2),
            f"forecast +{ret * 100:.1f}% vs current: rates rising, charter now",
        )
    if ret < -0.03:
        return (
            "WAIT",
            round(ret * 100, 2),
            f"forecast {ret * 100:.1f}% vs current: rates easing, defer charter",
        )
    return (
        "WATCH",
        round(ret * 100, 2),
        f"forecast {ret * 100:+.1f}% vs current: within noise band, monitor",
    )


def trend_label(current: float | None, f7: float | None, f30: float | None) -> str:
    if current is None or f7 is None or f30 is None or current <= 0:
        return "UNKNOWN"
    slope = (f30 - f7) / current
    if slope > 0.03:
        return "RISING"
    if slope < -0.03:
        return "FALLING"
    return "STABLE"
