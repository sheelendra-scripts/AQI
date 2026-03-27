# 🏠 Run AQMS Locally — Complete Setup Guide

> Step-by-step instructions to run the **Air Quality Monitoring System** (backend + frontend) on your local machine.

---

## 📋 Prerequisites

Ensure the following are installed on your system before proceeding:

| Tool | Minimum Version | Check Command | Download |
|---|---|---|---|
| **Python** | 3.9+ | `python --version` | [python.org](https://www.python.org/downloads/) |
| **pip** | 21+ | `pip --version` | Included with Python |
| **Node.js** | 18+ | `node --version` | [nodejs.org](https://nodejs.org/) |
| **npm** | 9+ | `npm --version` | Included with Node.js |
| **Git** | 2.30+ | `git --version` | [git-scm.com](https://git-scm.com/) |

> [!NOTE]
> No external database server (PostgreSQL, MySQL, etc.) needs to be installed. This project uses **SQLite**, which is file-based and requires zero setup.

---

## 🗄️ Database Information

### Database Engine: **SQLite** (via `aiosqlite` + `SQLAlchemy Async`)

AQMS uses **SQLite** as its database — a lightweight, serverless, file-based relational database. It requires **no separate installation or configuration**.

#### Key Details

| Property | Value |
|---|---|
| **Engine** | SQLite 3 |
| **Python Driver** | `aiosqlite` (async SQLite driver) |
| **ORM** | SQLAlchemy 2.0 (async mode) |
| **Database File** | `backend/aqms.db` (auto-created on first run) |
| **Connection URL** | `sqlite+aiosqlite:///./aqms.db` |

#### Database Tables

The database is auto-initialized on application startup via `init_db()` in `services/database.py`. No manual migration is needed.

**Table: `sensor_readings`**

| Column | Type | Description |
|---|---|---|
| `id` | Integer (PK, auto) | Primary key |
| `timestamp` | DateTime (indexed) | Reading timestamp |
| `ward_id` | String(50) (indexed) | Ward identifier (default: `ward_01`) |
| `temperature` | Float | Temperature in °C |
| `humidity` | Float | Relative humidity % |
| `pm25` | Float | PM2.5 in µg/m³ |
| `tvoc` | Float | TVOC in ppm |
| `no2` | Float | NO₂ in ppm |
| `co` | Float | CO in ppm |
| `aqi` | Integer | Air Quality Index |
| `aqi_category` | String(20) | AQI category label |
| `source_detected` | String(50) | ML-detected pollution source |
| `source_confidence` | Float | ML confidence score |
| `is_anomaly` | Boolean | Anomaly detection flag |
| `created_at` | DateTime | Record creation timestamp |

**Table: `wards`**

| Column | Type | Description |
|---|---|---|
| `id` | String(50) (PK) | Ward identifier |
| `name` | String(100) | Ward name |
| `latitude` | Float | GPS latitude |
| `longitude` | Float | GPS longitude |
| `description` | String(255) | Ward description |

#### Database Setup

**There is nothing to set up.** The SQLite database file (`aqms.db`) is automatically created in the `backend/` directory the first time you start the backend server. SQLAlchemy's `Base.metadata.create_all()` handles table creation.

If you ever need to **reset the database**, simply delete the file:
```bash
# From the project root
rm backend/aqms.db
```
The database will be recreated on the next server start.

---

## 🚀 Step-by-Step Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/sheelendra-scripts/AQMS.git
cd AQMS
```

---

### Step 2: Set Up the Backend

#### 2.1 Create a Python Virtual Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1

# On Windows (CMD):
.\venv\Scripts\activate.bat

# On macOS/Linux:
source venv/bin/activate
```

#### 2.2 Install Python Dependencies

```bash
pip install -r requirements.txt
```

This will install:
- `fastapi` + `uvicorn` — Web framework and ASGI server
- `sqlalchemy` + `aiosqlite` — Async ORM and SQLite driver
- `httpx` — Async HTTP client (for ThingSpeak API)
- `python-dotenv` — Environment variable management
- `scikit-learn` + `xgboost` + `joblib` — ML model training and inference
- `numpy` + `pandas` — Data processing
- `websockets` — WebSocket support
- `pydantic` — Data validation
- `apscheduler` — Task scheduling

#### 2.3 Configure the Backend `.env` File

A `.env` file should exist in the `backend/` directory. Create or update it:

```bash
# backend/.env

# ThingSpeak IoT Channel (pre-configured defaults)
THINGSPEAK_CHANNEL_ID=3316545
THINGSPEAK_READ_API_KEY=GFGLEQFXSC40CFOO
THINGSPEAK_WRITE_API_KEY=6CA62U2GHR3NGFRJ

# Database (SQLite — auto-created, no external DB needed)
DATABASE_URL=sqlite+aiosqlite:///./aqms.db

# App Configuration
APP_ENV=development
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# Demo Mode Controls
# "auto"  → tries live ThingSpeak first, falls back to simulated data if device is offline
# "true"  → always uses simulated demo data (best for local dev without hardware)
# "false" → only uses live ThingSpeak data (requires ESP32 to be online)
DEMO_MODE=auto

# Optional: OpenWeatherMap (for weather data enrichment)
OPENWEATHER_API_KEY=

# Optional: Twilio (for SMS alerts)
TWILIO_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE=
ALERT_EMAIL=
```

> [!TIP]
> For local development, set `DEMO_MODE=auto` or `DEMO_MODE=true`. This generates realistic simulated air quality data without needing the physical ESP32 sensor hardware.

#### 2.4 Train the ML Models (Optional)

The repository includes **pre-trained ML model files** in `backend/ml/models/`:
- `source_classifier.pkl` (~13 MB) — Random Forest pollution source classifier
- `aqi_forecaster.pkl` (~800 KB) — XGBoost AQI forecaster
- `anomaly_detector.pkl` (~2 MB) — Isolation Forest anomaly detector

If these files are present, **skip this step**. The backend loads them automatically on startup.

To **retrain models** from scratch (generates fresh synthetic training data):

```bash
# From the backend/ directory (with venv activated)
python ml/train_models.py
```

This takes about 30–60 seconds and overwrites the `.pkl` files in `ml/models/`.

> [!NOTE]
> If the `.pkl` files are missing (e.g., excluded by `.gitignore`), the backend will gracefully fall back to **rule-based detection** instead of ML models. The application still works, but with slightly less accurate source classification.

#### 2.5 Start the Backend Server

```bash
# From the backend/ directory (with venv activated)
python -m uvicorn main:app --reload --port 8000
```

Or equivalently:
```bash
python main.py
```

**Expected output:**
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
✅ Database initialized
🌿 ThingSpeak polling loop started (30s interval)
📡 AQI=262 (Very Poor) PM2.5=140.3 CO=4.52 NO2=0.138
```

**Verify the backend is running:**
- API root: [http://localhost:8000](http://localhost:8000)
- Swagger docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

### Step 3: Set Up the Frontend

Open a **new terminal window/tab** (keep the backend running).

#### 3.1 Install Node.js Dependencies

```bash
cd frontend
npm install
```

#### 3.2 Configure the Frontend Environment (Optional)

The frontend **auto-detects** the backend URL. When running on `localhost`, it automatically connects to `http://localhost:8000`.

If you need to override this (e.g., connecting to a remote backend), create a `.env` file in the `frontend/` directory:

```bash
# frontend/.env (optional — only needed if NOT using localhost:8000)
VITE_API_URL=http://localhost:8000
```

> [!NOTE]
> The frontend uses Vite's `import.meta.env.VITE_API_URL` to read environment variables. Only variables prefixed with `VITE_` are exposed to the browser.

#### 3.3 Start the Frontend Dev Server

```bash
npm run dev
```

**Expected output:**
```
  VITE v7.3.1  ready in 300ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

**Open the dashboard:** [http://localhost:5173](http://localhost:5173)

---

## ✅ Verify Everything is Working

| Check | URL | Expected Result |
|---|---|---|
| Backend root | http://localhost:8000 | JSON with API info |
| Swagger docs | http://localhost:8000/docs | Interactive API documentation |
| Health check | http://localhost:8000/api/health | `{"status": "healthy", ...}` |
| Live data | http://localhost:8000/api/live | Latest sensor reading JSON |
| Frontend | http://localhost:5173 | Dashboard with live AQI data |
| WebSocket | ws://localhost:8000/ws/live | Real-time data stream |

---

## 📁 Configuration Files Summary

| File | Location | Purpose |
|---|---|---|
| `backend/.env` | `backend/.env` | ThingSpeak keys, database URL, demo mode, optional API keys |
| `backend/requirements.txt` | `backend/requirements.txt` | Python dependencies |
| `frontend/package.json` | `frontend/package.json` | Node.js dependencies and scripts |
| `frontend/.env` | `frontend/.env` (optional) | Override backend API URL (`VITE_API_URL`) |
| `frontend/vite.config.js` | `frontend/vite.config.js` | Vite build config (React plugin) |
| `frontend/vercel.json` | `frontend/vercel.json` | Vercel deployment config (not needed locally) |
| `backend/render.yaml` | `backend/render.yaml` | Render deployment config (not needed locally) |
| `backend/Dockerfile` | `backend/Dockerfile` | Docker deployment config (not needed locally) |

---

## 🛠️ Troubleshooting

### Backend won't start — `ModuleNotFoundError`
Ensure your virtual environment is activated and dependencies are installed:
```bash
cd backend
source venv/bin/activate     # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Frontend shows "Backend not available"
- Make sure the backend is running on port `8000`
- Check the browser console for CORS errors
- The frontend has a built-in **ThingSpeak fallback** — it will still show data from the ThingSpeak cloud API even if the backend is down

### ML models not loading (warning in logs)
If you see `❌ Source classifier failed` in backend logs:
```bash
cd backend
python ml/train_models.py
```
This trains fresh models. The backend will fall back to rule-based detection if models are unavailable.

### SQLite database errors
Delete and let it re-create:
```bash
rm backend/aqms.db
# Restart the backend
```

### Port already in use
```bash
# Change backend port
python -m uvicorn main:app --reload --port 8001

# Change frontend port
npx vite --port 3000
```
If you change the backend port, update `VITE_API_URL` in `frontend/.env`:
```bash
VITE_API_URL=http://localhost:8001
```

---

## 🐳 Running with Docker (Alternative)

```bash
cd backend
docker build -t aqms-backend .
docker run -p 8000:8000 -e DEMO_MODE=auto aqms-backend
```

The backend will be available at `http://localhost:8000`.

---

## 📝 Quick Reference

```bash
# Terminal 1 — Backend
cd backend
python -m venv venv
.\venv\Scripts\activate       # Windows
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev

# Open http://localhost:5173 in your browser
```
