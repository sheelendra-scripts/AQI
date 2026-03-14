"""Wind Data Service — fetches wind data and provides interpolated wind field.

Supports:
- OpenWeatherMap API for real wind data
- Demo mode with realistic Delhi seasonal wind patterns
- IDW (Inverse Distance Weighting) interpolation across 250 wards
"""
import os
import math
import random
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, List, Tuple

import httpx

logger = logging.getLogger("aqms.wind")

# OpenWeatherMap API (free tier: 60 calls/min)
OWM_API_KEY = os.getenv("OWM_API_KEY", "")
OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# Delhi zone centers for wind station simulation
ZONE_WEATHER_STATIONS = {
    "Central":        {"lat": 28.6350, "lon": 77.2280},
    "South":          {"lat": 28.5300, "lon": 77.2200},
    "Shahdara North": {"lat": 28.6950, "lon": 77.2950},
    "Shahdara South": {"lat": 28.6350, "lon": 77.3050},
    "City SP":        {"lat": 28.6580, "lon": 77.2150},
    "Civil Lines":    {"lat": 28.6870, "lon": 77.2200},
    "Karol Bagh":     {"lat": 28.6480, "lon": 77.1900},
    "Najafgarh":      {"lat": 28.5700, "lon": 77.0700},
    "Narela":         {"lat": 28.7850, "lon": 77.1000},
    "Rohini":         {"lat": 28.7200, "lon": 77.1250},
    "West":           {"lat": 28.6550, "lon": 77.1600},
    "Keshavpuram":    {"lat": 28.6850, "lon": 77.1500},
}

# Seasonal wind patterns for Delhi (dominant direction in degrees, 0=N, 90=E, etc.)
SEASONAL_WIND = {
    1:  {"dir": 315, "speed": 2.5, "label": "NW (Winter)"},      # January
    2:  {"dir": 315, "speed": 3.0, "label": "NW (Late Winter)"},
    3:  {"dir": 270, "speed": 3.5, "label": "W (Pre-Summer)"},
    4:  {"dir": 270, "speed": 4.0, "label": "W (Spring)"},
    5:  {"dir": 270, "speed": 4.5, "label": "W (Summer)"},
    6:  {"dir": 225, "speed": 4.0, "label": "SW (Pre-Monsoon)"},
    7:  {"dir": 135, "speed": 5.0, "label": "SE (Monsoon)"},
    8:  {"dir": 135, "speed": 5.5, "label": "SE (Peak Monsoon)"},
    9:  {"dir": 135, "speed": 4.0, "label": "SE (Late Monsoon)"},
    10: {"dir": 315, "speed": 2.0, "label": "NW (Post-Monsoon)"}, # Stubble burning
    11: {"dir": 315, "speed": 1.5, "label": "NW (Early Winter)"},
    12: {"dir": 315, "speed": 2.0, "label": "NW (Winter)"},
}

# In-memory cache
_wind_cache: Dict[str, dict] = {}
_cache_timestamp: Optional[datetime] = None
CACHE_TTL_SECONDS = 300  # 5 minutes


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lon points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _generate_demo_wind(station_name: str, ts: Optional[datetime] = None) -> dict:
    """Generate realistic wind data based on Delhi seasonal patterns."""
    now = ts or datetime.now(timezone.utc)
    month = now.month
    hour = now.hour + now.minute / 60.0

    seasonal = SEASONAL_WIND[month]
    base_dir = seasonal["dir"]
    base_speed = seasonal["speed"]

    # Diurnal variation: wind picks up in afternoon, calms at night
    diurnal_factor = 0.6 + 0.4 * math.sin((hour - 6) * math.pi / 12)
    diurnal_factor = max(0.3, diurnal_factor)

    # Per-station variation (urban effects)
    station_hash = hash(station_name) % 100 / 100.0
    station_var = 0.8 + 0.4 * station_hash

    # Add realistic noise
    speed = max(0.2, base_speed * diurnal_factor * station_var + random.gauss(0, 0.5))
    direction = (base_dir + random.gauss(0, 15) + 10 * math.sin(hour * math.pi / 6)) % 360

    station = ZONE_WEATHER_STATIONS[station_name]
    return {
        "station": station_name,
        "lat": station["lat"],
        "lon": station["lon"],
        "wind_speed": round(speed, 2),
        "wind_direction": round(direction, 1),
        "wind_label": seasonal["label"],
        "temperature": round(28 + 5 * math.sin((hour - 14) * math.pi / 12) + random.gauss(0, 1), 1),
        "pressure": round(1013 + random.gauss(0, 2), 1),
        "timestamp": now.isoformat().replace("+00:00", "Z"),
    }


