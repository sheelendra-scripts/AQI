"""Industrial Emissions Source Service.

Loads the pre-processed Zenodo Delhi Domain 2020 industrial emissions CSV
(extracted from DelhiDomain_2020.shp) and provides nearest-source queries
using Haversine distance.

No geopandas required — CSV was pre-extracted in the hackdata pipeline.

Columns:
    POINT_X    — longitude
    POINT_Y    — latitude
    PM25_INDDD — industrial PM2.5 emission (tons/day per grid cell)
    PM10_INDDD — industrial PM10
    NOx_INDDD  — industrial NOx
    SO2_INDDD  — industrial SO2
    CO_INDDD   — industrial CO
    VOC_INDDD  — industrial VOC
"""

import math
import os
import logging
from typing import List, Optional

import pandas as pd

logger = logging.getLogger("aqms.industrial_sources")

_DATA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "industrial_sources.csv")

_df: Optional[pd.DataFrame] = None


def _load() -> pd.DataFrame:
    global _df
    if _df is not None:
        return _df
    if not os.path.exists(_DATA_PATH):
        logger.warning(f"Industrial sources CSV not found at {_DATA_PATH}")
        _df = pd.DataFrame(columns=["POINT_X", "POINT_Y", "PM25_INDDD", "PM10_INDDD",
                                     "NOx_INDDD", "SO2_INDDD", "CO_INDDD", "VOC_INDDD"])
        return _df
    _df = pd.read_csv(_DATA_PATH)
    logger.info(f"Loaded {len(_df)} industrial emission grid cells from Zenodo dataset")
    return _df


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return Haversine distance in metres."""
    R = 6_371_000.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_nearest_sources(lat: float, lon: float, top_n: int = 3) -> List[dict]:
    """Return the top_n nearest industrial emission grid cells to the given coordinate.

    Args:
        lat: Receptor / estimated-source latitude
        lon: Receptor / estimated-source longitude
        top_n: Number of nearest sources to return (max 10)

    Returns:
        List of dicts with distance_m, lat, lon, and emission fields.
    """
    df = _load()
    if df.empty:
        return []

    top_n = min(top_n, 10)

    df = df.copy()
    df["distance_m"] = df.apply(
        lambda row: _haversine_m(lat, lon, row["POINT_Y"], row["POINT_X"]),
        axis=1,
    )

    nearest = df.nsmallest(top_n, "distance_m")

    results = []
    for _, row in nearest.iterrows():
        results.append({
            "lat": round(float(row["POINT_Y"]), 4),
            "lon": round(float(row["POINT_X"]), 4),
            "distance_m": round(float(row["distance_m"]), 1),
            "pm25_emission": round(float(row.get("PM25_INDDD", 0)), 4),
            "pm10_emission": round(float(row.get("PM10_INDDD", 0)), 4),
            "nox_emission": round(float(row.get("NOx_INDDD", 0)), 4),
            "so2_emission": round(float(row.get("SO2_INDDD", 0)), 4),
            "co_emission": round(float(row.get("CO_INDDD", 0)), 4),
            "voc_emission": round(float(row.get("VOC_INDDD", 0)), 4),
        })
    return results


def get_source_count() -> int:
    """Return the number of industrial source grid cells loaded."""
    return len(_load())
