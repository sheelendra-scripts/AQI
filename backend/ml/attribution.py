"""Bayesian-style source attribution for ward-level AQMS readings.

This module provides a lightweight probabilistic attribution engine suitable for
real-time demo usage. It combines pollutant fingerprints, temporal priors,
wind-consistency hints, and zone profile priors.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional, List

SOURCES = ["vehicular", "industrial", "biomass", "construction", "dust", "regional"]

ZONE_PRIORS = {
    "vehicle": {"vehicular": 0.34, "industrial": 0.12, "biomass": 0.10, "construction": 0.18, "dust": 0.16, "regional": 0.10},
    "industrial": {"vehicular": 0.16, "industrial": 0.38, "biomass": 0.08, "construction": 0.12, "dust": 0.10, "regional": 0.16},
    "construction": {"vehicular": 0.12, "industrial": 0.10, "biomass": 0.06, "construction": 0.40, "dust": 0.22, "regional": 0.10},
    "biomass": {"vehicular": 0.12, "industrial": 0.10, "biomass": 0.38, "construction": 0.10, "dust": 0.12, "regional": 0.18},
    "mixed": {"vehicular": 0.20, "industrial": 0.20, "biomass": 0.14, "construction": 0.18, "dust": 0.14, "regional": 0.14},
    "clean": {"vehicular": 0.12, "industrial": 0.08, "biomass": 0.08, "construction": 0.10, "dust": 0.10, "regional": 0.52},
}


def _normalize(scores: Dict[str, float]) -> Dict[str, float]:
    total = sum(max(0.0, v) for v in scores.values())
    if total <= 0:
        return {k: round(1.0 / len(scores), 3) for k in scores}
    return {k: round(max(0.0, v) / total, 3) for k, v in scores.items()}


def _hourly_pattern(hour: float) -> Dict[str, float]:
    h = float(hour)
    veh_peak = 1.0 if (7 <= h <= 11 or 17 <= h <= 22) else 0.6
    industrial_flat = 0.8
    biomass_evening = 1.0 if (18 <= h <= 23 or 4 <= h <= 7) else 0.6
    construction_day = 1.0 if (9 <= h <= 18) else 0.4
    dust_day = 0.9 if (10 <= h <= 17) else 0.6
    regional_flat = 0.7
    return {
        "vehicular": veh_peak,
        "industrial": industrial_flat,
        "biomass": biomass_evening,
        "construction": construction_day,
        "dust": dust_day,
        "regional": regional_flat,
    }


def _fingerprint_likelihood(reading: Dict[str, float]) -> Dict[str, float]:
    pm25 = float(reading.get("pm25", 0.0) or 0.0)
    co = float(reading.get("co", 0.0) or 0.0)
    no2 = float(reading.get("no2", 0.0) or 0.0)
    tvoc = float(reading.get("tvoc", 0.0) or 0.0)
    so2 = float(reading.get("so2", 0.0) or 0.0)

    pm_co = pm25 / max(co, 0.01)
    tvoc_no2 = tvoc / max(no2, 0.001)

    score = {s: 0.08 for s in SOURCES}

    if pm_co > 28 and no2 > 0.08:
        score["vehicular"] += 0.42
    if 2.0 <= co <= 6.0:
        score["vehicular"] += 0.10

    if no2 > 0.14 and co > 4.0:
        score["industrial"] += 0.36
    if so2 > 0.06:
        score["industrial"] += 0.18

    if co > 5.0 and tvoc > 0.75:
        score["biomass"] += 0.40
    if tvoc_no2 > 8:
        score["biomass"] += 0.08

    if pm25 > 180 and co < 3.5:
        score["construction"] += 0.33
    if tvoc > 0.9:
        score["construction"] += 0.08

    if pm25 > 220 and no2 < 0.07:
        score["dust"] += 0.33

    if pm25 > 120:
        score["regional"] += 0.12

    return _normalize(score)


def _apply_priors(
    likelihood: Dict[str, float],
    zone_profile: str,
    hour: float,
    wind_context: Optional[Dict],
) -> Dict[str, float]:
    prior = ZONE_PRIORS.get(zone_profile or "mixed", ZONE_PRIORS["mixed"])
    temporal = _hourly_pattern(hour)

    fused = {}
    for s in SOURCES:
        fused[s] = max(0.0001, likelihood.get(s, 0.0) * prior.get(s, 0.1) * temporal.get(s, 0.7))

    if wind_context:
        upwind = wind_context.get("upwind_sources", [])
        if upwind:
            src_boost = {}
            for item in upwind:
                src = item.get("source_detected")
                score = float(item.get("score", 0.0) or 0.0)
                if not src:
                    continue
                mapped = "vehicular" if src == "vehicle" else src
                if mapped not in SOURCES:
                    continue
                src_boost[mapped] = src_boost.get(mapped, 0.0) + score
            for s, v in src_boost.items():
                fused[s] *= (1.0 + min(0.5, v))

    return _normalize(fused)


def compute_bayesian_attribution(
    ward_id: str,
    reading: Dict,
    zone_profile: str = "mixed",
    wind_context: Optional[Dict] = None,
) -> Dict:
    """Compute source probabilities for one ward reading."""
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0

    likelihood = _fingerprint_likelihood(reading)
    posterior = _apply_priors(likelihood, zone_profile, hour, wind_context)

    dominant = max(posterior, key=posterior.get)
    confidence_val = posterior[dominant]
    confidence = "high" if confidence_val >= 0.55 else ("medium" if confidence_val >= 0.38 else "low")

    return {
        "ward_id": ward_id,
        "timestamp": now.isoformat().replace("+00:00", "Z"),
        "scores": posterior,
        "dominant_source": dominant,
        "confidence": confidence,
        "confidence_score": round(confidence_val, 3),
    }


def aggregate_zone_attribution(ward_attributions: List[Dict], ward_aqis: Optional[Dict[str, float]] = None) -> Dict:
    """Aggregate ward-level attribution into a single zone-level distribution."""
    totals = {s: 0.0 for s in SOURCES}

    for a in ward_attributions:
        ward_id = a.get("ward_id")
        weight = float((ward_aqis or {}).get(ward_id, 100.0))
        for s in SOURCES:
            totals[s] += weight * float(a.get("scores", {}).get(s, 0.0))

    norm = _normalize(totals)
    dominant = max(norm, key=norm.get)
    return {
        "scores": norm,
        "dominant_source": dominant,
        "confidence_score": norm[dominant],
    }
