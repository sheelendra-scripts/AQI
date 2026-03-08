"""
ML Model Training — generates synthetic training data and trains 3 models:
  1. Pollution Source Classifier  (Random Forest)
  2. AQI Forecaster              (XGBoost Regressor)
  3. Anomaly Detector             (Isolation Forest)

Models are saved to backend/ml/models/*.pkl
Run: python3 ml/train_models.py
"""
import os
import math
import random
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
from xgboost import XGBRegressor

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

SOURCES = ["vehicle", "industrial", "construction", "biomass", "mixed"]

# ── Pollution profiles (realistic Delhi patterns) ─────────────────
PROFILES = {
    "vehicle":      {"pm25": (60, 20), "co": (3.0, 0.8), "no2": (0.09, 0.02), "tvoc": (0.25, 0.08), "temp_bias": 2},
    "industrial":   {"pm25": (95, 25), "co": (3.5, 1.0), "no2": (0.13, 0.03), "tvoc": (0.55, 0.12), "temp_bias": 3},
    "construction": {"pm25": (110, 30),"co": (1.2, 0.4), "no2": (0.04, 0.01), "tvoc": (0.75, 0.15), "temp_bias": 1},
    "biomass":      {"pm25": (85, 22), "co": (4.5, 1.2), "no2": (0.05, 0.015),"tvoc": (0.70, 0.15), "temp_bias": 4},
    "mixed":        {"pm25": (50, 15), "co": (1.8, 0.5), "no2": (0.06, 0.015),"tvoc": (0.30, 0.08), "temp_bias": 1},
}


def generate_source_data(n_samples=5000):
    """Generate labeled training data for source classification."""
    rows = []
    for _ in range(n_samples):
        source = random.choice(SOURCES)
        p = PROFILES[source]
        hour = random.uniform(0, 24)

        # Diurnal traffic factor
        morning = math.exp(-((hour - 8) ** 2) / 8)
        evening = math.exp(-((hour - 18) ** 2) / 8)
        traffic = 0.4 + 0.6 * (morning + evening)

        pm25 = max(3, random.gauss(p["pm25"][0] * traffic, p["pm25"][1]))
        co = max(0.05, random.gauss(p["co"][0] * traffic, p["co"][1]))
        no2 = max(0.002, random.gauss(p["no2"][0] * traffic, p["no2"][1]))
        tvoc = max(0.01, random.gauss(p["tvoc"][0] * traffic, p["tvoc"][1]))
        temp = 28 + p["temp_bias"] + 5 * math.sin((hour - 14) * math.pi / 12) + random.gauss(0, 1.5)
        humidity = 55 - 15 * math.sin((hour - 14) * math.pi / 12) + random.gauss(0, 3)

        # Derived features
        pm25_co_ratio = pm25 / max(co, 0.01)
        tvoc_no2_ratio = tvoc / max(no2, 0.001)

        rows.append({
            "pm25": round(pm25, 2),
            "co": round(co, 3),
            "no2": round(no2, 4),
            "tvoc": round(tvoc, 3),
            "temperature": round(temp, 1),
            "humidity": round(humidity, 1),
            "hour": round(hour, 2),
            "pm25_co_ratio": round(pm25_co_ratio, 2),
            "tvoc_no2_ratio": round(tvoc_no2_ratio, 2),
            "source": source,
        })
    return pd.DataFrame(rows)


