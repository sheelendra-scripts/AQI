"""Atmospheric Modeling Service — plume dispersion and backward trajectory.

Provides:
- Simplified Gaussian plume dispersion model
- Backward trajectory reconstruction
- Upwind/downwind ward chain computation
- Pollution transport estimation between wards
"""
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Tuple

from services.wind_service import interpolate_wind, haversine, get_all_station_winds

logger = logging.getLogger("aqms.atmospheric")

# Pasquill stability classes → dispersion coefficients
# Using Pasquill-Gifford σy, σz parameterization: σ = a * x^b
# x in km, σ in meters
STABILITY_PARAMS = {
    "A": {"sy_a": 0.22, "sy_b": 0.94, "sz_a": 0.20, "sz_b": 1.00, "label": "Very Unstable"},
    "B": {"sy_a": 0.16, "sy_b": 0.92, "sz_a": 0.12, "sz_b": 0.95, "label": "Unstable"},
    "C": {"sy_a": 0.11, "sy_b": 0.91, "sz_a": 0.08, "sz_b": 0.85, "label": "Slightly Unstable"},
    "D": {"sy_a": 0.08, "sy_b": 0.89, "sz_a": 0.06, "sz_b": 0.80, "label": "Neutral"},
    "E": {"sy_a": 0.06, "sy_b": 0.86, "sz_a": 0.03, "sz_b": 0.75, "label": "Slightly Stable"},
    "F": {"sy_a": 0.04, "sy_b": 0.83, "sz_a": 0.016, "sz_b": 0.70, "label": "Stable"},
}


def estimate_stability_class(wind_speed: float, hour: float) -> str:
    """Estimate Pasquill stability class from wind speed and time of day.

    Simplified estimation:
    - Daytime (6-18h) with low wind → unstable (A-C)
    - Daytime with high wind → neutral (D)
    - Nighttime → stable (E-F)
    """
    is_daytime = 6 <= hour <= 18

    if is_daytime:
        if wind_speed < 2:
            return "A"
        elif wind_speed < 3:
            return "B"
        elif wind_speed < 5:
            return "C"
        else:
            return "D"
    else:
        if wind_speed < 3:
            return "F"
        elif wind_speed < 5:
            return "E"
        else:
            return "D"


def gaussian_plume_concentration(
    Q: float,          # Emission rate (µg/s)
    x: float,          # Downwind distance (km)
    y: float,          # Crosswind distance (km)
    z: float,          # Receptor height (m)
    H: float,          # Effective source height (m)
    wind_speed: float, # m/s
    stability: str = "D",
) -> float:
    """Calculate ground-level concentration using Gaussian plume model.

    Returns concentration in µg/m³ at the receptor point.
    """
    if x <= 0 or wind_speed < 0.1:
        return 0.0

    params = STABILITY_PARAMS.get(stability, STABILITY_PARAMS["D"])

    # Dispersion coefficients (convert x from km for formula, output in meters)
    sigma_y = params["sy_a"] * (x * 1000) ** params["sy_b"]
    sigma_z = params["sz_a"] * (x * 1000) ** params["sz_b"]

    # Prevent division by zero
    if sigma_y < 0.1 or sigma_z < 0.1:
        return 0.0

    # Gaussian plume equation with ground reflection
    exp_y = math.exp(-(y * 1000) ** 2 / (2 * sigma_y ** 2))
    exp_z1 = math.exp(-(z - H) ** 2 / (2 * sigma_z ** 2))
    exp_z2 = math.exp(-(z + H) ** 2 / (2 * sigma_z ** 2))

    C = (Q / (2 * math.pi * wind_speed * sigma_y * sigma_z)) * exp_y * (exp_z1 + exp_z2)

    return max(0.0, C)


def compute_backward_trajectory(
    start_lat: float,
    start_lon: float,
    hours: float = 3.0,
    dt_minutes: float = 10.0,
) -> List[dict]:
    """Compute backward trajectory from a point, tracing where air came from.

    Returns a list of trajectory points [{lat, lon, time, wind_speed, wind_direction}].
    The first point is the receptor (current location), subsequent points trace backward.
    """
    trajectory = []
    lat, lon = start_lat, start_lon
    now = datetime.now(timezone.utc)
    total_steps = int(hours * 60 / dt_minutes)

    for step in range(total_steps + 1):
        t = now - timedelta(minutes=step * dt_minutes)
        wind = interpolate_wind(lat, lon)

        trajectory.append({
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "time": t.isoformat().replace("+00:00", "Z"),
            "step": step,
            "minutes_back": round(step * dt_minutes, 1),
            "wind_speed": wind["wind_speed"],
            "wind_direction": wind["wind_direction"],
        })

        if step < total_steps:
            # Move backward: reverse the wind direction
            back_dir_rad = math.radians((wind["wind_direction"] + 180) % 360)
            speed = wind["wind_speed"]
            dt_seconds = dt_minutes * 60

            # Displacement in meters
            dx = speed * dt_seconds * math.sin(back_dir_rad)
            dy = speed * dt_seconds * math.cos(back_dir_rad)

            # Convert to degrees (approximate)
            lat += dy / 111320.0
            lon += dx / (111320.0 * math.cos(math.radians(lat)))

    return trajectory


