# 🌫️ AQMS — Hyper-Local AQI & Pollution Mitigation Dashboard

> **Ward-wise, Real-Time Air Quality Intelligence System with ML-powered Pollution Source Detection,  
> Automated Policy Recommendations & Citizen Health Advisories**

---

## 📋 TABLE OF CONTENTS

1. [What I Analyzed — Project Report Findings](#-what-i-analyzed--project-report-findings)
2. [System Architecture Overview](#-system-architecture-overview)
3. [Hardware Already Built](#-hardware-already-built)
4. [ThingSpeak Integration & Live Data Feed](#-thingspeak-integration--live-data-feed)
5. [Datasets to Integrate](#-datasets-to-integrate)
6. [ML Model Plan](#-ml-model-plan)
7. [Website Architecture](#-website-architecture)
8. [Full Project File Structure](#-full-project-file-structure)
9. [Tech Stack](#-tech-stack)
10. [Implementation Phases (Roadmap)](#-implementation-phases-roadmap)
11. [API Reference](#-api-reference)
12. [Deployment Strategy](#-deployment-strategy)
13. [How to Start Right Now](#-how-to-start-right-now)

---

## 🔍 What I Analyzed — Project Report Findings

### Hardware System (Already Complete ✅)

Your ESP32-based AQMS device is built and working. Here's exactly what it does:

| Component | Model | Measures | Output |
|---|---|---|---|
| Microcontroller | ESP32 (Dual-core, built-in WiFi) | — | WiFi to ThingSpeak |
| PM2.5 Sensor | WINSEN ZPH02 (Laser scattering) | Fine particulate matter | Serial (µg/m³) |
| CO Sensor | MQ-7 | Carbon Monoxide | Analog (PPM) |
| NO2 Sensor | DFRobot MEMS | Nitrogen Dioxide | Analog (PPM) |
| TVOC Sensor | WINSEN ZP07-MP503 | Volatile Organic Compounds | Analog (PPM) |
| Temp/Humidity | DHT22 (AM2302) | Temperature °C, Humidity % | Digital |
| Display | 0.96" OLED SSD1306 | Shows AQI + readings | I2C |
| Power | 3.7V Li-Po + MT3608 Boost (→5V) | Portable | — |
| PCB | Custom KiCAD designed | All integrated | — |

### ThingSpeak Channel (Already Live ✅)

Your device is already sending data to ThingSpeak every **30 seconds**:

```
Channel ID  : 2697383
Write API   : RAYZJW1K4FBNIVP6
```

| ThingSpeak Field | Sensor Data |
|---|---|
| Field 1 | Temperature (°C) |
| Field 2 | Humidity (%) |
| Field 3 | PM2.5 (µg/m³) |
| Field 4 | TVOC (PPM) |
| Field 5 | NO2 (PPM) |
| Field 6 | CO (PPM) |
| Field 7 | Overall AQI (0–500) |

### AQI Calculation Logic (From Your Code)

Your firmware uses **CPCB (Central Pollution Control Board, India) AQI breakpoints**:

| AQI Range | Category | Color Code |
|---|---|---|
| 0 – 50 | Good | 🟢 Green |
| 51 – 100 | Satisfactory | 🟡 Yellow |
| 101 – 200 | Moderate | 🟠 Orange |
| 201 – 300 | Poor | 🔴 Red |
| 301 – 400 | Very Poor | 🟣 Purple |
| 401 – 500 | Severe | 🟤 Maroon |

The AQI is calculated as the **maximum AQI** across PM2.5, CO, and NO2 individually using the standard linear interpolation formula:

```
AQI = ((IHI - ILO) / (BHI - BLO)) × (Cp - BLO) + ILO
```

### What the Report DOES NOT Have (Gaps We Fill)

| Gap in Report | What We Build |
|---|---|
| No ward-wise mapping | Interactive Leaflet map with ward polygons |
| No historical analysis | Time-series charts with 24hr/7-day views |
| No ML model | Pollution source classifier + AQI predictor |
| No health advisory | Automated advisory engine tied to AQI thresholds |
| No admin dashboard | Policy recommendation panel for administrators |
| No multi-device support | Scalable to multiple wards/sensors in DB |
| No mobile-friendly UI | Responsive React dashboard |
| No alerts | Email/SMS alerts via Twilio/Resend when AQI spikes |

---

## 🏗️ System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        HARDWARE LAYER                           │
│   ESP32 + Sensors (PM2.5, CO, NO2, TVOC, DHT22)                │
│   ↓ every 30s via WiFi                                          │
│   ThingSpeak Cloud (Channel 2697383)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST API (every 30s polling)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND LAYER (Python FastAPI)           │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ ThingSpeak   │  │  ML Engine   │  │   Alert Engine      │  │
│  │ Data Fetcher │  │  (Sklearn /  │  │   (Twilio/Email     │  │
│  │  (every 30s) │  │   XGBoost /  │  │    when AQI > 200) │  │
│  └──────┬───────┘  │   LSTM)      │  └─────────────────────┘  │
│         │          └──────┬───────┘                            │
│         ▼                 ▼                                     │
│  ┌────────────────────────────────────────────────────────┐    │
│  │             PostgreSQL / SQLite Database               │    │
│  │   (Stores all historical readings + ward metadata)    │    │
│  └────────────────────────────────────────────────────────┘    │
│         │                                                       │
│  ┌──────▼──────────────────────────────────────────────────┐   │
│  │           REST API + WebSocket endpoints                │   │
│  │  /api/live  /api/history  /api/predict  /api/advisory  │   │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────┬────────────────────────────────────────┘
                         │ WebSocket / REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER (React.js)                  │
│                                                                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Live AQI Map    │  │ Real-time       │  │  Admin Panel   │ │
│  │  (Leaflet.js)    │  │ Charts          │  │  Policy Recs   │ │
│  │  Ward-wise color │  │ (Chart.js)      │  │  & Advisories  │ │
│  └──────────────────┘  └────────────────┘  └────────────────┘ │
│                                                                 │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────────┐ │
│  │  Citizen View    │  │ ML Predictions  │  │ Source         │ │
│  │  Health Advisory │  │ Next 24hr AQI   │  │ Detector Panel │ │
│  │  + Precautions   │  │ (Time Series)   │  │ (Construction/ │ │
│  └──────────────────┘  └────────────────┘  │  Biomass/Fuel) │ │
│                                             └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## ⚙️ Hardware Already Built

You have:
- ✅ Custom PCB with ESP32 + 5 sensors
- ✅ Li-Po battery powered (portable)
- ✅ ThingSpeak live connection (30s updates)
- ✅ Local OLED display

What you may want to add for **ward-level deployment**:
- 📍 A **GPS module** (NEO-6M, ~₹200) to auto-tag each device's location → plug directly into ESP32 serial
- 📶 Optionally: **SIM800L GSM module** as backup if WiFi unavailable in a ward

---

## 📡 ThingSpeak Integration & Live Data Feed

### Reading Live Data from ThingSpeak

ThingSpeak provides a free **REST API** to fetch your channel's live data. No authentication needed for public channels:

```
# Get latest entry (all fields):
GET https://api.thingspeak.com/channels/2697383/feeds/last.json

# Get last 100 entries:
GET https://api.thingspeak.com/channels/2697383/feeds.json?results=100

# Get specific field (e.g., Field 7 = AQI):
GET https://api.thingspeak.com/channels/2697383/field/7/last.json

# Get last 50 entries of PM2.5 (Field 3):
GET https://api.thingspeak.com/channels/2697383/field/3/feeds.json?results=50

# Get data between dates:
GET https://api.thingspeak.com/channels/2697383/feeds.json?start=2026-03-01%2000:00:00&end=2026-03-07%2023:59:59
```

### Sample JSON Response
```json
{
  "channel": {
    "id": 2697383,
    "name": "AQMS",
    "field1": "Temperature",
    "field2": "Humidity",
    "field3": "PM2.5",
    "field4": "TVOC",
    "field5": "NO2",
    "field6": "CO",
    "field7": "AQI"
  },
  "feeds": [
    {
      "created_at": "2026-03-07T10:00:00Z",
      "field1": "28.5",
      "field2": "65.2",
      "field3": "42.1",
      "field4": "12.8",
      "field5": "0.05",
      "field6": "2.3",
      "field7": "98"
    }
  ]
}
```

### Backend Polling Logic (Python)
```python
import httpx
import asyncio

THINGSPEAK_CHANNEL = 2697383
THINGSPEAK_READ_URL = f"https://api.thingspeak.com/channels/{THINGSPEAK_CHANNEL}/feeds/last.json"

async def fetch_live_data():
    async with httpx.AsyncClient() as client:
        response = await client.get(THINGSPEAK_READ_URL)
        data = response.json()
        feed = data["feeds"][0] if data.get("feeds") else data
        return {
            "timestamp":  feed.get("created_at"),
            "temperature": float(feed.get("field1", 0)),
            "humidity":    float(feed.get("field2", 0)),
            "pm25":        float(feed.get("field3", 0)),
            "tvoc":        float(feed.get("field4", 0)),
            "no2":         float(feed.get("field5", 0)),
            "co":          float(feed.get("field6", 0)),
            "aqi":         int(float(feed.get("field7", 0)))
        }

# Poll every 30 seconds and push to WebSocket clients
async def polling_loop():
    while True:
        data = await fetch_live_data()
        await broadcast_to_websockets(data)
        await asyncio.sleep(30)
```

---

## 📊 Datasets to Integrate

### 1. Real-Time (Your Hardware → ThingSpeak)
- Already live at Channel 2697383
- PM2.5, CO, NO2, TVOC, Temp, Humidity, AQI

### 2. Historical Training Data for ML (Open Sources)

| Dataset | Contains | URL | License |
|---|---|---|---|
| **CPCB India AQI Data** | Hourly PM2.5, PM10, NO2, CO, SO2, O3 from 800+ stations across India | https://app.cpcbccr.com/AQI_India/ | Public |
| **OpenAQ API** | Global real-time + historical air quality (includes India) | https://api.openaq.org/v3/ | Open |
| **Kaggle — India Air Quality** | 2015-2020 historical AQI data, city-wise | https://kaggle.com/datasets/rohanrao/air-quality-data-in-india | CC0 |
| **IQAir API** | Real-time global AQI with nearest sensor | https://www.iqair.com/air-pollution-data-api | Free tier available |
| **SAFAR India** | Real-time AQI for major Indian cities (Delhi, Mumbai, Pune, Chennai) | https://safar.tropmet.res.in/ | Public |
| **Sentinel-5P (Copernicus)** | Satellite NO2/CO columns — great for ward-level spatial ML | https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-5p | Open |
| **IMD Weather Data** | Temperature, wind speed, direction, humidity (affects pollution spread) | https://mausam.imd.gov.in/ | Public |
| **OpenWeatherMap API** | Real-time wind, rainfall, humidity (free tier: 60 calls/min) | https://openweathermap.org/api | Free tier |

### 3. Download Strategy for ML Training Data

```bash
# Install OpenAQ Python SDK
pip install openaq

# Download historical India data
from openaq import OpenAQ
client = OpenAQ()
# Get Delhi measurements
measurements = client.measurements.get(
    location_ids=[8118],  # Delhi
    parameter_ids=[2],    # pm25
    date_from="2024-01-01",
    date_to="2025-12-31"
)
```

**Kaggle Dataset command:**
```bash
pip install kaggle
kaggle datasets download -d rohanrao/air-quality-data-in-india
```

---

## 🤖 ML Model Plan

### Model 1: Pollution Source Classifier (Core Innovation)

**Goal:** Detect WHERE the pollution is coming from — construction dust, biomass burning, vehicle exhaust, industrial emissions — automatically.

**Input Features:**
- PM2.5, CO, NO2, TVOC readings
- Temperature, Humidity (affects sensor readings)
- Time of day (hour), Day of week
- Season (monsoon = lower, winter = higher)
- Wind speed/direction (from OpenWeatherMap)

**Source Signatures (Pattern Rules + ML learns these):**

| Source | PM2.5 | CO | NO2 | TVOC | Time Pattern |
|---|---|---|---|---|---|
| Construction Dust | Very High | Low | Low | Low | Daytime (8am-6pm) |
| Biomass Burning | High | Very High | Moderate | High | Evening/Night (6pm-10pm), winter |
| Vehicle Exhaust | Moderate | High | High | Moderate | Rush hours (8-10am, 5-8pm) |
| Industrial Emission | High | High | High | High | Continuous, day |
| Firecrackers (Diwali) | Very High | High | High | Very High | Specific dates, night |
| Background/Natural | Low-Moderate | Low | Low | Low | Any time |

**Algorithm:** `Random Forest Classifier` or `XGBoost` (best for tabular sensor data, interpretable, fast)

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import pandas as pd
import numpy as np
import joblib

# Feature engineering
def prepare_features(df):
    df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
    df['day_of_week'] = pd.to_datetime(df['timestamp']).dt.dayofweek
    df['month'] = pd.to_datetime(df['timestamp']).dt.month
    df['pm25_co_ratio'] = df['pm25'] / (df['co'] + 0.01)     # Construction vs burning
    df['no2_co_ratio'] = df['no2'] / (df['co'] + 0.01)       # Vehicle vs biomass
    df['tvoc_pm25_ratio'] = df['tvoc'] / (df['pm25'] + 0.01) # Biomass burning
    return df

features = ['pm25', 'co', 'no2', 'tvoc', 'temperature', 'humidity',
            'hour', 'day_of_week', 'month',
            'pm25_co_ratio', 'no2_co_ratio', 'tvoc_pm25_ratio']

model = RandomForestClassifier(n_estimators=200, max_depth=15, random_state=42)
model.fit(X_train[features], y_train)  # Labels: 'construction', 'biomass', 'vehicle', etc.
joblib.dump(model, 'models/source_classifier.pkl')
```

### Model 2: AQI Predictor (24-Hour Forecast)

**Goal:** Predict AQI for the next 6/12/24 hours so citizens can plan ahead.

**Algorithm 1 — Quick MVP:** `XGBoost` with lag features (AQI at t-1, t-2, ..., t-12)

```python
import xgboost as xgb

def create_lag_features(df, lags=12):
    for i in range(1, lags+1):
        df[f'aqi_lag_{i}'] = df['aqi'].shift(i)
        df[f'pm25_lag_{i}'] = df['pm25'].shift(i)
    df['rolling_avg_6h'] = df['aqi'].rolling(window=12).mean()  # 6hr avg (12×30s = 6min → scale up)
    df['rolling_std_6h'] = df['aqi'].rolling(window=12).std()
    return df.dropna()

xgb_model = xgb.XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=6)
xgb_model.fit(X_train, y_train)
```

**Algorithm 2 — Advanced:** `LSTM (Long Short-Term Memory)` neural network for time-series

```python
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout

model = Sequential([
    LSTM(128, return_sequences=True, input_shape=(24, 7)),  # 24 timesteps, 7 features
    Dropout(0.2),
    LSTM(64, return_sequences=False),
    Dropout(0.2),
    Dense(32, activation='relu'),
    Dense(1)  # Predict next AQI value
])
model.compile(optimizer='adam', loss='mse', metrics=['mae'])
```

**Algorithm 3 — Facebook Prophet (easiest, great baseline):**
```python
from prophet import Prophet

df_prophet = df.rename(columns={'timestamp': 'ds', 'aqi': 'y'})
m = Prophet(changepoint_prior_scale=0.05)
m.add_regressor('pm25')
m.add_regressor('temperature')
m.fit(df_prophet)

future = m.make_future_dataframe(periods=48, freq='30min')
forecast = m.predict(future)
```

### Model 3: Anomaly Detector (Pollution Spike Alert)

```python
from sklearn.ensemble import IsolationForest

iso_forest = IsolationForest(contamination=0.05, random_state=42)
iso_forest.fit(X_train[['pm25', 'co', 'no2', 'tvoc']])

def detect_anomaly(reading):
    score = iso_forest.predict([[reading['pm25'], reading['co'],
                                 reading['no2'], reading['tvoc']]])[0]
    return score == -1  # -1 means anomaly (pollution spike)
```

### Policy Recommendation Engine

```python
POLICY_RULES = {
    "construction": {
        "threshold_aqi": 150,
        "admin_actions": [
            "Issue stop-work order for construction sites in ward",
            "Deploy water sprinklers at construction sites",
            "Require dust-suppression nets on buildings",
            "Fine violators under Environment Protection Act"
        ],
        "citizen_advice": [
            "Wear N95 mask if going outdoors",
            "Avoid jogging near construction zones",
            "Keep windows closed between 10am-5pm"
        ]
    },
    "vehicle": {
        "threshold_aqi": 200,
        "admin_actions": [
            "Implement odd-even vehicle policy for the ward",
            "Increase public transport frequency",
            "Set up mobile pollution checking camps"
        ],
        "citizen_advice": [
            "Use public transport or carpooling",
            "Avoid outdoor exercise during peak hours",
            "Install air purifier at home"
        ]
    },
    "biomass": {
        "threshold_aqi": 180,
        "admin_actions": [
            "Issue biomass burning ban order",
            "Deploy patrol teams to detect burning sources",
            "Provide alternate disposal methods for waste"
        ],
        "citizen_advice": [
            "Avoid outdoor activities after 6pm",
            "Vulnerable groups (elderly, children, asthma) stay indoors"
        ]
    }
}
```

---

## 🌐 Website Architecture

### Pages & Features

```
/                   → Live Dashboard (AQI Map + Current Readings)
/map                → Full-screen ward-wise AQI heatmap
/analytics          → Historical charts, trends, pollutant breakdown
/predict            → ML prediction panel (next 24hr forecast)
/sources            → Pollution source detection results
/advisory           → Citizen health advisory portal
/admin              → Admin panel (policy recommendations, alerts management)
/about              → About the project + hardware info
```

### Frontend Components (React)

```
src/
├── components/
│   ├── AQIMap/
│   │   ├── WardMap.jsx          # Leaflet map with ward-colored polygons
│   │   ├── SensorMarker.jsx     # ESP32 device location on map
│   │   └── AQILegend.jsx        # Color scale 0–500
│   ├── LiveReadings/
│   │   ├── AQIGauge.jsx         # Large circular AQI meter
│   │   ├── PollutantCard.jsx    # PM2.5, CO, NO2, TVOC individual cards
│   │   └── TemperatureCard.jsx  # Temp + Humidity
│   ├── Charts/
│   │   ├── TimeSeriesChart.jsx  # Historical AQI line chart (Chart.js)
│   │   ├── PollutantRadar.jsx   # Radar chart for pollutant profile
│   │   └── ForecastChart.jsx    # ML prediction overlay
│   ├── MLPanel/
│   │   ├── SourceClassifier.jsx # "Detected: Biomass Burning (87% confidence)"
│   │   ├── AQIPrediction.jsx    # Next 24hr forecast
│   │   └── AnomalyAlert.jsx     # Spike detection banner
│   ├── Advisory/
│   │   ├── HealthAdvisory.jsx   # Color-coded health tips based on AQI
│   │   └── VulnerableGroups.jsx # Children, elderly, asthma patients
│   └── Admin/
│       ├── PolicyPanel.jsx      # Admin policy recommendations
│       ├── AlertManager.jsx     # Configure alert thresholds
│       └── DeviceManager.jsx    # Manage multiple sensors/wards
├── hooks/
│   ├── useThingSpeakData.js     # Polls ThingSpeak every 30s
│   ├── useWebSocket.js          # Real-time updates from backend
│   └── useMLPrediction.js       # Fetch ML predictions from API
├── pages/
│   ├── Dashboard.jsx
│   ├── Analytics.jsx
│   ├── Map.jsx
│   ├── Advisory.jsx
│   └── Admin.jsx
└── utils/
    ├── aqiCalculator.js         # CPCB AQI formula in JS
    ├── colorScale.js            # AQI → hex color
    └── formatters.js            # Unit conversions, date formatting
```

### Backend Structure (Python FastAPI)

```
backend/
├── main.py                      # FastAPI app entry point
├── routers/
│   ├── live.py                  # GET /api/live → latest ThingSpeak data
│   ├── history.py               # GET /api/history?hours=24
│   ├── predict.py               # GET /api/predict → ML prediction
│   ├── sources.py               # GET /api/sources → pollution source
│   └── advisory.py              # GET /api/advisory → health + policy tips
├── services/
│   ├── thingspeak_fetcher.py    # Polls ThingSpeak every 30s
│   ├── database.py              # SQLAlchemy ORM + PostgreSQL/SQLite
│   └── alerting.py              # Twilio SMS / email alerts
├── ml/
│   ├── source_classifier.py     # Pollution source detection
│   ├── aqi_predictor.py         # LSTM/XGBoost AQI forecast
│   ├── anomaly_detector.py      # IsolationForest spike detection
│   └── models/                  # Saved .pkl / .h5 model files
├── utils/
│   ├── aqi_calc.py              # CPCB AQI calculation
│   └── policy_engine.py         # Policy recommendation logic
└── requirements.txt
```

---

## 📁 Full Project File Structure

```
AQMS/
├── 📁 frontend/                 # React.js web app
│   ├── public/
│   │   └── india-wards.geojson  # Ward boundary data for your city
│   ├── src/
│   │   ├── components/          # All React components (listed above)
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   ├── package.json
│   └── vite.config.js
│
├── 📁 backend/                  # FastAPI Python server
│   ├── main.py
│   ├── routers/
│   ├── services/
│   ├── ml/
│   │   └── models/
│   ├── requirements.txt
│   └── .env                     # ThingSpeak keys, DB URL, API keys
│
├── 📁 ml_research/              # Jupyter notebooks for ML development
│   ├── 01_data_exploration.ipynb
│   ├── 02_source_classifier_training.ipynb
│   ├── 03_aqi_forecasting_lstm.ipynb
│   ├── 04_anomaly_detection.ipynb
│   └── data/
│       ├── cpcb_historical.csv
│       ├── openaq_delhi.csv
│       └── thingspeak_export.csv
│
├── 📁 firmware/                 # ESP32 Arduino code (from your report)
│   └── AQMS_firmware.ino        # (Your existing code, reference only)
│
├── 📁 docs/                     # Documentation
│   ├── AQMS Project Report-1.pdf
│   ├── hardware_setup.md
│   └── api_reference.md
│
├── docker-compose.yml           # One-command deployment
├── .env.example
└── README.md                    # This file
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Frontend Framework** | React.js + Vite | Fast, component-based, huge ecosystem |
| **Map** | Leaflet.js + react-leaflet | Free, open-source, works offline, supports GeoJSON wards |
| **Charts** | Chart.js + react-chartjs-2 | Real-time line charts, gauges |
| **UI Components** | TailwindCSS + shadcn/ui | Clean, responsive, easy to customize |
| **Real-time Updates** | WebSocket (FastAPI) | Push data to browser instantly without polling |
| **Backend Framework** | Python FastAPI | Async, fast, auto-generates API docs, type-safe |
| **ML Libraries** | scikit-learn, XGBoost, TensorFlow/Keras, Prophet | Industry standard |
| **Database** | SQLite (dev) → PostgreSQL (prod) | Store all readings, no cloud dependency |
| **IoT Cloud** | ThingSpeak (your existing channel) | Already connected |
| **Deployment Frontend** | Vercel (free tier) | Auto-deploys from GitHub, CDN |
| **Deployment Backend** | Railway.app or Render.com (free tier) | Python FastAPI hosting |
| **Alerts** | Twilio (SMS) or Resend (email) | Free tiers available |
| **Weather Data** | OpenWeatherMap API | Free 60 calls/min tier |
| **Containerization** | Docker + docker-compose | One-command local + prod setup |

---

## 🗓️ Implementation Phases (Roadmap)

### Phase 1: Foundation & Live Data (Week 1) ← START HERE
- [ ] Set up project folder structure
- [ ] Create FastAPI backend with ThingSpeak poller
- [ ] Set up SQLite database to store incoming readings
- [ ] Build React frontend skeleton with Vite
- [ ] Connect frontend to live ThingSpeak data via backend
- [ ] Basic live AQI display card (no map yet)
- [ ] Deploy backend to Railway.app, frontend to Vercel

**Milestone:** Website is live, showing real-time AQI from your hardware ✅

### Phase 2: Dashboard & Maps (Week 2)
- [ ] Integrate Leaflet map with Indian ward boundaries (GeoJSON)
- [ ] Color-code wards by AQI level
- [ ] Historical time-series charts (last 24h/7d/30d)
- [ ] Pollutant breakdown panel (PM2.5, CO, NO2, TVOC)
- [ ] Mobile responsive layout
- [ ] AQI color gauge component

**Milestone:** Full interactive dashboard with ward map ✅

### Phase 3: ML Models (Week 3)
- [ ] Download CPCB/OpenAQ historical data
- [ ] Train pollution source classifier (Random Forest)
- [ ] Train AQI forecaster (XGBoost + Prophet)
- [ ] Train anomaly detector (IsolationForest)
- [ ] Save models as .pkl files
- [ ] Integrate ML predictions into backend API
- [ ] Show ML results on frontend (source panel, forecast chart)

**Milestone:** ML source detection live on dashboard ✅

### Phase 4: Advisory & Admin Panel (Week 4)
- [ ] Build health advisory engine (AQI threshold → tips)
- [ ] Build policy recommendation engine (source → admin actions)
- [ ] Create admin dashboard (login-protected)
- [ ] Implement alert system (email/SMS when AQI > 200)
- [ ] Citizen-facing advisory page
- [ ] Multi-ward support (multiple sensor devices)

**Milestone:** Full DOMAIN 1 platform complete ✅

---

## 📬 API Reference

### Backend Endpoints

```
GET  /api/live                    → Latest sensor reading from ThingSpeak
GET  /api/history?hours=24        → Last N hours of data from DB
GET  /api/history?hours=168       → Last 7 days
GET  /api/predict/aqi?horizon=24  → AQI forecast for next 24 hours
GET  /api/sources/detect          → Current pollution source classification
GET  /api/advisory?aqi=250        → Health + policy advisory for given AQI
GET  /api/wards                   → All ward AQI summary (for map)
POST /api/alerts/subscribe        → Subscribe email/phone for alerts
WS   /ws/live                     → WebSocket: push new reading every 30s
```

### Sample Response: `/api/live`
```json
{
  "timestamp": "2026-03-07T14:30:00Z",
  "ward": "Ward 12 - Sector 5",
  "aqi": 187,
  "category": "Moderate",
  "color": "#FF7E00",
  "pm25": 58.4,
  "co": 3.2,
  "no2": 0.072,
  "tvoc": 18.5,
  "temperature": 29.1,
  "humidity": 62.0,
  "source_detected": "vehicle_exhaust",
  "source_confidence": 0.83,
  "anomaly": false
}
```

---

## 🚀 Deployment Strategy

### Option A: Free & Fully Live (Recommended for Hackathon)

```
Frontend → Vercel.com (free)
             ↑ auto-deploy from GitHub
Backend  → Railway.app OR Render.com (free tier)
              FastAPI + ML models + SQLite
ThingSpeak → Already live (your hardware)

Total cost: ₹0 for demo
```

### Option B: Self-Hosted (Long-term)
```
Single VPS (₹500/month DigitalOcean/Linode)
  ├── Nginx reverse proxy
  ├── Docker container: FastAPI backend
  ├── Docker container: React frontend (built static files)
  └── PostgreSQL database
```

### Deployment Commands

```bash
# Local development (one command using Docker Compose)
docker-compose up --build

# Frontend only
cd frontend && npm run dev

# Backend only
cd backend && uvicorn main:app --reload --port 8000

# Backend with production settings
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## ⚡ How to Start Right Now

### Step 1: Install Prerequisites
```bash
# Node.js (for React frontend)
brew install node

# Python 3.11+
brew install python@3.11

# Or with conda
conda create -n aqms python=3.11
conda activate aqms
```

### Step 2: Test ThingSpeak Connection
```bash
# Verify your hardware is sending data
curl "https://api.thingspeak.com/channels/2697383/feeds/last.json"
```

### Step 3: Create Backend
```bash
mkdir -p AQMS/backend && cd AQMS/backend
pip install fastapi uvicorn httpx sqlalchemy python-dotenv websockets
# Start building from backend/main.py
```

### Step 4: Create Frontend
```bash
cd AQMS
npm create vite@latest frontend -- --template react
cd frontend
npm install
npm install react-leaflet leaflet chart.js react-chartjs-2 axios tailwindcss
```

### Step 5: First Working Version
```bash
# Run backend
cd backend && uvicorn main:app --reload

# Run frontend (separate terminal)
cd frontend && npm run dev

# Open browser
open http://localhost:5173
```

---

## 🌍 Impact Statement

This platform transforms your existing IoT hardware into a **city-scale intelligence system**:

- **Citizens** get real-time, ward-specific AQI + personalized health advisories
- **Administrators** get ML-powered pollution source identification + automated policy recommendations
- **Researchers** get historical time-series data + anomaly records
- **The city** gets a scalable system — add more ESP32 devices for full ward coverage at ~₹1500/ward

The system directly addresses the **Domain 1 requirement**: converting fragmented IoT sensor data into **actionable intelligence at scale** — going beyond city averages to hyper-local, source-specific, ML-driven insights.

---

## 📚 Key References

| Source | Link |
|---|---|
| CPCB AQI Guidelines India | https://app.cpcbccr.com/AQI_India/ |
| ThingSpeak REST API Docs | https://www.mathworks.com/help/thingspeak/read-data-from-channel.html |
| OpenAQ API v3 | https://docs.openaq.org/ |
| India Air Quality Kaggle Dataset | https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india |
| SAFAR India (City AQI) | https://safar.tropmet.res.in/ |
| Sentinel-5P Satellite Data | https://sentinels.copernicus.eu/web/sentinel/missions/sentinel-5p |
| Leaflet.js Docs | https://leafletjs.com/ |
| FastAPI Docs | https://fastapi.tiangolo.com/ |
| XGBoost Docs | https://xgboost.readthedocs.io/ |
| Facebook Prophet | https://facebook.github.io/prophet/ |

---

*Project by AR-B2 SEM-III, IIOT Lab ARA-255 | Guided by Dr. Khyati Chopra*  
*Extended for Urban Solutions Domain — Hyper-Local AQI & Pollution Mitigation Dashboard*
# AQMS
