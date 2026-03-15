"""Plume/trajectory API endpoints for wind-aware analysis."""
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from services.atmospheric import (
    compute_backward_trajectory,
    compute_ward_flow_chain,
    estimate_source_coordinates,
    estimate_stability_class,
    gaussian_plume_concentration,
)
from services.wind_service import interpolate_wind, get_upwind_wards
from services.industrial_sources import find_nearest_sources
from services.spike_detector import detect_spike_from_readings
from routers.wards import WARD_META

router = APIRouter(prefix="/api/plume", tags=["plume"])


@router.get("/trajectory/{ward_id}")
async def get_trajectory(ward_id: str, hours: int = Query(default=3, ge=1, le=6)):
    ward = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not ward:
        return {"error": "Ward not found", "trajectory": []}

    points = compute_backward_trajectory(ward["lat"], ward["lng"], hours=float(hours), dt_minutes=10.0)
    return {
        "ward_id": ward_id,
        "ward_name": ward.get("name", ""),
        "hours": hours,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "trajectory": points,
    }


@router.get("/upwind/{ward_id}")
async def get_upwind(ward_id: str, radius_km: float = Query(default=6.0, ge=1.0, le=20.0)):
    target = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not target:
        return {"error": "Ward not found", "upwind_wards": []}

    all_wards = [w for w in WARD_META if w.get("feature_type") == "ward" and w["ward_id"] != ward_id]
    upwind = get_upwind_wards(target["lat"], target["lng"], all_wards, radius_km=radius_km)
    wind = interpolate_wind(target["lat"], target["lng"])

    return {
        "ward_id": ward_id,
        "ward_name": target.get("name", ""),
        "radius_km": radius_km,
        "wind_at_ward": wind,
        "count": len(upwind),
        "upwind_wards": upwind,
    }


@router.get("/flow-chain/{zone_id}")
async def get_flow_chain(zone_id: str):
    zone_items = [w for w in WARD_META if w.get("zone", "").lower().replace(" ", "_") == zone_id.lower()]
    zone_wards = [w for w in zone_items if w.get("feature_type") == "ward"]

    if not zone_wards:
        return {"error": "Zone not found or has no wards", "chain": []}

    c_lat = sum(w["lat"] for w in zone_wards) / len(zone_wards)
    c_lng = sum(w["lng"] for w in zone_wards) / len(zone_wards)
    wind = interpolate_wind(c_lat, c_lng)

    chain = compute_ward_flow_chain(zone_wards, wind_direction=wind["wind_direction"])
    return {
        "zone_id": zone_id,
        "wind": wind,
        "count": len(chain),
        "chain": chain,
    }


@router.get("/industrial-source/{ward_id}")
async def get_industrial_source_match(
    ward_id: str,
    transport_hours: float = Query(default=1.0, ge=0.25, le=6.0, description="Estimated pollution transport time in hours"),
    top_sources: int = Query(default=3, ge=1, le=5, description="Number of nearest industrial sources to return"),
):
    """Match a ward's current pollution spike to nearby industrial emission sources.

    Pipeline (mirrors the hackdata research pipeline):
    1. Get current sensor reading for the ward.
    2. Detect whether it is a spike event (Z-score vs. synthetic baseline).
    3. Interpolate current wind at the ward's location.
    4. Estimate source coordinates by projecting upwind from the ward.
    5. Query the Zenodo industrial emissions grid for the nearest sources.
    6. Run Gaussian plume model for each matched source.

    Returns a structured response with spike status, estimated source location,
    and ranked industrial emission sources with plume concentration estimates.
    """
    from routers.wards import _generate_ward_reading

    ward = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not ward:
        return {"error": "Ward not found"}

    # --- Step 1: Current reading ---
    current = _generate_ward_reading(ward)
    ward_lat = ward["lat"]
    ward_lng = ward.get("lng", ward.get("lon", 0))

    # --- Step 2: Spike detection (synthetic baseline from neighbouring wards) ---
    nearby = [
        _generate_ward_reading(w)
        for w in WARD_META
        if w.get("feature_type") == "ward" and w["ward_id"] != ward_id
    ][:48]  # use up to 48 wards as baseline population
    spike_info = detect_spike_from_readings(current, nearby)

    # --- Step 3: Wind at ward ---
    wind = interpolate_wind(ward_lat, ward_lng)
    wind_speed = wind.get("wind_speed", 2.0)
    wind_direction = wind.get("wind_direction", 315.0)

    # --- Step 4: Estimate source coordinates ---
    source_coords = estimate_source_coordinates(
        lat=ward_lat,
        lon=ward_lng,
        wind_direction=wind_direction,
        wind_speed=wind_speed,
        transport_hours=transport_hours,
    )

    # --- Step 5: Find nearest industrial sources ---
    industrial_matches = find_nearest_sources(
        lat=source_coords["source_lat"],
        lon=source_coords["source_lon"],
        top_n=top_sources,
    )

    # --- Step 6: Gaussian plume for each matched source ---
    from datetime import datetime, timezone
    hour = datetime.now(timezone.utc).hour
    stability = estimate_stability_class(wind_speed, float(hour))

    enriched_sources = []
    for src in industrial_matches:
        dist_km = src["distance_m"] / 1000.0
        # Convert daily tons/day to µg/s  (1 ton/day ≈ 11.57 g/s = 11_574_074 µg/s)
        Q = src["pm25_emission"] * 1_000_000 / 86_400  # µg/s
        conc = gaussian_plume_concentration(
            Q=Q,
            x=max(dist_km, 0.05),
            y=0.0,           # directly downwind
            z=1.5,           # breathing height
            H=30.0,          # typical industrial stack height in Delhi
            wind_speed=max(wind_speed, 0.5),
            stability=stability,
        )
        enriched_sources.append({
            **src,
            "stability_class": stability,
            "plume_conc_ug_m3": round(conc, 6),
        })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "ward": {
            "ward_id": current["ward_id"],
            "name": current.get("name", ""),
            "zone": current.get("zone", ""),
            "aqi": current.get("aqi"),
            "pm25": current.get("pm25"),
            "source_detected": current.get("source_detected"),
            "lat": ward["lat"],
            "lng": ward.get("lng", ward.get("lon", 0)),
        },
        "spike": spike_info,
        "wind": wind,
        "estimated_source_location": source_coords,
        "industrial_source_matches": enriched_sources,
        "model_notes": {
            "stability_class": stability,
            "transport_hours": transport_hours,
            "emissions_dataset": "Zenodo Delhi Domain 2020 (DelhiDomain_2020.shp)",
            "plume_model": "Gaussian Pasquill-Gifford",
        },
    }

