"""Plume/trajectory API endpoints for wind-aware analysis."""
from datetime import datetime, timezone
from fastapi import APIRouter, Query

from services.atmospheric import compute_backward_trajectory, compute_ward_flow_chain
from services.wind_service import interpolate_wind, get_upwind_wards
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
