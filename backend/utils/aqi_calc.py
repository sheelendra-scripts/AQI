"""AQI calculation using CPCB India breakpoints — mirrors ESP32 firmware logic."""

# CPCB AQI Breakpoints: [C_low, C_high, I_low, I_high]
PM25_BREAKPOINTS = [
    (0, 30, 0, 50),
    (31, 60, 51, 100),
    (61, 90, 101, 200),
    (91, 120, 201, 300),
    (121, 250, 301, 400),
    (251, 500, 401, 500),
]

NO2_BREAKPOINTS = [
    (0, 40, 0, 50),
    (41, 80, 51, 100),
    (81, 180, 101, 200),
    (181, 280, 201, 300),
    (281, 400, 301, 400),
    (401, 500, 401, 500),
]

CO_BREAKPOINTS = [
    (0, 1.0, 0, 50),
    (1.1, 2.0, 51, 100),
    (2.1, 10.0, 101, 200),
    (10.1, 17.0, 201, 300),
    (17.1, 34.0, 301, 400),
    (34.1, 500.0, 401, 500),
]

AQI_CATEGORIES = [
    (0, 50, "Good", "#55a049"),
    (51, 100, "Satisfactory", "#a3c853"),
    (101, 200, "Moderate", "#fff44f"),
    (201, 300, "Poor", "#f29c33"),
    (301, 400, "Very Poor", "#e93f33"),
    (401, 500, "Severe", "#af2d24"),
]

CO_PPM_TO_MG = 1.131  # Conversion factor for AQI calc (matches ESP32 code)


def _linear_aqi(concentration: float, breakpoints: list) -> int:
    """Standard EPA/CPCB linear interpolation."""
    for c_lo, c_hi, i_lo, i_hi in breakpoints:
        if c_lo <= concentration <= c_hi:
            return int(((i_hi - i_lo) / (c_hi - c_lo)) * (concentration - c_lo) + i_lo)
    return 0


def calculate_aqi(pm25: float, co_ppm: float, no2_ppm: float) -> int:
    """Compute overall AQI = max of sub-indices (matches firmware)."""
    aqi_pm25 = _linear_aqi(pm25, PM25_BREAKPOINTS)
    aqi_co = _linear_aqi(co_ppm * CO_PPM_TO_MG, CO_BREAKPOINTS)
    aqi_no2 = _linear_aqi(no2_ppm, NO2_BREAKPOINTS)
    return max(aqi_pm25, aqi_co, aqi_no2)


def get_aqi_category(aqi: int) -> dict:
    """Return category name and color for a given AQI."""
    for lo, hi, name, color in AQI_CATEGORIES:
        if lo <= aqi <= hi:
            return {"category": name, "color": color}
    return {"category": "Severe", "color": "#af2d24"}


def get_health_advisory(aqi: int, source: str = None) -> dict:
    """Generate health advisory for citizens based on AQI & detected source."""
    base = {
        "aqi": aqi,
        **get_aqi_category(aqi),
        "general": [],
        "vulnerable": [],
        "outdoor_safe": True,
        "mask_recommended": False,
    }

    if aqi <= 50:
        base["general"] = ["Air quality is excellent. Enjoy outdoor activities!"]
        base["vulnerable"] = ["No precautions needed."]
    elif aqi <= 100:
        base["general"] = ["Air quality is acceptable.", "Unusually sensitive people should limit prolonged outdoor exertion."]
        base["vulnerable"] = ["People with respiratory conditions may experience mild discomfort."]
    elif aqi <= 200:
        base["general"] = ["Reduce prolonged outdoor exertion.", "Keep windows closed during peak hours."]
        base["vulnerable"] = ["Children, elderly, and asthmatics should limit outdoor activity.", "Use air purifiers indoors."]
        base["mask_recommended"] = True
    elif aqi <= 300:
        base["general"] = ["Avoid outdoor exercise.", "Wear N95 mask if going outside.", "Keep all windows shut."]
        base["vulnerable"] = ["Stay indoors. Use air purifier.", "Keep emergency medications accessible."]
        base["outdoor_safe"] = False
        base["mask_recommended"] = True
    else:
        base["general"] = ["HEALTH EMERGENCY — Stay indoors.", "Wear N95 mask if outdoor exposure is unavoidable.",
                           "Avoid all physical exertion outdoors."]
        base["vulnerable"] = ["Do not go outdoors under any circumstances.", "Seek medical help if experiencing breathing difficulty."]
        base["outdoor_safe"] = False
        base["mask_recommended"] = True

    # Source-specific advice
    if source == "construction":
        base["general"].append("Construction dust detected — avoid areas near building sites.")
    elif source == "biomass":
        base["general"].append("Biomass burning detected — avoid areas with smoke or haze.")
    elif source == "vehicle":
        base["general"].append("Vehicle exhaust is primary source — avoid busy roads.")

    return base
