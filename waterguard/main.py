from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd

app = FastAPI()

# ✅ CORS (for frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

history = []
latest_data = None  # 🔥 store latest result for frontend

# Load model
model = joblib.load("waterguard/model/waterguard_model.pkl")
scaler = joblib.load("waterguard/model/scaler.pkl")

print("Scaler expects:", scaler.n_features_in_)


# ✅ INPUT MODEL
class WaterData(BaseModel):
    ph: float
    turbidity: float
    temperature: float
    solids: float
    latitude: float
    longitude: float


@app.get("/")
def home():
    return {"message": "WaterGuard Backend Running 🚀"}


# 🔥 PREDICTION API
@app.post("/predict")
def predict(data: WaterData):

    global history, latest_data   # 🔥 ADD latest_data HERE

    # Prepare ML input
    input_df = pd.DataFrame([[data.ph, data.solids, data.turbidity]],
                            columns=['ph', 'Solids', 'Turbidity'])

    input_scaled = scaler.transform(input_df)

    prediction = model.predict(input_scaled)[0]
    proba = model.predict_proba(input_scaled)[0]
    confidence = max(proba) * 100

    # Store history
    history.append(data.model_dump())
    if len(history) > 10:
        history.pop(0)

    # 🔥 TIME-BASED LOGIC
    alert = "Normal"

    if len(history) >= 2:
        last = history[-1]
        prev = history[-2]

        if last["ph"] < prev["ph"] - 0.3:
            alert = "Warning: pH dropping"

        if last["turbidity"] > prev["turbidity"] + 2:
            alert = "Danger: Turbidity spike"

        if last["temperature"] > 40:
            alert = "Warning: High temperature"

        if abs(last["temperature"] - prev["temperature"]) > 5:
            alert = "Warning: Sudden temperature change"

        if last["ph"] < 6 and last["turbidity"] > 5:
            alert = "CRITICAL: Water contaminated"

    # ML Result
    if prediction == 1:
        status = "Safe"
    else:
        if confidence < 70:
            status = "Warning"
        else:
            status = "Unsafe"

    # Hybrid decision
    final_status = status

    if "CRITICAL" in alert:
        final_status = "Danger"

    elif "Danger" in alert and confidence < 80:
        final_status = "Danger"

    elif "Warning" in alert and confidence < 70:
        final_status = "Warning"

    # Risk score
    risk_score = 20 if status == "Safe" else 70
    risk_score += (100 - confidence) * 0.3

    if "CRITICAL" in alert:
        risk_score += 30
    elif "Danger" in alert:
        risk_score += 20
    elif "Warning" in alert:
        risk_score += 10

    risk_score = min(100, round(risk_score, 2))

    # Risk level
    if risk_score < 30:
        risk_level = "Low"
    elif risk_score < 70:
        risk_level = "Medium"
    else:
        risk_level = "High"

    # ✅ FINAL RESPONSE (frontend-friendly)
    result = {
        "status": final_status,
        "confidence": round(confidence, 2),
        "risk_level": risk_level,
        "trend_alert": alert,
        "location": f"{data.latitude},{data.longitude}"
    }

    # 🔥 STORE LATEST DATA
    latest_data = result

    return result


# 🔥 NEW ENDPOINT FOR FRONTEND
@app.get("/latest")
def get_latest():
    return latest_data if latest_data else {"status": None}