def generate_forecast_data(n_days=60):
    """Generate sequential hourly data for AQI forecasting."""
    rows = []
    base_aqi = 120
    for day in range(n_days):
        # Seasonal drift
        seasonal = 20 * math.sin(2 * math.pi * day / 30)
        for hour in range(24):
            morning = math.exp(-((hour - 8) ** 2) / 8)
            evening = math.exp(-((hour - 18) ** 2) / 8)
            traffic = 0.4 + 0.6 * (morning + evening)

            aqi = max(20, base_aqi * traffic + seasonal + random.gauss(0, 15))
            pm25 = max(5, aqi * 0.45 + random.gauss(0, 8))
            co = max(0.1, 1.0 + aqi * 0.012 + random.gauss(0, 0.3))
            no2 = max(0.005, 0.02 + aqi * 0.0004 + random.gauss(0, 0.008))
            tvoc = max(0.01, 0.1 + aqi * 0.002 + random.gauss(0, 0.05))
            temp = 28 + 5 * math.sin((hour - 14) * math.pi / 12) + random.gauss(0, 1.2)
            humidity = 55 - 15 * math.sin((hour - 14) * math.pi / 12) + random.gauss(0, 2.5)

            rows.append({
                "hour": hour,
                "day_of_week": day % 7,
                "pm25": round(pm25, 2),
                "co": round(co, 3),
                "no2": round(no2, 4),
                "tvoc": round(tvoc, 3),
                "temperature": round(temp, 1),
                "humidity": round(humidity, 1),
                "aqi": int(round(aqi)),
            })

    # Create lag features (aqi_lag_1h, aqi_lag_3h, aqi_lag_6h)
    df = pd.DataFrame(rows)
    df["aqi_lag_1h"] = df["aqi"].shift(1).fillna(df["aqi"].mean())
    df["aqi_lag_3h"] = df["aqi"].shift(3).fillna(df["aqi"].mean())
    df["aqi_lag_6h"] = df["aqi"].shift(6).fillna(df["aqi"].mean())
    return df


def train_source_classifier():
    """Train Random Forest source classifier."""
    print("🌲 Training Pollution Source Classifier (Random Forest)...")
    df = generate_source_data(6000)

    features = ["pm25", "co", "no2", "tvoc", "temperature", "humidity", "hour", "pm25_co_ratio", "tvoc_no2_ratio"]
    X = df[features]
    y = df["source"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=12,
        min_samples_split=5,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    print(classification_report(y_test, preds))

    path = os.path.join(MODELS_DIR, "source_classifier.pkl")
    joblib.dump({"model": model, "features": features, "classes": list(model.classes_)}, path)
    print(f"   ✅ Saved → {path}\n")
    return model


def train_aqi_forecaster():
    """Train XGBoost AQI forecaster."""
    print("📈 Training AQI Forecaster (XGBoost)...")
    df = generate_forecast_data(90)

    features = ["hour", "day_of_week", "pm25", "co", "no2", "tvoc", "temperature", "humidity",
                "aqi_lag_1h", "aqi_lag_3h", "aqi_lag_6h"]
    X = df[features]
    y = df["aqi"]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = XGBRegressor(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    score = model.score(X_test, y_test)
    print(f"   R² Score: {score:.4f}")

    path = os.path.join(MODELS_DIR, "aqi_forecaster.pkl")
    joblib.dump({"model": model, "features": features}, path)
    print(f"   ✅ Saved → {path}\n")
    return model


def train_anomaly_detector():
    """Train Isolation Forest anomaly detector."""
    print("🔍 Training Anomaly Detector (Isolation Forest)...")
    df = generate_source_data(4000)

    features = ["pm25", "co", "no2", "tvoc", "temperature", "humidity"]
    X = df[features]

    model = IsolationForest(
        n_estimators=150,
        contamination=0.05,
        max_features=0.8,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X)

    anomalies = (model.predict(X) == -1).sum()
    print(f"   Anomalies in training data: {anomalies}/{len(X)} ({100*anomalies/len(X):.1f}%)")

    path = os.path.join(MODELS_DIR, "anomaly_detector.pkl")
    joblib.dump({"model": model, "features": features}, path)
    print(f"   ✅ Saved → {path}\n")
    return model


if __name__ == "__main__":
    print("=" * 60)
    print("AQMS — ML Model Training Pipeline")
    print("=" * 60 + "\n")

    train_source_classifier()
    train_aqi_forecaster()
    train_anomaly_detector()

    print("=" * 60)
    print("✅ All 3 models trained and saved to ml/models/")
    print("=" * 60)
