"""Historical data API endpoint."""
from fastapi import APIRouter, Query
from services.thingspeak_fetcher import get_history, get_thingspeak_history

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history")
async def history(
    hours: int = Query(24, ge=1, le=720, description="Hours of history to fetch"),
    ward_id: str = Query("ward_01", description="Ward identifier"),
):
    """Return historical readings from local DB."""
    data = await get_history(hours=hours, ward_id=ward_id)
    if not data:
        # Fallback: fetch directly from ThingSpeak
        data = await get_thingspeak_history(results=min(hours * 2, 800))
    return {"count": len(data), "hours": hours, "data": data}


@router.get("/history/thingspeak")
async def thingspeak_raw(results: int = Query(100, ge=1, le=8000)):
    """Fetch raw historical data straight from ThingSpeak API."""
    data = await get_thingspeak_history(results=results)
    return {"count": len(data), "data": data}
