import requests
import pandas as pd
import numpy as np
import os
import geopandas as gpd
import matplotlib.pyplot as plt
from shapely.geometry import Point

# --------------------------------------------------
# 1. Download Wind Data (or load cached CSV)
# --------------------------------------------------

def download_wind_data(lat, lon, start, end, filename="delhi_wind_data.csv"):
    if os.path.exists(filename):
        print("Wind data already exists. Loading from CSV...")
        return pd.read_csv(filename, parse_dates=["datetime"])

    print("Downloading wind data from Open-Meteo...")
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "hourly": [
            "windspeed_10m",
            "winddirection_10m",
            "temperature_2m",
            "relativehumidity_2m"
        ],
        "timezone": "Asia/Kolkata",
        "windspeed_unit": "ms"
    }

    response = requests.get(url, params=params)
    response.raise_for_status()
    data = response.json()

    df = pd.DataFrame({
        "datetime": data["hourly"]["time"],
        "wind_speed": data["hourly"]["windspeed_10m"],
        "wind_direction": data["hourly"]["winddirection_10m"],
        "temperature": data["hourly"]["temperature_2m"],
        "humidity": data["hourly"]["relativehumidity_2m"]
    })
    df["datetime"] = pd.to_datetime(df["datetime"])
    df.to_csv(filename, index=False)
    print("Wind data saved to CSV.")
    return df


wind_df = download_wind_data(
    lat=28.6139,
    lon=77.2090,
    start="2020-01-01",
    end="2024-01-01"
)

# --------------------------------------------------
# 2. Convert Wind Direction → Vector Components
# --------------------------------------------------

def wind_to_vector(speed, direction):
    rad = np.radians(direction)
    u = -speed * np.sin(rad)
    v = -speed * np.cos(rad)
    return u, v

wind_df["u"], wind_df["v"] = zip(
    *wind_df.apply(
        lambda row: wind_to_vector(row["wind_speed"], row["wind_direction"]),
        axis=1
    )
)
print("\nWind vector conversion complete")
print(wind_df.head())

# --------------------------------------------------
# 3. Generate Synthetic Delhi Pollution Data
# --------------------------------------------------

def generate_demo_sensor_data(wind_df):
    np.random.seed(42)
    sensor_df = pd.DataFrame()
    sensor_df["datetime"] = wind_df["datetime"]
    sensor_df["pm25"] = np.clip(np.random.normal(180, 80, len(wind_df)), 40, 400)
    sensor_df["co"] = np.clip(np.random.normal(2, 0.8, len(wind_df)), 0.5, 5)
    sensor_df["no2"] = np.clip(np.random.normal(60, 25, len(wind_df)), 20, 120)
    sensor_df["tvoc"] = np.clip(np.random.normal(400, 150, len(wind_df)), 100, 800)
    sensor_df["lat"] = 28.6139
    sensor_df["lon"] = 77.2090
    return sensor_df

sensor_df = generate_demo_sensor_data(wind_df)
print("\nSynthetic pollution data generated")
print(sensor_df.head())

# --------------------------------------------------
# 4. Merge Pollution + Wind Data
# --------------------------------------------------

combined_df = pd.merge(sensor_df, wind_df, on="datetime", how="inner")
print("\nMerged dataset")
print(combined_df.head())

# --------------------------------------------------
# 5. Detect Pollution Spikes (Z-score)
# --------------------------------------------------

mean_pm = combined_df["pm25"].mean()
std_pm = combined_df["pm25"].std()
combined_df["z_score"] = (combined_df["pm25"] - mean_pm) / std_pm
combined_df["pollution_event"] = combined_df["z_score"] > 2
print("\nPollution spike detection complete")
print(f"Total spike events: {combined_df['pollution_event'].sum()}")

# --------------------------------------------------
# 6. Estimate Pollution Travel Distance
# --------------------------------------------------

combined_df["travel_distance_km"] = (combined_df["wind_speed"] * 3600) / 1000

# --------------------------------------------------
# 7. Estimate Source Coordinates
# --------------------------------------------------

def estimate_source(lat, lon, wind_dir, distance_km):
    rad = np.radians(wind_dir)
    dlat = (distance_km * np.cos(rad)) / 111
    dlon = (distance_km * np.sin(rad)) / (111 * np.cos(np.radians(lat)))
    return lat + dlat, lon + dlon

