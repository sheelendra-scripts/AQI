# AQMS - Air Quality Monitoring System

> **IoT-Enabled Real-Time Air Quality Intelligence Platform**
> Ward-Level Monitoring | ML Source Detection | Wind-Aware Attribution | Smart Alerts | Policy Recommendations

**Team MechaMinds**

[![Live Demo](https://img.shields.io/badge/Frontend-Vercel-black)](https://aqms-livid.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Render-blue)](https://aqms-backend-ue5x.onrender.com)

---

## Overview

AQMS is a full-stack air quality monitoring platform covering all **250 municipal wards** across **12 MCD zones** of Delhi. It combines IoT sensor hardware (ESP32), cloud data processing (FastAPI), ML models, wind-aware atmospheric context, and an interactive React dashboard to provide real-time pollution intelligence.

**Key Metrics:** 250 wards | 12 zones | 7 configurable alert rules | 72-hour AQI forecast | Wind + plume + source attribution APIs

---

## System Architecture

```
ESP32 + Sensors (PM2.5, CO, NO2, TVOC, DHT22)
       | every 30s via WiFi
       v
ThingSpeak Cloud (Channel 3316545)
       | REST API polling (30s)
       v
FastAPI Backend (Python)
  - ThingSpeak Data Fetcher (live + demo mode)
  - ML Pipeline (RF source, XGBoost forecast, IF anomaly)
  - Wind Service (station cache + interpolation)
  - Atmospheric Layer (trajectory + flow chain)
  - Bayesian-Style Source Attribution
  - Alert Engine (7 rules, 5-min debounce)
  - SQLite Storage (async via SQLAlchemy)
  - WebSocket Broadcast
       | REST + WebSocket
       v
React Frontend (Vite)
  - 10 Interactive Pages
  - Leaflet Ward Map (250 wards)
  - Plume Map (canvas particle simulation)
  - Wind Analysis Page
  - Recharts Visualization
  - Client-side ML Fallback
```

---

## Features

| Feature | Description |
|---|---|
| **Real-Time Dashboard** | Live AQI gauge, 6-metric grid, time-series chart, health advisory |
| **250-Ward Map** | Interactive Leaflet map with zone/ward toggle, color-coded AQI, search |
| **ML Source Detection** | Random Forest classifier identifying vehicle, industrial, construction, biomass, mixed sources |
| **AQI Forecasting** | XGBoost model predicting AQI 1-72 hours ahead with diurnal patterns |
| **Anomaly Detection** | Isolation Forest flagging unusual sensor patterns |
| **Wind Intelligence** | Wind station cache, interpolated wind field, seasonal pattern fallback |
| **Plume + Trajectory APIs** | Backward trajectory, upwind lookup, and zone flow chain endpoints |
| **Source Attribution (Bayesian-style)** | Probabilistic source mix using pollutant fingerprints + temporal + wind context |
| **Smart Alerts** | 7 configurable rules with severity levels and 5-min debounce |
| **Health Advisory** | Population-specific guidance for general public and vulnerable groups |
| **Admin Policy Panel** | Source-specific intervention recommendations for municipal officials |
| **Industrial Source Card** | Z-score spike detection, wind-derived source coordinates, and ranked Zenodo emission grid matches surfaced on ML Insights page |
| **Plume Map** | Interactive Leaflet map with real-time canvas particle simulation showing plume transport from estimated industrial source to selected ward |

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend | FastAPI + Uvicorn | 0.115.0 |
| Database | SQLite + SQLAlchemy (async) | 2.0.35 |
| ML | scikit-learn (RF, IF) + XGBoost | >=1.3, >=2.0 |
| Frontend | React + Vite | 19.2.0 / 7.3.1 |
| Maps | Leaflet + react-leaflet | 1.9.4 / 5.0.0 |
| Charts | Recharts | 3.8.0 |
| Animations | Framer Motion | 12.35.1 |
| IoT | ESP32 + ThingSpeak | Channel 3316545 |
| Deployment | Vercel (frontend) + Render (backend) | - |

---

## Project Structure

```
AQMS/
  backend/
    main.py                  # FastAPI app, CORS, startup, polling loop
    routers/
      live.py                # /api/live, /api/advisory
      history.py             # /api/history
      wards.py               # /api/wards (250 wards + 12 zones)
      ml.py                  # /api/ml/* (source, forecast, anomaly)
      alerts.py              # /api/alerts/* (rules, stats)
      policy.py              # /api/policy
      wind.py                # /api/wind/*
      plume.py               # /api/plume/*
      attribution.py         # /api/attribution/*
    services/
      database.py            # SQLAlchemy async engine + ORM models
      thingspeak_fetcher.py  # ThingSpeak polling + demo mode
      wind_service.py        # Wind station fetch/cache + interpolation
      atmospheric.py         # Trajectory + flow-chain + source-coord utilities
      industrial_sources.py  # Zenodo emission grid loader + Haversine nearest-source
      spike_detector.py      # Z-score spike classification (normal→extreme)
    data/
      industrial_sources.csv # Zenodo Delhi Domain 2020 (807 grid cells)
    ml/
      predictor.py           # ML inference + rule-based fallback
      attribution.py         # Bayesian-style attribution engine
      train_models.py        # Model training script
      models/                # Serialized .pkl files
    requirements.txt
  frontend/
    src/
      pages/                 # 10 pages (Dashboard, Map, Analytics, Advisory, Alerts,
                             #           Admin, ML Insights, Wind, Plume Map, Landing)
      components/            # Includes WardMap, WindOverlay, AttributionPanel
      services/api.js        # API client + ThingSpeak fallback + client-side ML
      hooks/useData.js       # WebSocket + polling hooks
      data/wards.json        # 258-feature GeoJSON (12 zones + 246 wards)
    package.json
  scripts/
    generate_wards.py        # GeoJSON generator for 250 wards
    generate_report.py       # PDF report generator
  AQMS_Project_Report.pdf    # Comprehensive 27-page project report
```

---

## Hardware - IoT Sensor Node

| Component | Model | Measurement |
|---|---|---|
| Microcontroller | ESP32-WROOM-32 | WiFi/BLE, Dual-core 240MHz |
| PM2.5 Sensor | WINSEN ZPH02 (laser) | 0-1000 ug/m3 |
| CO Sensor | MQ-7 | 20-2000 ppm |
| NO2 Sensor | DFRobot MEMS | 0-5 ppm |
| TVOC Sensor | WINSEN ZP07-MP503 | 0-50 ppm |
| Temp/Humidity | DHT22 | -40 to 80C, 0-100% |
| Display | SSD1306 OLED 0.96" | 128x64 px |
| Power | 3.7V LiPo + MT3608 boost | ~8h runtime |

**Estimated cost per node: INR 5,200**

---

## ML Models

### 1. Pollution Source Classifier
- **Algorithm:** Random Forest (150 trees, max_depth=12)
- **Classes:** vehicle, industrial, construction, biomass, mixed
- **Features:** pm25, co, no2, tvoc, temperature, humidity, hour, pm25/co ratio, tvoc/no2 ratio
- **Fallback:** Rule-based detection (client-side + server-side) when model unavailable

### 2. AQI Forecaster
- **Algorithm:** XGBoost Regressor (200 rounds, lr=0.08)
- **Output:** Hourly AQI predictions for 1-72 hours
- **Features:** hour, day_of_week, pollutants, temperature, humidity, lag features (1h/3h/6h)

### 3. Anomaly Detector
- **Algorithm:** Isolation Forest (150 trees, contamination=0.05)
- **Output:** is_anomaly flag + anomaly_score (0-1)

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/live` | Latest sensor reading |
| GET | `/api/advisory` | Health advisory for current AQI |
| GET | `/api/history?hours=24` | Historical readings |
| GET | `/api/wards` | All 258 zone+ward readings |
| GET | `/api/wards/{ward_id}` | Single ward reading |
| GET | `/api/ml/source` | ML source classification |
| GET | `/api/ml/forecast?horizon=24` | AQI forecast |
| GET | `/api/ml/anomaly` | Anomaly detection |
| GET | `/api/ml/summary` | Combined ML analysis |
| GET | `/api/alerts` | Alert history |
| GET | `/api/alerts/rules` | Alert rules |
| GET | `/api/policy?source=vehicle` | Policy recommendations |
| GET | `/api/wind/current` | Station wind snapshot |
| GET | `/api/wind/field?grid_size=12` | Interpolated wind vector field |
| GET | `/api/wind/history?hours=24` | Wind history snapshots |
| GET | `/api/wind/at?lat=...&lon=...` | Wind at a specific point |
| GET | `/api/wind/upwind/{ward_id}` | Upwind wards for target ward |
| GET | `/api/wind/seasonal` | Seasonal wind profile metadata |
| GET | `/api/plume/trajectory/{ward_id}?hours=3` | Backward trajectory from ward |
| GET | `/api/plume/upwind/{ward_id}` | Upwind wards via plume context |
| GET | `/api/plume/flow-chain/{zone_id}` | Wind flow order within zone |
| GET | `/api/plume/industrial-source/{ward_id}` | Spike detection + Zenodo industrial source match + Gaussian plume concentration |
| GET | `/api/attribution/ward/{ward_id}` | Full ward source attribution |
| GET | `/api/attribution/zone/{zone_id}` | Zone-level source attribution |
| GET | `/api/attribution/city` | City-wide source contribution summary |
| GET | `/api/health` | Backend health check |
| WS | `/ws/live` | Real-time WebSocket feed |

---

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables
```bash
# Backend (.env)
DEMO_MODE=auto          # auto | true | false
DATABASE_URL=sqlite+aiosqlite:///./aqms.db
THINGSPEAK_CHANNEL_ID=3316545
THINGSPEAK_READ_API_KEY=your_thingspeak_read_key
OWM_API_KEY=            # optional: real weather API (falls back to simulated seasonal wind if empty)

# Frontend (Vercel or .env)
VITE_API_URL=https://your-backend.onrender.com
```

---

## Deployment

### Current Production Setup

- **Live URL:** https://hackdata.rajatrulaniya.com
- **Server:** AWS EC2 (`t3.small`)
- **Container Orchestration:** `docker-compose` for frontend + backend services

### CI/CD Pipeline (GitHub Actions)

- Pipeline file: `.github/workflows/cicd.yaml`
- Trigger: every push to `main`
- Workflow actions:
  - Builds frontend and backend Docker images
  - Pushes images to Docker Hub (`latest` + run-number tags)
  - Connects to EC2 over SSH and runs `docker compose pull` + `docker compose up -d`
- Outcome: deployments are automated on every push with no manual server steps.

### Reverse Proxy and TLS

- Root `nginx.conf` acts as reverse proxy in front of containers.
- HTTP (`:80`) traffic is redirected to HTTPS.
- HTTPS (`:443`) is terminated at Nginx with Let's Encrypt SSL/TLS certificates.
- Request routing:
  - `/` -> frontend container (`127.0.0.1:3000`)
  - `/api/` -> backend container (`127.0.0.1:8000`)
  - `/ws/` -> backend WebSocket endpoint

### Frontend Image Optimization

- `frontend/Dockerfile` uses a multi-stage build:
  - Stage 1 (`node:20-alpine`) compiles the Vite app
  - Stage 2 (`nginx:stable-alpine`) serves only built static assets
- Benefit: smaller production image size and faster deployment/pull times.

### Dynamic Configuration Handling

- `frontend/entrypoint.sh` injects runtime config into `/usr/share/nginx/html/config.js` using:
  - `BACKEND_HOST`
  - `BACKEND_PORT`
- This avoids React build-time API URL hardcoding and keeps the frontend image environment-agnostic.
- In `docker-compose.yml`, these variables are set at runtime, so the same image can be reused across environments without rebuilding.

---

## Hackdata Research Pipeline Integration

The `hackdata backend/` directory contains a standalone research analysis script that extends AQMS with a real-data industrial attribution pipeline. Its core capabilities have been integrated into the FastAPI backend.

### What Was Integrated

| Capability | hackdata Source | Integrated As |
|---|---|---|
| Zenodo Delhi industrial emissions grid | `DelhiDomain_2020.shp` | `backend/data/industrial_sources.csv` + `backend/services/industrial_sources.py` |
| Z-score pollution spike detection | `main.py §5` | `backend/services/spike_detector.py` |
| Wind-based source coordinate estimation | `main.py §6–7` | `backend/services/atmospheric.py → estimate_source_coordinates()` |
| Gaussian plume + industrial source match | `main.py §11–13` | `backend/routers/plume.py → /api/plume/industrial-source/{ward_id}` |

### New Endpoint: `/api/plume/industrial-source/{ward_id}`

Full pipeline in a single request:

```
Ward sensor reading
    │ Z-score vs. population baseline
    ▼
Spike event detection (is_spike + severity + z_score)
    │ current wind (speed + direction)
    ▼
Estimate upwind source coordinates
(project ward location backwards along wind vector)
    │
    ▼
Query Zenodo industrial emissions grid
(808 grid cells — PM2.5, PM10, NOx, SO2, CO, VOC)
    │ distance to nearest N grid cells
    ▼
Gaussian Plume model (Pasquill-Gifford stability classes A–F)
per matched industrial source
    │
    ▼
Response: spike flag + estimated source lat/lon + ranked
          industrial sources + plume concentration estimates
```

**Query parameters:**
- `transport_hours` (0.25–6.0, default 1.0) — assumed pollution travel time
- `top_sources` (1–5, default 3) — number of industrial sources to return

### Data Sources Used

| Dataset | Description |
|---|---|
| Zenodo Delhi Domain 2020 | Gridded industrial emission inventory for Delhi, covering PM2.5, PM10, NOx, SO2, CO, VOC per 0.01° grid cell |
| Open-Meteo Archive API | Hourly historical wind data used to validate the pipeline (2020–2024) |

### Roadmap for Further Integration

- [ ] **Historical spike timeline** — store detected spike events in SQLite and expose `/api/spikes/history`
- [ ] **Real-time Open-Meteo wind** — replace or augment OWM station data with Open-Meteo current conditions
- [x] **Frontend: Industrial source layer** — `IndustrialSourceCard` on ML Insights page surfaces spike status, wind, estimated source coords, and ranked Zenodo grid matches with plume bars
- [x] **Plume Map page** — new `/plume` route with interactive Leaflet map + canvas particle animation simulating plume transport from estimated industrial source to selected ward
- [ ] **Automated spike alerts** — trigger WebSocket alert when Z-score > 3 during polling loop
- [ ] **Multi-ward spike correlation** — detect coordinated spikes across adjacent wards to identify zone-level events

---

## Ward Coverage

12 MCD zones with distinct pollution profiles:

| Zone | Profile | Wards | PM2.5 Base |
|---|---|---|---|
| Central | vehicle | 15 | 160 |
| South | vehicle | 41 | 160 |
| Shahdara North | industrial | 27 | 220 |
| Shahdara South | mixed | 33 | 140 |
| City SP | mixed | 8 | 140 |
| Civil Lines | clean | 16 | 90 |
| Karol Bagh | vehicle | 18 | 160 |
| Najafgarh | biomass | 33 | 200 |
| Narela | biomass | 17 | 200 |
| Rohini | construction | 23 | 250 |
| West | construction | 14 | 250 |
| Keshavpuram | vehicle | 1 | 160 |

---

## Alert Rules

| Rule | Metric | Threshold | Severity |
|---|---|---|---|
| Severe AQI | AQI | > 400 | critical |
| Very Poor AQI | AQI | > 300 | critical |
| Poor AQI | AQI | > 200 | warning |
| Moderate AQI | AQI | > 150 | info |
| High PM2.5 | PM2.5 | > 120 ug/m3 | warning |
| Severe PM2.5 | PM2.5 | > 250 ug/m3 | critical |
| High CO | CO | > 6.0 ppm | critical |

---

## Documentation

- **Hardware Report:** [HARDWARE REPORT.pdf](HARDWARE%20REPORT.pdf) — Circuit design, sensor specs, ESP32 node, PCB layout
- **Hardware + Software Report:** [HARDWARE + SOFTWARE REPORT.pdf](HARDWARE%20+%20SOFTWARE%20REPORT.pdf) — Complete system documentation covering hardware, backend, ML models, frontend, and deployment
- **API Docs:** FastAPI auto-generated at `/docs` (Swagger UI)

---

## Team MechaMinds

Air Quality Monitoring & Management

---

*Built with ESP32, FastAPI, React, scikit-learn, XGBoost, Leaflet, and Recharts*
