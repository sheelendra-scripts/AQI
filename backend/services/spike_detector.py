"""Spike Detection Service.

Implements Z-score based pollution spike detection replicating the logic
from the hackdata research pipeline (hackdata backend/main.py).

A reading is classified as a spike event if its PM2.5 value deviates
more than `threshold` standard deviations from the rolling mean.

Usage:
    from services.spike_detector import detect_spike

    result = detect_spike(current_pm25=377, history=[180, 195, 200, ...])
    # {"is_spike": True, "z_score": 2.54, "mean": 180.3, "std": 77.4,
    #  "severity": "high", "threshold_used": 2.0}
"""

from __future__ import annotations

import math
import logging
from typing import List, Optional

logger = logging.getLogger("aqms.spike_detector")

# Standard deviations above mean that defines a spike
DEFAULT_THRESHOLD = 2.0


def _mean_std(values: List[float]) -> tuple[float, float]:
    """Return (mean, std) for a list of values."""
    n = len(values)
    if n == 0:
        return 0.0, 1.0
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / n
    return mean, max(math.sqrt(variance), 0.1)


def detect_spike(
    current_pm25: float,
    history: List[float],
    threshold: float = DEFAULT_THRESHOLD,
) -> dict:
    """Classify whether the current PM2.5 reading is a spike event.

    Args:
        current_pm25: Current hourly PM2.5 reading (µg/m³).
        history: Recent historical PM2.5 values used to establish baseline.
                 Recommended: last 24–168 readings.
        threshold: Z-score threshold above which a reading is a spike.

    Returns:
        dict with:
            is_spike     — bool
            z_score      — standardised deviation from mean
            mean         — historical mean PM2.5
            std          — historical standard deviation
            severity     — "low" / "medium" / "high" / "extreme"
            threshold_used
    """
    if len(history) < 3:
        # Not enough history to compute a reliable baseline
        return {
            "is_spike": False,
            "z_score": 0.0,
            "mean": float(current_pm25),
            "std": 1.0,
            "severity": "unknown",
            "threshold_used": threshold,
            "note": "Insufficient history for spike detection",
        }

    mean, std = _mean_std(history)
    z = (current_pm25 - mean) / std

    is_spike = z > threshold

    if z <= 1.5:
        severity = "normal"
    elif z <= 2.0:
        severity = "low"
    elif z <= 3.0:
        severity = "medium"
    elif z <= 4.0:
        severity = "high"
    else:
        severity = "extreme"

    return {
        "is_spike": is_spike,
        "z_score": round(z, 3),
        "mean": round(mean, 2),
        "std": round(std, 2),
        "severity": severity,
        "threshold_used": threshold,
    }


def detect_spike_from_readings(
    current: dict,
    history_readings: List[dict],
    threshold: float = DEFAULT_THRESHOLD,
) -> dict:
    """Convenience wrapper that extracts pm25 from reading dicts.

    Args:
        current: Current reading dict (must have 'pm25' key).
        history_readings: List of historical reading dicts with 'pm25'.
        threshold: Z-score threshold.

    Returns:
        Same shape as detect_spike().
    """
    try:
        current_pm25 = float(current.get("pm25") or 0.0)
        history_pm25 = [
            float(r.get("pm25") or 0.0)
            for r in history_readings
            if r.get("pm25") is not None
        ]
    except (TypeError, ValueError) as exc:
        logger.warning(f"Spike detector value error: {exc}")
        return {"is_spike": False, "z_score": 0.0, "severity": "unknown", "threshold_used": threshold}

    return detect_spike(current_pm25, history_pm25, threshold)
