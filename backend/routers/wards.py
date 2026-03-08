"""Wards API — multi-ward AQI data for the map view."""
import math
import random
from datetime import datetime, timezone
from fastapi import APIRouter

from utils.aqi_calc import calculate_aqi, get_aqi_category

router = APIRouter(prefix="/api", tags=["wards"])

# Ward metadata — MCD (Municipal Corporation of Delhi) 12 Administrative Zones
WARD_META = [
    {"ward_id": "zone_01", "name": "Central Zone",          "zone": "Central",         "lat": 28.6400, "lng": 77.2200, "profile": "vehicle",
     "areas": "Daryaganj, ITO, Rajghat, Turkman Gate"},
    {"ward_id": "zone_02", "name": "South Zone",            "zone": "South",           "lat": 28.5350, "lng": 77.2200, "profile": "vehicle",
     "areas": "Hauz Khas, GK, Saket, Mehrauli, Khanpur"},
    {"ward_id": "zone_03", "name": "Shahdara North Zone",   "zone": "Shahdara North",  "lat": 28.6900, "lng": 77.2900, "profile": "industrial",
     "areas": "Seelampur, Nand Nagri, Gokulpuri, Mustafabad"},
    {"ward_id": "zone_04", "name": "Shahdara South Zone",   "zone": "Shahdara South",  "lat": 28.6350, "lng": 77.2950, "profile": "mixed",
     "areas": "Preet Vihar, Laxmi Nagar, Mayur Vihar, Patparganj"},
    {"ward_id": "zone_05", "name": "City SP Zone",          "zone": "City SP",         "lat": 28.6550, "lng": 77.2350, "profile": "mixed",
     "areas": "Chandni Chowk, Sadar Bazaar, Paharganj, Jama Masjid"},
    {"ward_id": "zone_06", "name": "Civil Lines Zone",      "zone": "Civil Lines",     "lat": 28.6850, "lng": 77.2200, "profile": "clean",
     "areas": "Civil Lines, Timarpur, Kamla Nagar, Burari"},
    {"ward_id": "zone_07", "name": "Karol Bagh Zone",       "zone": "Karol Bagh",      "lat": 28.6500, "lng": 77.1900, "profile": "vehicle",
     "areas": "Karol Bagh, Patel Nagar, Rajender Nagar, Pusa Road"},
    {"ward_id": "zone_08", "name": "Najafgarh Zone",        "zone": "Najafgarh",       "lat": 28.5700, "lng": 76.9800, "profile": "biomass",
     "areas": "Najafgarh, Dwarka, Kakrola, Chhawla, Paprawat"},
    {"ward_id": "zone_09", "name": "Narela Zone",           "zone": "Narela",          "lat": 28.8500, "lng": 77.0950, "profile": "biomass",
     "areas": "Narela, Bawana, Holambi, Alipur, Bakhtawarpur"},
    {"ward_id": "zone_10", "name": "Rohini Zone",           "zone": "Rohini",          "lat": 28.7350, "lng": 77.1150, "profile": "construction",
     "areas": "Rohini Sec 1-25, Pitampura, Prashant Vihar, Budh Vihar"},
    {"ward_id": "zone_11", "name": "West Zone",             "zone": "West",            "lat": 28.6500, "lng": 77.0850, "profile": "construction",
     "areas": "Rajouri Garden, Janakpuri, Tilak Nagar, Vikaspuri, Uttam Nagar"},
    {"ward_id": "zone_12", "name": "Keshavpuram Zone",      "zone": "Keshavpuram",     "lat": 28.6950, "lng": 77.1550, "profile": "vehicle",
     "areas": "Ashok Vihar, Shalimar Bagh, Wazirpur, Tri Nagar, Saraswati Vihar"},
]

# Pollution profiles — determine base levels per ward type
PROFILES = {
    "clean":        {"pm25_base": 25, "co_base": 0.8, "no2_base": 0.03, "tvoc_base": 0.15, "source": None},
    "vehicle":      {"pm25_base": 65, "co_base": 2.5, "no2_base": 0.08, "tvoc_base": 0.25, "source": "vehicle"},
    "industrial":   {"pm25_base": 90, "co_base": 3.2, "no2_base": 0.12, "tvoc_base": 0.55, "source": "industrial"},
    "construction": {"pm25_base": 110,"co_base": 1.5, "no2_base": 0.04, "tvoc_base": 0.80, "source": "construction"},
    "biomass":      {"pm25_base": 80, "co_base": 4.0, "no2_base": 0.05, "tvoc_base": 0.70, "source": "biomass"},
    "mixed":        {"pm25_base": 50, "co_base": 1.6, "no2_base": 0.06, "tvoc_base": 0.30, "source": "vehicle"},
}


def _generate_ward_reading(ward: dict) -> dict:
    """Generate a realistic reading for a ward based on its pollution profile."""
    now = datetime.now(timezone.utc)
    hour = now.hour + now.minute / 60.0

    # Diurnal variation
    morning_peak = math.exp(-((hour - 8) ** 2) / 8)
    evening_peak = math.exp(-((hour - 18) ** 2) / 8)
    traffic_factor = 0.4 + 0.6 * (morning_peak + evening_peak)

    prof = PROFILES.get(ward["profile"], PROFILES["mixed"])
    noise = lambda s=1.0: random.gauss(0, s)

    pm25 = max(5, prof["pm25_base"] * traffic_factor + noise(8))
    co = max(0.1, prof["co_base"] * traffic_factor + noise(0.2))
    no2 = max(0.005, prof["no2_base"] * traffic_factor + noise(0.008))
    tvoc = max(0.01, prof["tvoc_base"] * traffic_factor + noise(0.05))
    temperature = 28.0 + 5 * math.sin((hour - 14) * math.pi / 12) + noise(1.2)
    humidity = 55.0 - 15 * math.sin((hour - 14) * math.pi / 12) + noise(2.5)

    aqi = calculate_aqi(pm25, co, no2)
    cat = get_aqi_category(aqi)

    return {
        "ward_id": ward["ward_id"],
        "name": ward["name"],
        "zone": ward["zone"],
        "lat": ward["lat"],
        "lng": ward["lng"],
        "timestamp": now.isoformat().replace("+00:00", "Z"),
        "temperature": round(max(15, min(45, temperature)), 1),
        "humidity": round(max(20, min(95, humidity)), 1),
        "pm25": round(pm25, 1),
        "co": round(co, 2),
        "no2": round(no2, 3),
        "tvoc": round(tvoc, 2),
        "aqi": aqi,
        "aqi_category": cat["category"],
        "aqi_color": cat["color"],
        "source_detected": prof["source"],
        "source_confidence": round(0.65 + random.random() * 0.3, 2) if prof["source"] else None,
    }


@router.get("/wards")
async def get_all_wards():
    """Return current AQI data for all 12 wards (for map coloring)."""
    wards = [_generate_ward_reading(w) for w in WARD_META]
    return {
        "count": len(wards),
        "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "wards": wards,
    }


@router.get("/wards/{ward_id}")
async def get_ward(ward_id: str):
    """Return data for a specific ward."""
    ward = next((w for w in WARD_META if w["ward_id"] == ward_id), None)
    if not ward:
        return {"error": "Ward not found"}
    return _generate_ward_reading(ward)
