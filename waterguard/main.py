from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
from collections import deque, Counter

app = FastAPI()

# ✅ CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔥 STORAGE
history = []
latest_data = None

# 🔥 SMOOTHING BUFFERS
recent_inputs = deque(maxlen=5)
recent_predictions = deque(maxlen=5)
recent_confidence = deque(maxlen=5)

# 🔥 LOAD MODEL
model = joblib.load("waterguard/model/waterguard_model.pkl")
scaler = joblib.load("waterguard/model/scaler.pkl")

print("Scaler expects:", scaler.n_features_in_)


# ✅ INPUT MODEL
class WaterData(BaseModel):
    ph: float
    turbidity: float
    temperature: float
    tds: float
    latitude: float
    longitude: float


@app.get("/")
def home():
    return {"message": "WaterGuard Backend Running 🚀"}


# 🔥 SMOOTH INPUT
def smooth_input(data):
    recent_inputs.append(data)

    return {
        "ph": np.mean([d["ph"] for d in recent_inputs]),
        "turbidity": np.mean([d["turbidity"] for d in recent_inputs]),
        "temperature": np.mean([d["temperature"] for d in recent_inputs]),
        "tds": np.mean([d["tds"] for d in recent_inputs]),
        "latitude": data["latitude"],
        "longitude": data["longitude"],
    }


# 🔥 STABLE PREDICTION
def get_stable_prediction(pred):
    recent_predictions.append(pred)
    return Counter(recent_predictions).most_common(1)[0][0]


# 🔥 STABLE CONFIDENCE
def get_stable_confidence(conf):
    recent_confidence.append(conf)
    return np.mean(recent_confidence)


# 🔥 MAIN API
@app.post("/predict")
def predict(data: WaterData):

    global history, latest_data

    # 🔥 SMOOTH INPUT
    smoothed = smooth_input(data.model_dump())

    # 🔥 ML INPUT
    input_df = pd.DataFrame(
        [[smoothed["ph"], smoothed["tds"], smoothed["turbidity"]]],
        columns=['ph', 'Solids', 'Turbidity']  # keep for model compatibility
    )

    input_scaled = scaler.transform(input_df)

    raw_prediction = model.predict(input_scaled)[0]
    raw_proba = model.predict_proba(input_scaled)[0]
    raw_confidence = max(raw_proba) * 100

    # 🔥 STABILITY
    prediction = get_stable_prediction(raw_prediction)
    confidence = get_stable_confidence(raw_confidence)

    # 🔥 HISTORY
    history.append(smoothed)
    if len(history) > 10:
        history.pop(0)

    # 🔥 TIME-BASED LOGIC
    alert = "Normal"

    if len(history) >= 2:
        last = history[-1]
        prev = history[-2]

        if last["ph"] < prev["ph"] - 0.3:
            alert = "Warning: pH dropping"

        if last["turbidity"] > prev["turbidity"] + 3:
            alert = "Danger: Turbidity spike"

        if last["temperature"] > 40:
            alert = "Warning: High temperature"

        if abs(last["temperature"] - prev["temperature"]) > 5:
            alert = "Warning: Sudden temperature change"

        if last["ph"] < 6 and last["turbidity"] > 10:
            alert = "CRITICAL: Water contaminated"

    # 🔥 ML STATUS
    if prediction == 1:
        status = "Safe"
    else:
        status = "Warning" if confidence < 70 else "Unsafe"

    # 🔥 HYBRID DECISION
    final_status = status

    if "CRITICAL" in alert:
        final_status = "Danger"
    elif "Danger" in alert:
        final_status = "Danger"
    elif "Warning" in alert and confidence < 75:
        final_status = "Warning"

    # 🔥 RISK SCORE
    risk_score = 20 if status == "Safe" else 70
    risk_score += (100 - confidence) * 0.3

    if "CRITICAL" in alert:
        risk_score += 30
    elif "Danger" in alert:
        risk_score += 20
    elif "Warning" in alert:
        risk_score += 10

    risk_score = min(100, round(risk_score, 2))

    # 🔥 RISK LEVEL
    if risk_score < 30:
        risk_level = "Low"
    elif risk_score < 70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # ✅ FINAL RESPONSE (VERY IMPORTANT FOR FRONTEND)
    result = {
        "status": final_status,
        "confidence": round(confidence, 2),
        "risk_level": risk_level,
        "trend_alert": alert,
        "location": f"{data.latitude},{data.longitude}",

        # 🔥 SENSOR VALUES (FIXES YOUR GRAPH ISSUE)
        "ph": round(smoothed["ph"], 2),
        "turbidity": round(smoothed["turbidity"], 2),
        "tds": round(smoothed["tds"], 2),
        "temperature": round(smoothed["temperature"], 2)
    }

    latest_data = result
    return result


# 🔥 FRONTEND FETCH
@app.get("/latest")
def get_latest():
    return latest_data if latest_data else {
        "status": None,
        "ph": 0,
        "turbidity": 0,
        "tds": 0,
        "temperature": 0
    }