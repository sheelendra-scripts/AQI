"""Source attribution API endpoints."""
from datetime import datetime, timezone
from fastapi import APIRouter

from ml.attribution import compute_bayesian_attribution, aggregate_zone_attribution
from services.wind_service import interpolate_wind, get_upwind_wards
from routers.wards import WARD_META, _generate_ward_reading

router = APIRouter(prefix="/api/attribution", tags=["attribution"])


def _source_score(reading: dict, angle_penalty: float = 1.0) -> float:
    base = float(reading.get("aqi", 0)) / 500.0
    conf = float(reading.get("source_confidence", 0.5) or 0.5)
    return round(base * conf * angle_penalty, 3)


def _prepare_wind_context(target: dict, readings: list) -> dict:
    upwind_raw = get_upwind_wards(target["lat"], target["lng"], readings, radius_km=7.0)
    reading_map = {r["ward_id"]: r for r in readings}
    enriched = []
    for u in upwind_raw[:6]:
        r = reading_map.get(u["ward_id"])
        if not r:
            continue
        angle_penalty = max(0.2, 1.0 - (float(u.get("angle_from_wind", 0.0)) / 90.0))
        enriched.append({
            "ward_id": u["ward_id"],
            "name": u.get("name", ""),
            "source_detected": r.get("source_detected"),
            "aqi": r.get("aqi"),
            "score": _source_score(r, angle_penalty),
        })
    return {"upwind_sources": sorted(enriched, key=lambda x: x["score"], reverse=True)[:3]}


@router.get("/ward/{ward_id}")
async def get_ward_attribution(ward_id: str):
    ward = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not ward:
        return {"error": "Ward not found"}

    readings = [_generate_ward_reading(w) for w in WARD_META if w.get("feature_type") == "ward"]
    current = next((r for r in readings if r["ward_id"] == ward_id), None)
    if not current:
        return {"error": "Ward reading unavailable"}

    wind = interpolate_wind(current["lat"], current["lng"])
    wind_context = _prepare_wind_context(current, readings)

    attribution = compute_bayesian_attribution(
        ward_id=ward_id,
        reading=current,
        zone_profile=ward.get("profile", "mixed"),
        wind_context=wind_context,
    )

    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ward": {
            "ward_id": current["ward_id"],
            "name": current["name"],
            "zone": current["zone"],
            "aqi": current["aqi"],
            "source_detected": current.get("source_detected"),
        },
        "wind": wind,
        "upwind": wind_context.get("upwind_sources", []),
        "attribution": attribution,
    }


@router.get("/zone/{zone_id}")
async def get_zone_attribution(zone_id: str):
    zone_wards = [
        w for w in WARD_META
        if w.get("feature_type") == "ward" and w.get("zone", "").lower().replace(" ", "_") == zone_id.lower()
    ]
    if not zone_wards:
        return {"error": "Zone not found"}

    readings = [_generate_ward_reading(w) for w in zone_wards]
    all_readings = [_generate_ward_reading(w) for w in WARD_META if w.get("feature_type") == "ward"]

    attrs = []
    ward_aqis = {}
    for r in readings:
        wind_context = _prepare_wind_context(r, all_readings)
        a = compute_bayesian_attribution(r["ward_id"], r, zone_profile="mixed", wind_context=wind_context)
        attrs.append(a)
        ward_aqis[r["ward_id"]] = r["aqi"]

    zone = aggregate_zone_attribution(attrs, ward_aqis)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "zone_id": zone_id,
        "ward_count": len(readings),
        "dominant_source": zone["dominant_source"],
        "scores": zone["scores"],
        "confidence_score": zone["confidence_score"],
        "wards": [{"ward_id": a["ward_id"], "dominant_source": a["dominant_source"], "confidence": a["confidence"]} for a in attrs],
    }


@router.get("/city")
async def get_city_attribution():
    wards = [w for w in WARD_META if w.get("feature_type") == "ward"]
    readings = [_generate_ward_reading(w) for w in wards]

    attrs = []
    ward_aqis = {}
    for w, r in zip(wards, readings):
        wind_context = _prepare_wind_context(r, readings)
        a = compute_bayesian_attribution(r["ward_id"], r, zone_profile=w.get("profile", "mixed"), wind_context=wind_context)
        attrs.append(a)
        ward_aqis[r["ward_id"]] = r["aqi"]

    city = aggregate_zone_attribution(attrs, ward_aqis)
    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ward_count": len(wards),
        "dominant_source": city["dominant_source"],
        "scores": city["scores"],
        "confidence_score": city["confidence_score"],
    }