def compute_ward_flow_chain(
    zone_wards: List[dict],
    wind_direction: float,
) -> List[dict]:
    """Order wards along the wind flow direction within a zone.

    Returns wards sorted from upwind to downwind, with projected distance
    along the wind axis.

    Args:
        zone_wards: List of ward dicts with lat/lng
        wind_direction: Wind direction in degrees (direction FROM which wind blows)
    """
    if not zone_wards:
        return []

    # Wind blows FROM wind_direction, so flow axis is wind_direction
    flow_rad = math.radians(wind_direction)

    # Center of the zone
    center_lat = sum(w["lat"] for w in zone_wards) / len(zone_wards)
    center_lng = sum(w.get("lng", w.get("lon", 0)) for w in zone_wards) / len(zone_wards)

    results = []
    for ward in zone_wards:
        # Vector from center to ward (in approximate meters)
        dlat = (ward["lat"] - center_lat) * 111320
        dlng = (ward.get("lng", ward.get("lon", 0)) - center_lng) * 111320 * math.cos(math.radians(center_lat))

        # Project onto wind axis
        # Positive = downwind (ward is in the direction wind blows TO)
        # flow_rad points FROM where wind comes
        flow_to_rad = math.radians((wind_direction + 180) % 360)
        projection = dlat * math.cos(flow_to_rad) + dlng * math.sin(flow_to_rad)

        results.append({
            "ward_id": ward["ward_id"],
            "name": ward.get("name", ""),
            "lat": ward["lat"],
            "lng": ward.get("lng", ward.get("lon", 0)),
            "wind_axis_position_m": round(projection, 1),
            "position_label": "downwind" if projection > 100 else ("upwind" if projection < -100 else "crosswind"),
        })

    # Sort: most upwind first → most downwind last
    results.sort(key=lambda w: w["wind_axis_position_m"])
    for i, w in enumerate(results):
        w["flow_order"] = i + 1

    return results


def estimate_transport_contribution(
    source_ward: dict,
    receptor_ward: dict,
    wind_speed: float,
    wind_direction: float,
    source_pm25: float,
) -> dict:
    """Estimate how much pollution from source_ward reaches receptor_ward.

    Uses simplified Gaussian plume in inverse mode:
    Given source strength and geometry, estimate receptor concentration.

    Returns dict with estimated contribution and travel time.
    """
    src_lat = source_ward["lat"]
    src_lng = source_ward.get("lng", source_ward.get("lon", 0))
    rec_lat = receptor_ward["lat"]
    rec_lng = receptor_ward.get("lng", receptor_ward.get("lon", 0))

    # Distance between wards
    dist_km = haversine(src_lat, src_lng, rec_lat, rec_lng)

    if dist_km < 0.05:
        return {"contribution_pct": 0, "travel_time_min": 0}

    # Bearing from source to receptor
    dlat = math.radians(rec_lat - src_lat)
    dlon = math.radians(rec_lng - src_lng)
    y = math.sin(dlon) * math.cos(math.radians(rec_lat))
    x = (math.cos(math.radians(src_lat)) * math.sin(math.radians(rec_lat)) -
         math.sin(math.radians(src_lat)) * math.cos(math.radians(rec_lat)) * math.cos(dlon))
    bearing = (math.degrees(math.atan2(y, x)) + 360) % 360

    # Check if receptor is downwind of source
    # Wind blows FROM wind_direction, TO (wind_direction + 180)
    downwind_dir = (wind_direction + 180) % 360
    angle_diff = abs(bearing - downwind_dir)
    if angle_diff > 180:
        angle_diff = 360 - angle_diff

    if angle_diff > 60:
        # Receptor is not meaningfully downwind
        return {
            "contribution_pct": 0,
            "travel_time_min": 0,
            "is_downwind": False,
            "angle_offset": round(angle_diff, 1),
        }

    # Compute downwind and crosswind distances
    downwind_km = dist_km * math.cos(math.radians(angle_diff))
    crosswind_km = dist_km * math.sin(math.radians(angle_diff))

    # Estimate stability class
    hour = datetime.now(timezone.utc).hour
    stability = estimate_stability_class(wind_speed, hour)

    # Assume source emits at a rate proportional to PM2.5
    Q = source_pm25 * 100  # Approximate emission rate

    concentration = gaussian_plume_concentration(
        Q=Q, x=downwind_km, y=crosswind_km, z=2.0, H=10.0,
        wind_speed=max(0.5, wind_speed), stability=stability,
    )

    # Contribution as percentage of receptor's expected reading
    contribution_pct = min(100, (concentration / max(1, source_pm25)) * 100)

    # Travel time
    travel_time = (dist_km * 1000) / max(0.5, wind_speed) / 60  # minutes

    return {
        "contribution_pct": round(contribution_pct, 2),
        "travel_time_min": round(travel_time, 1),
        "distance_km": round(dist_km, 2),
        "is_downwind": True,
        "angle_offset": round(angle_diff, 1),
        "stability_class": stability,
        "plume_concentration": round(concentration, 4),
    }