combined_df["source_lat"], combined_df["source_lon"] = zip(
    *combined_df.apply(
        lambda row: estimate_source(
            row["lat"], row["lon"],
            row["wind_direction"], row["travel_distance_km"]
        ),
        axis=1
    )
)
print("\nSource estimation complete")
print(combined_df[["datetime", "pm25", "wind_speed", "wind_direction", "source_lat", "source_lon"]].head())

# --------------------------------------------------
# 8. Extract Pollution Spike Events
# --------------------------------------------------

events = combined_df[combined_df["pollution_event"]].copy()
print(f"\nNumber of pollution spike events: {len(events)}")

# --------------------------------------------------
# 9. Load Industrial Emission Sources from Zenodo
# --------------------------------------------------

print("\nLoading Zenodo industrial emissions shapefile...")
emissions = gpd.read_file("DelhiDomain_2020.shp")

industrial = emissions[[
    "POINT_X", "POINT_Y",
    "PM25_INDDD", "PM10_INDDD",
    "NOx_INDDD", "SO2_INDDD",
    "CO_INDDD", "VOC_INDDD"
]].copy()

# Keep only grid cells with actual industrial emissions
industrial = industrial[industrial["PM25_INDDD"] > 0].reset_index(drop=True)
print(f"Industrial emission grid cells found: {len(industrial)}")
print(industrial[["PM25_INDDD", "NOx_INDDD", "SO2_INDDD"]].describe())

# --------------------------------------------------
# 10. Pasquill-Gifford Atmospheric Stability Class
# --------------------------------------------------

def get_stability_class(solar_radiation: float, wind_speed: float) -> str:
    if wind_speed < 2:
        if solar_radiation > 600:   return 'A'
        elif solar_radiation > 300: return 'B'
        elif solar_radiation > 50:  return 'C'
        else:                       return 'F'
    elif wind_speed < 5:
        if solar_radiation > 600:   return 'B'
        elif solar_radiation > 300: return 'C'
        elif solar_radiation > 50:  return 'D'
        else:                       return 'E'
    else:
        return 'D'

def get_sigma_z(stability_class: str, distance_m: float) -> float:
    coefficients = {
        'A': 0.22, 'B': 0.16, 'C': 0.11,
        'D': 0.08, 'E': 0.06, 'F': 0.04
    }
    a = coefficients[stability_class]
    return a * distance_m * (1 + 0.0001 * distance_m) ** -0.5

# --------------------------------------------------
# 11. Gaussian Plume Concentration Estimate
# --------------------------------------------------

def gaussian_plume(Q, u, sigma_y, sigma_z, y, z, H=30):
    """
    Q     : emission rate (g/s)
    u     : wind speed (m/s)
    sigma_y, sigma_z : dispersion coefficients (m)
    y     : crosswind distance (m)
    z     : height of receptor (m), usually 1.5m (breathing level)
    H     : effective stack height (m)
    Returns concentration in g/m³
    """
    if u < 0.5:
        u = 0.5  # avoid division by zero for calm winds
    term1 = Q / (2 * np.pi * sigma_y * sigma_z * u)
    term2 = np.exp(-y**2 / (2 * sigma_y**2))
    term3 = np.exp(-(z - H)**2 / (2 * sigma_z**2)) + np.exp(-(z + H)**2 / (2 * sigma_z**2))
    return term1 * term2 * term3

# --------------------------------------------------
# 12. Find Nearest Industrial Source to Spike Events
# --------------------------------------------------

def find_nearest_industrial_source(source_lat, source_lon, industrial_df, top_n=3):
    df = industrial_df.copy()
    df["distance"] = df.apply(
        lambda row: Point(source_lon, source_lat).distance(
            Point(row["POINT_X"], row["POINT_Y"])
        ) * 111000,  # convert degrees to meters approx
        axis=1
    )
    return df.nsmallest(top_n, "distance")[
        ["POINT_X", "POINT_Y", "PM25_INDDD", "NOx_INDDD", "SO2_INDDD", "distance"]
    ]

# --------------------------------------------------
# 13. Full Pipeline: Match Spike Events → Industrial Sources → Plume
# --------------------------------------------------

print("\n--- Matching Spike Events to Industrial Sources + Plume Model ---")

# Use average daytime solar radiation for Delhi (W/m²)
SOLAR_RADIATION = 400

results = []