async def fetch_real_wind(lat: float, lon: float) -> Optional[dict]:
    """Fetch real wind data from OpenWeatherMap API."""
    if not OWM_API_KEY:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(OWM_BASE_URL, params={
                "lat": lat,
                "lon": lon,
                "appid": OWM_API_KEY,
                "units": "metric",
            })
            if resp.status_code != 200:
                logger.warning(f"OWM returned {resp.status_code}")
                return None
            data = resp.json()
            wind = data.get("wind", {})
            return {
                "wind_speed": wind.get("speed", 0),
                "wind_direction": wind.get("deg", 0),
                "temperature": data.get("main", {}).get("temp", 28),
                "pressure": data.get("main", {}).get("pressure", 1013),
            }
    except Exception as e:
        logger.error(f"OWM fetch error: {e}")
        return None


async def update_wind_cache():
    """Refresh wind data for all zone stations."""
    global _wind_cache, _cache_timestamp
    now = datetime.now(timezone.utc)

    for station_name, coords in ZONE_WEATHER_STATIONS.items():
        # Try real API first
        real_data = await fetch_real_wind(coords["lat"], coords["lon"])
        if real_data:
            _wind_cache[station_name] = {
                "station": station_name,
                "lat": coords["lat"],
                "lon": coords["lon"],
                "wind_speed": real_data["wind_speed"],
                "wind_direction": real_data["wind_direction"],
                "temperature": real_data["temperature"],
                "pressure": real_data["pressure"],
                "timestamp": now.isoformat().replace("+00:00", "Z"),
                "source": "openweathermap",
            }
        else:
            # Fallback to demo
            _wind_cache[station_name] = {
                **_generate_demo_wind(station_name, now),
                "source": "simulated",
            }

    _cache_timestamp = now
    logger.info(f"🌬️ Wind cache updated for {len(_wind_cache)} stations")


def get_all_station_winds() -> List[dict]:
    """Return current wind data for all stations."""
    if not _wind_cache:
        # Generate demo data if cache is empty
        for name in ZONE_WEATHER_STATIONS:
            _wind_cache[name] = _generate_demo_wind(name)
    return list(_wind_cache.values())


def interpolate_wind(target_lat: float, target_lon: float) -> dict:
    """IDW interpolation of wind at any point from station data.

    Returns interpolated wind speed and direction at the target location.
    Uses vector decomposition to properly handle circular wind directions.
    """
    stations = get_all_station_winds()
    if not stations:
        return {"wind_speed": 0, "wind_direction": 0}

    weights = []
    u_components = []
    v_components = []

    for s in stations:
        dist = haversine(s["lat"], s["lon"], target_lat, target_lon)
        if dist < 0.05:  # Very close — use directly
            return {
                "wind_speed": s["wind_speed"],
                "wind_direction": s["wind_direction"],
                "station": s["station"],
            }

        w = 1.0 / (dist ** 2)
        weights.append(w)

        # Decompose wind into u (east) and v (north) components
        dir_rad = math.radians(s["wind_direction"])
        u_components.append(s["wind_speed"] * math.sin(dir_rad))
        v_components.append(s["wind_speed"] * math.cos(dir_rad))

    total_w = sum(weights)
    u_avg = sum(w * u for w, u in zip(weights, u_components)) / total_w
    v_avg = sum(w * v for w, v in zip(weights, v_components)) / total_w

    speed = math.sqrt(u_avg ** 2 + v_avg ** 2)
    direction = (math.degrees(math.atan2(u_avg, v_avg)) + 360) % 360

    return {
        "wind_speed": round(speed, 2),
        "wind_direction": round(direction, 1),
    }


