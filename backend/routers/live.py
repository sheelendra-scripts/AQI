"""Live data API endpoint."""
from fastapi import APIRouter
from services.thingspeak_fetcher import get_cached_latest
from utils.aqi_calc import get_health_advisory

router = APIRouter(prefix="/api", tags=["live"])


@router.get("/live")
async def live_reading():
    """Return the most recent sensor reading."""
    reading = await get_cached_latest()
    if not reading:
        return {"status": "offline", "message": "No data available yet. Waiting for ThingSpeak."}
    return {**reading, "status": "online"}


@router.get("/advisory")
async def health_advisory():
    """Return health advisory based on current AQI."""
    reading = await get_cached_latest()
    if not reading:
        return {"status": "offline"}
    advisory = get_health_advisory(reading["aqi"], reading.get("source_detected"))
    return {**advisory, "timestamp": reading["timestamp"]}
