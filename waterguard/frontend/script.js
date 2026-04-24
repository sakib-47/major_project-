// 🔹 Navigate to Dashboard Page
function goToDashboard() {
    const role = document.getElementById("role").value;
    localStorage.setItem("role", role);
    window.location.href = "dashboard.html";
}

// 🔹 (Optional) Go back to Home
function goBack() {
    window.location.href = "index.html";
}

// 🔥 ROLE
let role = localStorage.getItem("role");

// 🔥 ALERT HISTORY (NEW)
let alertHistory = [];

// 🔥 MAP VARIABLES
let map;
let marker;

// 🔥 COLOR LOGIC
function getColor(status) {
    if (status === "Safe") return "green";
    if (status === "Warning") return "orange";
    return "red";
}

// 🔥 CREATE MARKER
function createMarker(lat, lng, status) {
    return L.circleMarker([lat, lng], {
        radius: 10,
        color: getColor(status),
        fillColor: getColor(status),
        fillOpacity: 0.9
    }).addTo(map);
}

// 🔹 Initialize Map
function initMap(lat = 12.9716, lng = 77.5946, status = "Safe") {
    if (!map) {
        map = L.map('map').setView([lat, lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        marker = createMarker(lat, lng, status);
    } else {
        map.setView([lat, lng], 13);

        if (marker) {
            map.removeLayer(marker);
        }

        marker = createMarker(lat, lng, status);
    }
}

// 🔹 Fetch latest data from backend (/latest)
async function fetchData() {
    try {
        const res = await fetch("http://127.0.0.1:8000/latest");
        const data = await res.json();

        const statusEl = document.getElementById("status");
        const confidenceEl = document.getElementById("confidence");
        const riskEl = document.getElementById("risk");
        const alertEl = document.getElementById("alert");
        const locationEl = document.getElementById("location");
        const pulse = document.getElementById("pulse");

        // ✅ Show waiting if no data
        if (!data || !data.status) {
            if (statusEl) {
                statusEl.innerText = "⏳ Waiting for sensor data...";
                statusEl.style.color = "gray";
            }
            return;
        }

        // ✅ Update UI
        if (statusEl) statusEl.innerText = data.status;
        if (confidenceEl) confidenceEl.innerText = data.confidence + "%";
        if (riskEl) riskEl.innerText = data.risk_level;
        if (alertEl) alertEl.innerText = "⚠ " + data.trend_alert;

        // 🔥 ALERT HISTORY LOGIC
        if (data.trend_alert && data.trend_alert !== "Normal") {
            alertHistory.push(data.trend_alert);

            if (alertHistory.length > 5) {
                alertHistory.shift();
            }
        }

        // 🔥 LOCATION + MAP
        if (data.location) {
            if (locationEl) locationEl.innerText = "📍 " + data.location;

            const parts = data.location.split(",");
            if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);

                if (!isNaN(lat) && !isNaN(lng)) {
                    initMap(lat, lng, data.status);
                }
            }
        }

        // 🎨 Status color + pulse
        if (pulse && statusEl) {
            if (data.status === "Safe") {
                pulse.style.background = "lime";
                statusEl.style.color = "lime";
            } else if (data.status === "Warning") {
                pulse.style.background = "orange";
                statusEl.style.color = "orange";
            } else {
                pulse.style.background = "red";
                statusEl.style.color = "red";
            }
        }

        // 🔥 ROLE-BASED LOGIC
        const historyList = document.getElementById("alertHistory");
        const historyCard = document.getElementById("historyCard");

        if (role === "authority") {
            console.log("Authority Mode Enabled");

            // Show history card
            if (historyCard) historyCard.style.display = "block";

            // Highlight alerts
            if (alertEl) {
                alertEl.style.fontWeight = "bold";
                alertEl.style.fontSize = "16px";
            }

            // Display history
            if (historyList) {
                historyList.innerHTML = "";

                alertHistory.slice().reverse().forEach(alert => {
                    const li = document.createElement("li");
                    li.innerText = "⚠ " + alert;
                    historyList.appendChild(li);
                });
            }
        }

    } catch (error) {
        const statusEl = document.getElementById("status");
        if (statusEl) {
            statusEl.innerText = "❌ Backend not connected";
            statusEl.style.color = "red";
        }
        console.error("Fetch error:", error);
    }
}

// 🔁 Run on page load
window.onload = function () {

    // 🔥 SHOW ROLE
    if (role) {
        const roleEl = document.getElementById("roleDisplay");
        if (roleEl) {
            roleEl.innerText = "Role: " + role.toUpperCase();
        }
    }

    fetchData();

    setInterval(() => {
        fetchData();
    }, 3000);
};