def get_wind_field_grid(lat_min: float = 28.40, lat_max: float = 28.85,
                        lon_min: float = 76.85, lon_max: float = 77.35,
                        grid_size: int = 15) -> List[dict]:
    """Generate interpolated wind vectors on a grid covering Delhi.

    Returns a list of {lat, lon, wind_speed, wind_direction, u, v} points
    for rendering wind arrows on the map.
    """
    grid = []
    lat_step = (lat_max - lat_min) / grid_size
    lon_step = (lon_max - lon_min) / grid_size

    for i in range(grid_size + 1):
        for j in range(grid_size + 1):
            lat = lat_min + i * lat_step
            lon = lon_min + j * lon_step
            wind = interpolate_wind(lat, lon)

            dir_rad = math.radians(wind["wind_direction"])
            grid.append({
                "lat": round(lat, 4),
                "lon": round(lon, 4),
                "wind_speed": wind["wind_speed"],
                "wind_direction": wind["wind_direction"],
                "u": round(wind["wind_speed"] * math.sin(dir_rad), 3),
                "v": round(wind["wind_speed"] * math.cos(dir_rad), 3),
            })

    return grid


def get_upwind_wards(target_lat: float, target_lon: float,
                     all_wards: List[dict], radius_km: float = 5.0) -> List[dict]:
    """Find wards that are upwind of the target location.

    A ward is 'upwind' if:
    1. It is within radius_km of the target
    2. The bearing from the ward to the target roughly matches the wind direction
    """
    wind = interpolate_wind(target_lat, target_lon)
    wind_dir = wind["wind_direction"]
    # Wind comes FROM wind_dir, so upwind wards are in that direction
    upwind_bearing = wind_dir  # The direction FROM which wind blows

    upwind = []
    for ward in all_wards:
        dist = haversine(ward["lat"], ward["lng"], target_lat, target_lon)
        if dist > radius_km or dist < 0.05:
            continue

        # Bearing from target to ward
        dlat = math.radians(ward["lat"] - target_lat)
        dlon = math.radians(ward["lng"] - target_lon)
        y = math.sin(dlon) * math.cos(math.radians(ward["lat"]))
        x = (math.cos(math.radians(target_lat)) * math.sin(math.radians(ward["lat"])) -
             math.sin(math.radians(target_lat)) * math.cos(math.radians(ward["lat"])) * math.cos(dlon))
        bearing = (math.degrees(math.atan2(y, x)) + 360) % 360

        # Check if ward is roughly in the upwind direction (within 60°)
        angle_diff = abs(bearing - upwind_bearing)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff

        if angle_diff < 60:
            upwind.append({
                "ward_id": ward["ward_id"],
                "name": ward.get("name", ""),
                "zone": ward.get("zone", ""),
                "distance_km": round(dist, 2),
                "bearing": round(bearing, 1),
                "angle_from_wind": round(angle_diff, 1),
            })

    return sorted(upwind, key=lambda w: w["distance_km"])


# Wind history (in-memory ring buffer)
_wind_history: List[dict] = []
MAX_HISTORY = 288  # 24 hours at 5-min intervals


def record_wind_snapshot():
    """Record current wind state to history."""
    global _wind_history
    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "stations": get_all_station_winds(),
    }
    _wind_history.append(snapshot)
    if len(_wind_history) > MAX_HISTORY:
        _wind_history = _wind_history[-MAX_HISTORY:]


def get_wind_history(hours: int = 24) -> List[dict]:
    """Return wind history for the specified period."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    cutoff_str = cutoff.isoformat().replace("+00:00", "Z")
    return [s for s in _wind_history if s["timestamp"] >= cutoff_str]
