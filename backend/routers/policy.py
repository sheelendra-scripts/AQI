"""Policy recommendation API endpoint."""
from fastapi import APIRouter, Query
from utils.policy_engine import get_policy_recommendations
from services.thingspeak_fetcher import get_cached_latest

router = APIRouter(prefix="/api", tags=["policy"])


@router.get("/policy")
async def policy_recommendations(
    source: str = Query(None, description="Override source (construction, vehicle, biomass, industrial)"),
    aqi: int = Query(None, ge=0, le=500, description="Override AQI value"),
):
    """Return admin policy recommendations and citizen advice."""
    reading = await get_cached_latest()

    effective_aqi = aqi if aqi is not None else (reading["aqi"] if reading else 100)
    effective_source = source or (reading.get("source_detected") if reading else "unknown") or "unknown"

    return get_policy_recommendations(effective_source, effective_aqi)
