from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

app = FastAPI()

history = []  # stores last readings

# Load model and scaler
model = joblib.load("waterguard/model/waterguard_model.pkl")
scaler = joblib.load("waterguard/model/scaler.pkl")

print("Scaler expects:", scaler.n_features_in_)

# Input structure
class WaterData(BaseModel):
    ph: float
    turbidity: float
    temperature: float
    dissolved_oxygen: float
    conductivity: float
    hardness: float

@app.get("/")
def home():
    return {"message": "WaterGuard Backend Running 🚀"}

@app.post("/predict")
def predict(data: WaterData):

    global history

    # Convert input
    input_data = np.array([[
        data.ph,
        data.turbidity,
        data.temperature,
        data.dissolved_oxygen,
        data.conductivity,
        data.hardness
    ]])

    # Scale
    input_scaled = scaler.transform(input_data)

    # Prediction
    prediction = model.predict(input_scaled)[0]

    # Confidence
    confidence = max(model.predict_proba(input_scaled)[0]) * 100

    # Store history
    history.append(data.model_dump())
    if len(history) > 10:
        history.pop(0)

    # 🔥 TIME-BASED LOGIC
    alert = "Normal"

    if len(history) >= 3:
        last = history[-1]
        prev = history[-2]

        if last["ph"] < prev["ph"] - 0.3:
            alert = "Warning: pH dropping"

        if last["turbidity"] > prev["turbidity"] + 2:
            alert = "Danger: Sudden turbidity spike"

        if last["dissolved_oxygen"] < 4:
            alert = "Danger: Low oxygen level"

        if (
            last["ph"] < 6 and
            last["turbidity"] > 5 and
            last["dissolved_oxygen"] < 4
        ):
            alert = "CRITICAL: Water highly contaminated"

    # Final status (ML)
    if prediction == 0:
        status = "Safe"
    elif prediction == 1:
        status = "Warning"
    else:
        status = "Danger"

    # 🔥 HYBRID DECISION (ML + Rules + Confidence)
    final_status = status

    if "CRITICAL" in alert:
        final_status = "Danger"

    elif "Danger" in alert:
        if confidence < 80:
            final_status = "Danger"

    elif "Warning" in alert:
        if confidence < 70:
            final_status = "Warning"

    # 🔥 RISK SCORE SYSTEM (0–100)

    risk_score = 0

    # Base from model
    if status == "Safe":
        risk_score += 20
    elif status == "Warning":
        risk_score += 50
    else:
        risk_score += 80

    # Confidence effect
    risk_score += (100 - confidence) * 0.3

    # Alert effect
    if "CRITICAL" in alert:
        risk_score += 30
    elif "Danger" in alert:
        risk_score += 20
    elif "Warning" in alert:
        risk_score += 10

    # Clamp
    risk_score = min(100, round(risk_score, 2))

    # 🔥 Risk Level
    if risk_score < 30:
        risk_level = "Low"
    elif risk_score < 70:
        risk_level = "Medium."
    else:
        risk_level = "High"

    # ✅ FINAL RESPONSE
    return {
        "status": final_status,
        "model_status": status,
        "confidence": round(confidence, 2),
        "trend_alert": alert,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "history_count": len(history)
    }