for idx, event in events.head(10).iterrows():
    stability = get_stability_class(SOLAR_RADIATION, event["wind_speed"])
    nearest = find_nearest_industrial_source(
        event["source_lat"], event["source_lon"], industrial
    )

    top_source = nearest.iloc[0]
    distance_m = top_source["distance"]

    sigma_y = get_sigma_z(stability, distance_m) * 1.5  # approx sigma_y
    sigma_z = get_sigma_z(stability, distance_m)

    # Q in g/s — convert daily emission (tons/day assumed) to g/s
    Q = top_source["PM25_INDDD"] * 1e6 / 86400

    concentration = gaussian_plume(
        Q=Q,
        u=event["wind_speed"],
        sigma_y=sigma_y,
        sigma_z=sigma_z,
        y=0,       # directly downwind
        z=1.5,     # breathing height
        H=30       # typical industrial stack height Delhi
    )

    results.append({
        "datetime": event["datetime"],
        "measured_pm25": round(event["pm25"], 2),
        "wind_speed": round(event["wind_speed"], 2),
        "wind_direction": round(event["wind_direction"], 1),
        "stability_class": stability,
        "nearest_source_lat": round(top_source["POINT_Y"], 4),
        "nearest_source_lon": round(top_source["POINT_X"], 4),
        "source_industrial_pm25": round(top_source["PM25_INDDD"], 4),
        "distance_to_source_m": round(distance_m, 1),
        "plume_concentration_gm3": round(concentration, 6),
        "sigma_z": round(sigma_z, 2)
    })

    print(f"\n[{event['datetime']}]")
    print(f"  Measured PM2.5     : {event['pm25']:.1f} µg/m³")
    print(f"  Stability Class    : {stability}")
    print(f"  Nearest Industrial : ({top_source['POINT_Y']:.4f}, {top_source['POINT_X']:.4f})")
    print(f"  Distance           : {distance_m:.0f} m")
    print(f"  Plume Conc. Est.   : {concentration:.6f} g/m³")

# --------------------------------------------------
# 14. Visualizations
# --------------------------------------------------

print("\nGenerating maps and plots...")

fig, axes = plt.subplots(1, 3, figsize=(20, 7))

# Industrial PM2.5 heatmap
emissions.plot(column="PM25_INDDD", cmap="Reds", legend=True, ax=axes[0])
axes[0].set_title("Industrial PM2.5 Emissions\nDelhi 2020 (Zenodo)")
axes[0].set_xlabel("Longitude")
axes[0].set_ylabel("Latitude")

# Total emissions
emissions.plot(column="PM25_DD", cmap="OrRd", legend=True, ax=axes[1])
axes[1].set_title("Total PM2.5 Emissions\n(All Sources)")
axes[1].set_xlabel("Longitude")

# Industrial NOx
emissions.plot(column="NOx_INDDD", cmap="Blues", legend=True, ax=axes[2])
axes[2].set_title("Industrial NOx Emissions\nDelhi 2020")
axes[2].set_xlabel("Longitude")

plt.tight_layout()
plt.savefig("delhi_emissions_map.png", dpi=150)
print("Saved: delhi_emissions_map.png")

# PM2.5 time series with spike events highlighted
fig2, ax = plt.subplots(figsize=(14, 5))
combined_df["pm25"].plot(ax=ax, color="steelblue", alpha=0.6, label="PM2.5")
spikes = combined_df[combined_df["pollution_event"]]
ax.scatter(spikes.index, spikes["pm25"], color="red", s=10, label="Spike Events", zorder=5)
ax.set_title("Delhi PM2.5 with Detected Pollution Spikes")
ax.set_ylabel("PM2.5 (µg/m³)")
ax.legend()
plt.tight_layout()
plt.savefig("pm25_spikes.png", dpi=150)
print("Saved: pm25_spikes.png")

# --------------------------------------------------
# 15. Save All Results
# --------------------------------------------------

results_df = pd.DataFrame(results)
results_df.to_csv("spike_source_plume_results.csv", index=False)
events.to_csv("estimated_sources.csv", index=False)
industrial.to_csv("industrial_sources.csv", index=False)

print("\n--- All files saved ---")
print("spike_source_plume_results.csv  — spike events matched to sources with plume estimates")
print("estimated_sources.csv           — all spike events with wind-based source coordinates")
print("industrial_sources.csv          — all industrial emission grid cells from Zenodo")
print("delhi_emissions_map.png         — emission heatmaps")
print("pm25_spikes.png                 — PM2.5 time series with spikes")
print("\nPipeline complete.")