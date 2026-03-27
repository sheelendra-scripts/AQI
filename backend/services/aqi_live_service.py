"""Live AQI service using Open-Meteo Air Quality API.

Fetches zone-level Delhi air-quality snapshots and caches them to avoid
excessive outbound calls when /api/wards is requested frequently.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

import httpx

logger = logging.getLogger("aqms.live_aqi")

OPEN_METEO_AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
CACHE_TTL_SECONDS = 600  # 10 minutes

_cache_timestamp: Optional[datetime] = None
_live_zone_cache: Dict[str, dict] = {}


async def _fetch_zone_live_aqi(client: httpx.AsyncClient, zone_name: str, lat: float, lng: float) -> Optional[dict]:
    """Fetch current AQI and PM2.5 for a zone center."""
    try:
        resp = await client.get(
            OPEN_METEO_AIR_QUALITY_URL,
            params={
                "latitude": lat,
                "longitude": lng,
                "current": "us_aqi,pm2_5",
                "timezone": "auto",
            },
        )
        if resp.status_code != 200:
            logger.warning("Open-Meteo AQI returned %s for %s", resp.status_code, zone_name)
            return None

        data = resp.json()
        current = data.get("current", {})
        us_aqi = current.get("us_aqi")
        pm25 = current.get("pm2_5")
        if us_aqi is None and pm25 is None:
            return None

        return {
            "zone": zone_name,
            "us_aqi": int(round(float(us_aqi))) if us_aqi is not None else None,
            "pm25": float(pm25) if pm25 is not None else None,
            "timestamp": current.get("time") or datetime.now(timezone.utc).isoformat(),
            "source": "open-meteo",
        }
    except Exception as exc:
        logger.warning("Open-Meteo AQI fetch failed for %s: %s", zone_name, exc)
        return None


async def get_live_zone_aqi(zone_defs: Dict[str, dict]) -> Dict[str, dict]:
    """Return cached or freshly fetched live AQI snapshots keyed by zone name."""
    global _cache_timestamp, _live_zone_cache

    now = datetime.now(timezone.utc)
    if _cache_timestamp and (now - _cache_timestamp).total_seconds() < CACHE_TTL_SECONDS:
        return _live_zone_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            _fetch_zone_live_aqi(client, zone_name, zdef["lat"], zdef["lng"])
            for zone_name, zdef in zone_defs.items()
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    fresh = {}
    for result in results:
        if result:
            fresh[result["zone"]] = result

    if fresh:
        _live_zone_cache = fresh
        _cache_timestamp = now
        logger.info("Live AQI cache updated for %s zones", len(fresh))
        return _live_zone_cache

    # Fall back to previous cache if the current fetch failed entirely.
    return _live_zone_cache
