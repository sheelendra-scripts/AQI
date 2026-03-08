"""ML Prediction Service — loads trained models and provides inference."""
import os
import math
import joblib
import numpy as np
from datetime import datetime, timezone

MODELS_DIR = os.path.join(os.path.dirname(__file__), "models")

_source_model = None
_forecast_model = None
_anomaly_model = None


def _load_models():
    global _source_model, _forecast_model, _anomaly_model
    try:
        _source_model = joblib.load(os.path.join(MODELS_DIR, "source_classifier.pkl"))
    except Exception:
        _source_model = None
    try:
        _forecast_model = joblib.load(os.path.join(MODELS_DIR, "aqi_forecaster.pkl"))
    except Exception:
        _forecast_model = None
    try:
        _anomaly_model = joblib.load(os.path.join(MODELS_DIR, "anomaly_detector.pkl"))
    except Exception:
        _anomaly_model = None


# Load on import
_load_models()


def detect_source(pm25: float, co: float, no2: float, tvoc: float,
                  temperature: float, humidity: float, hour: float = None) -> dict:
    """Classify the pollution source from sensor readings."""
    if _source_model is None:
        return {"source": "unknown", "confidence": 0, "probabilities": {}}

    if hour is None:
        hour = datetime.now(timezone.utc).hour + datetime.now(timezone.utc).minute / 60.0

    pm25_co_ratio = pm25 / max(co, 0.01)
    tvoc_no2_ratio = tvoc / max(no2, 0.001)

    features = _source_model["features"]
    X = np.array([[pm25, co, no2, tvoc, temperature, humidity, hour, pm25_co_ratio, tvoc_no2_ratio]])

    pred = _source_model["model"].predict(X)[0]
    proba = _source_model["model"].predict_proba(X)[0]
    classes = _source_model["classes"]

    probabilities = {cls: round(float(p), 3) for cls, p in zip(classes, proba)}
    confidence = round(float(max(proba)), 3)

    return {
        "source": pred,
        "confidence": confidence,
        "probabilities": probabilities,
    }


def forecast_aqi(current_reading: dict, horizon_hours: int = 24) -> list:
    """Forecast AQI for the next N hours using XGBoost."""
    if _forecast_model is None:
        return []

    now = datetime.now(timezone.utc)
    current_hour = now.hour + now.minute / 60.0
    day_of_week = now.weekday()

    current_aqi = current_reading.get("aqi", 100)
    pm25 = current_reading.get("pm25", 50)
    co = current_reading.get("co", 1.5)
    no2 = current_reading.get("no2", 0.05)
    tvoc = current_reading.get("tvoc", 0.3)
    temp = current_reading.get("temperature", 30)
    humidity = current_reading.get("humidity", 50)

    # Recent AQI history (simulate lags from current)
    aqi_lag_1h = current_aqi
    aqi_lag_3h = current_aqi * 0.95
    aqi_lag_6h = current_aqi * 0.90

    forecasts = []
    model = _forecast_model["model"]

    for h in range(1, horizon_hours + 1):
        future_hour = (current_hour + h) % 24
        future_dow = (day_of_week + (int(current_hour + h) // 24)) % 7

        # Estimate future conditions with diurnal pattern
        morning = math.exp(-((future_hour - 8) ** 2) / 8)
        evening = math.exp(-((future_hour - 18) ** 2) / 8)
        traffic = 0.4 + 0.6 * (morning + evening)

        f_temp = 28 + 5 * math.sin((future_hour - 14) * math.pi / 12)
        f_humidity = 55 - 15 * math.sin((future_hour - 14) * math.pi / 12)
        f_pm25 = pm25 * traffic / max(0.4, 0.4 + 0.6 * (
            math.exp(-((current_hour - 8) ** 2) / 8) + math.exp(-((current_hour - 18) ** 2) / 8)))

        X = np.array([[future_hour, future_dow, f_pm25, co * traffic, no2 * traffic,
                        tvoc * traffic, f_temp, f_humidity, aqi_lag_1h, aqi_lag_3h, aqi_lag_6h]])

        pred_aqi = int(max(10, min(500, model.predict(X)[0])))

        # Determine category
        if pred_aqi <= 50:
            cat, color = "Good", "#22c55e"
        elif pred_aqi <= 100:
            cat, color = "Satisfactory", "#84cc16"
        elif pred_aqi <= 200:
            cat, color = "Moderate", "#eab308"
        elif pred_aqi <= 300:
            cat, color = "Poor", "#f97316"
        elif pred_aqi <= 400:
            cat, color = "Very Poor", "#ef4444"
        else:
            cat, color = "Severe", "#991b1b"

        future_ts = now.replace(minute=0, second=0, microsecond=0)
        from datetime import timedelta
        future_ts = future_ts + timedelta(hours=h)

        forecasts.append({
            "hour_offset": h,
            "timestamp": future_ts.isoformat().replace("+00:00", "Z"),
            "predicted_aqi": pred_aqi,
            "category": cat,
            "color": color,
        })

        # Update lags for next iteration
        aqi_lag_6h = aqi_lag_3h
        aqi_lag_3h = aqi_lag_1h
        aqi_lag_1h = pred_aqi

    return forecasts


def detect_anomaly(pm25: float, co: float, no2: float, tvoc: float,
                   temperature: float, humidity: float) -> dict:
    """Detect if current reading is anomalous."""
    if _anomaly_model is None:
        return {"is_anomaly": False, "anomaly_score": 0.0}

    X = np.array([[pm25, co, no2, tvoc, temperature, humidity]])
    prediction = _anomaly_model["model"].predict(X)[0]
    score = -_anomaly_model["model"].score_samples(X)[0]  # Higher = more anomalous

    return {
        "is_anomaly": bool(prediction == -1),
        "anomaly_score": round(float(score), 4),
    }
