"""Wind API Router — endpoints for wind data, field, and history."""
from datetime import datetime, timezone
from fastapi import APIRouter

from services.wind_service import (
    get_all_station_winds,
    get_wind_field_grid,
    interpolate_wind,
    get_wind_history,
    get_upwind_wards,
    SEASONAL_WIND,
)

router = APIRouter(prefix="/api/wind", tags=["wind"])


@router.get("/current")
async def get_current_wind():
    """Return current wind data for all zone stations."""
    stations = get_all_station_winds()
    now = datetime.now(timezone.utc)
    month = now.month
    seasonal = SEASONAL_WIND.get(month, {"dir": 270, "speed": 3.0, "label": "W"})

    return {
        "timestamp": now.isoformat().replace("+00:00", "Z"),
        "dominant_direction": seasonal["dir"],
        "dominant_label": seasonal["label"],
        "station_count": len(stations),
        "stations": stations,
    }


@router.get("/field")
async def get_wind_field(grid_size: int = 12):
    """Return interpolated wind vectors on a grid covering Delhi.
    Used for rendering wind arrows on the map.
    """
    grid_size = min(20, max(5, grid_size))
    grid = get_wind_field_grid(grid_size=grid_size)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "grid_size": grid_size,
        "point_count": len(grid),
        "field": grid,
    }


@router.get("/at")
async def get_wind_at_point(lat: float, lon: float):
    """Return interpolated wind at a specific lat/lon point."""
    wind = interpolate_wind(lat, lon)
    return {
        "lat": lat,
        "lon": lon,
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        **wind,
    }


@router.get("/upwind/{ward_id}")
async def get_upwind_for_ward(ward_id: str, radius_km: float = 5.0):
    """Find wards upwind of the given ward."""
    from routers.wards import WARD_META

    target = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not target:
        return {"error": "Ward not found"}

    # Build ward list with lng→lon mapping
    ward_list = [
        {**w, "lng": w.get("lng", w.get("lon", 0))}
        for w in WARD_META
        if w["ward_id"] != ward_id and w.get("feature_type") == "ward"
    ]

    wind = interpolate_wind(target["lat"], target["lng"])
    upwind = get_upwind_wards(target["lat"], target["lng"], ward_list, radius_km)

    return {
        "ward_id": ward_id,
        "ward_name": target.get("name", ""),
        "wind_at_ward": wind,
        "upwind_wards": upwind,
        "count": len(upwind),
    }


@router.get("/history")
async def get_wind_history_endpoint(hours: int = 24):
    """Return wind history for the specified hours."""
    hours = min(24, max(1, hours))
    history = get_wind_history(hours)
    return {
        "hours": hours,
        "snapshots": len(history),
        "history": history,
    }


@router.get("/seasonal")
async def get_seasonal_patterns():
    """Return Delhi's seasonal wind patterns."""
    now = datetime.now(timezone.utc)
    current_month = now.month

    patterns = []
    for month, data in SEASONAL_WIND.items():
        patterns.append({
            "month": month,
            "direction_deg": data["dir"],
            "avg_speed_mps": data["speed"],
            "label": data["label"],
            "is_current": month == current_month,
        })

    return {
        "current_month": current_month,
        "patterns": patterns,
    }
