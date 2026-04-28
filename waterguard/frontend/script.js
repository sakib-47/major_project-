// 🔹 Navigate
function goToDashboard() {
    const role = document.getElementById("role").value;
    localStorage.setItem("role", role);
    window.location.href = "dashboard.html";
}

function goBack() {
    window.location.href = "index.html";
}

// 🔥 ROLE
let role = localStorage.getItem("role");

// 🔥 ALERT HISTORY
let alertHistory = [];

// 🔥 LAST STATUS (for toast control)
let lastStatus = "";

// 🔥 MAP
let map;
let marker;

// 🔥 GRAPH DATA
let timeLabels = [];
let phData = [];
let turbidityData = [];
let tdsData = [];

let phChart, turbidityChart, tdsChart;

// 🔥 COLOR LOGIC
function getColor(status) {
    if (status === "Safe") return "lime";
    if (status === "Warning") return "orange";
    return "red";
}

// 🔥 TOAST FUNCTION
function showToast(message, type = "safe") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast " + type;
    toast.innerText = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// 🔥 MAP MARKER
function createMarker(lat, lng, status) {
    return L.circleMarker([lat, lng], {
        radius: 10,
        color: getColor(status),
        fillColor: getColor(status),
        fillOpacity: 0.9
    }).addTo(map);
}

// 🔥 INIT MAP
function initMap(lat = 12.9716, lng = 77.5946, status = "Safe") {
    if (!map) {
        map = L.map('map').setView([lat, lng], 13);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(map);

        marker = createMarker(lat, lng, status);
    } else {
        map.setView([lat, lng], 13);
        if (marker) map.removeLayer(marker);
        marker = createMarker(lat, lng, status);
    }
}

// 🔥 ALERT HANDLER
function addAlert(alertText) {
    if (!alertText || alertText === "Normal") return;
    if (alertHistory.length > 0 && alertHistory[0] === alertText) return;

    alertHistory.unshift(alertText);
    if (alertHistory.length > 5) alertHistory.pop();
}

// 🔥 CREATE CHARTS
function createCharts() {

    const commonOptions = {
        animation: { duration: 800 },
        elements: { line: { tension: 0.4 } }
    };

    phChart = new Chart(document.getElementById("phChart"), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'pH', data: phData, borderWidth: 2 },
                { label: 'Min Safe', data: timeLabels.map(() => 6.5), borderDash: [5,5] },
                { label: 'Max Safe', data: timeLabels.map(() => 8.5), borderDash: [5,5] }
            ]
        },
        options: commonOptions
    });

    turbidityChart = new Chart(document.getElementById("turbidityChart"), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'Turbidity', data: turbidityData, borderWidth: 2 },
                { label: 'Safe Limit', data: timeLabels.map(() => 5), borderDash: [5,5] }
            ]
        },
        options: commonOptions
    });

    tdsChart = new Chart(document.getElementById("tdsChart"), {
        type: 'line',
        data: {
            labels: timeLabels,
            datasets: [
                { label: 'TDS', data: tdsData, borderWidth: 2 },
                { label: 'Safe Limit', data: timeLabels.map(() => 300), borderDash: [5,5] }
            ]
        },
        options: commonOptions
    });
}

// 🔹 FETCH DATA
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

        const phEl = document.getElementById("phValue");
        const turbEl = document.getElementById("turbidityValue");
        const tdsEl = document.getElementById("tds");
        const tempEl = document.getElementById("temp");

        if (!data || !data.status) return;

        // 🔥 STATUS
        if (data.status === "Safe") statusEl.innerText = "🟢 SAFE";
        else if (data.status === "Warning") statusEl.innerText = "🟠 WARNING";
        else statusEl.innerText = "🔴 DANGER";

        if (confidenceEl) confidenceEl.innerText = data.confidence + "%";
        if (riskEl) riskEl.innerText = data.risk_level;

        // 🔥 SENSOR VALUES
        if (phEl) phEl.innerText = data.ph;
        if (turbEl) turbEl.innerText = data.turbidity;
        if (tdsEl) {
            let label = data.tds < 150 ? "Good" :
                        data.tds < 300 ? "OK" : "High";
            tdsEl.innerText = data.tds + " ppm (" + label + ")";
        }
        if (tempEl) tempEl.innerText = data.temperature + "°C";

        addAlert(data.trend_alert);

        // 🔥 ALERT TEXT
        let reason = "";
        if (data.turbidity > 70) reason += "Dirty water, ";
        if (data.tds > 500) reason += "High solids, ";
        if (data.ph < 6 || data.ph > 8) reason += "pH issue";

        if (alertEl) {
            alertEl.innerText = "⚠ " + data.trend_alert + (reason ? " | " + reason : "");
        }

        // 🔥 TOAST (ONLY ON CHANGE)
        if (data.status !== lastStatus) {
            if (data.status === "Danger") {
                showToast("🚨 Water Unsafe!", "danger");
            } else if (data.status === "Warning") {
                showToast("⚠ Water Warning!", "warning");
            } else {
                showToast("✅ Water Safe", "safe");
            }
            lastStatus = data.status;
        }

        // 🔥 MAP
        if (data.location) {
            if (locationEl) locationEl.innerText = "📍 " + data.location;

            const [lat, lng] = data.location.split(",").map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
                initMap(lat, lng, data.status);
            }
        }

        // 🔥 COLOR
        if (pulse) {
            const color = getColor(data.status);
            pulse.style.background = color;
            statusEl.style.color = color;

            // 🎨 GRAPH COLOR UPDATE
            phChart.data.datasets[0].borderColor = color;
            turbidityChart.data.datasets[0].borderColor = color;
            tdsChart.data.datasets[0].borderColor = color;
        }

        // 🔥 GRAPH DATA
        const now = new Date().toLocaleTimeString();

        timeLabels.push(now);
        phData.push(data.ph || 0);
        turbidityData.push(data.turbidity || 0);
        tdsData.push(data.tds || 0);

        if (timeLabels.length > 10) {
            timeLabels.shift();
            phData.shift();
            turbidityData.shift();
            tdsData.shift();
        }

        phChart.update();
        turbidityChart.update();
        tdsChart.update();

        // 🔥 HISTORY
        const historyList = document.getElementById("alertHistory");
        const historyCard = document.getElementById("historyCard");

        if (role === "authority") {
            if (historyCard) historyCard.style.display = "block";

            if (historyList) {
                historyList.innerHTML = "";
                alertHistory.forEach(alert => {
                    const li = document.createElement("li");
                    li.innerText = "⚠ " + alert;
                    historyList.appendChild(li);
                });
            }
        }

    } catch (error) {
        console.error("Fetch error:", error);
    }
}

// 🔁 RUN
window.onload = function () {

    if (role) {
        const roleEl = document.getElementById("roleDisplay");
        if (roleEl) roleEl.innerText = "Role: " + role.toUpperCase();
    }

    createCharts();
    fetchData();
    setInterval(fetchData, 3000);
};