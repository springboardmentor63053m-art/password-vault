const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");
const role = (localStorage.getItem("vaultRole") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();

const threatsTable = document.getElementById("threatsTable");
const message = document.getElementById("message");
const refreshButton = document.getElementById("refreshThreatsButton");
const searchInput = document.getElementById("threatSearch");
const severityFilter = document.getElementById("severityFilter");

let allThreats = [];

if (!token || role !== "ADMIN") {
    window.location.replace("login.html");
} else {
    loadThreatAnalytics();
}

// Only include failed logins and explicitly detected suspicious logins.
function isThreatEvent(event) {
    const eventType = String(event.eventType || "").toUpperCase();
    const status = String(event.status || "").toUpperCase();

    return (
        (eventType === "LOGIN" && status === "FAILED") ||
        (eventType === "SUSPICIOUS_LOGIN" && status === "DETECTED")
    );
}

// These severity levels are starter analytics rules.
// They are classifications, not proof that an attack occurred.
function getThreatSeverity(event) {
    const eventType = String(event.eventType || "").toUpperCase();
    const status = String(event.status || "").toUpperCase();

    if (
        eventType === "SUSPICIOUS_LOGIN" &&
        status === "DETECTED"
    ) {
        return "HIGH";
    }

    if (eventType === "LOGIN" && status === "FAILED") {
        return "MEDIUM";
    }

    return "LOW";
}

async function loadThreatAnalytics() {
    if (refreshButton) {
        refreshButton.disabled = true;
    }

    setText("totalThreats", "...");
    setText("highRiskThreats", "...");
    setText("mediumRiskThreats", "...");
    setText("lowRiskThreats", "...");

    if (threatsTable) {
        threatsTable.replaceChildren();

        const row = threatsTable.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 6;
        cell.textContent = "Loading threat events...";
    }

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/admin/security/events`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: "application/json"
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            throw new Error(
                "Access denied. Log in with an admin account."
            );
        }

        if (!response.ok) {
            throw new Error(
                `Security events API returned ${response.status}.`
            );
        }

        const events = await response.json();

        if (!Array.isArray(events)) {
            throw new Error(
                "The security events API did not return a JSON array."
            );
        }

        allThreats = events.filter(isThreatEvent);

        renderStatistics(allThreats);
        renderThreats(allThreats);
        renderThreatTrends(allThreats);

        showMessage(
            `Loaded ${allThreats.length} threat-related events.`,
            "success"
        );

    } catch (error) {
        console.error("Threat analytics error:", error);

        allThreats = [];

        setText("totalThreats", "—");
        setText("highRiskThreats", "—");
        setText("mediumRiskThreats", "—");
        setText("lowRiskThreats", "—");
        setText("threatCountLabel", "Unavailable");
        setText("tableSummary", "Threat data could not be loaded.");

        if (threatsTable) {
            threatsTable.replaceChildren();

            const row = threatsTable.insertRow();
            const cell = row.insertCell();

            cell.colSpan = 6;
            cell.textContent = error.message;
        }

        const chart = document.getElementById("threatTrendChart");

        if (chart) {
            chart.replaceChildren();

            const text = document.createElement("p");
            text.className = "empty-state";
            text.textContent = "Threat trend data is unavailable.";

            chart.appendChild(text);
        }

        showMessage(error.message, "error");

    } finally {
        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

function renderStatistics(threats) {
    let high = 0;
    let medium = 0;
    let low = 0;

    threats.forEach(event => {
        const severity = getThreatSeverity(event);

        if (severity === "HIGH") high++;
        else if (severity === "MEDIUM") medium++;
        else low++;
    });

    setText("totalThreats", threats.length);
    setText("highRiskThreats", high);
    setText("mediumRiskThreats", medium);
    setText("lowRiskThreats", low);
}

function renderThreats(threats) {
    if (!threatsTable) return;

    threatsTable.replaceChildren();

    const query = (searchInput?.value || "").trim().toLowerCase();
    const selectedSeverity = severityFilter?.value || "ALL";

    const filtered = threats.filter(event => {
        const severity = getThreatSeverity(event);

        const matchesSeverity =
            selectedSeverity === "ALL" ||
            severity === selectedSeverity;

        const searchableText = [
            event.userEmail,
            event.eventType,
            event.status,
            event.details
        ].join(" ").toLowerCase();

        return matchesSeverity && searchableText.includes(query);
    });

    setText("threatCountLabel", `${filtered.length} events`);
    setText(
        "tableSummary",
        `Showing ${filtered.length} of ${threats.length} threat-related events.`
    );

    if (filtered.length === 0) {
        const row = threatsTable.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 6;
        cell.textContent = threats.length === 0
            ? "No threat-related events were found."
            : "No events match your search or severity filter.";

        return;
    }

    filtered.forEach(event => {
        const row = threatsTable.insertRow();

        const emailCell = row.insertCell();
        emailCell.textContent = event.userEmail || "Unknown";

        const typeCell = row.insertCell();
        typeCell.textContent = event.eventType || "Unknown";

        const severity = getThreatSeverity(event);
        const severityCell = row.insertCell();
        const severityBadge = document.createElement("span");

        severityBadge.className =
            `risk-badge risk-${severity.toLowerCase()}`;
        severityBadge.textContent = severity;

        severityCell.appendChild(severityBadge);

        const statusCell = row.insertCell();
        const statusBadge = document.createElement("span");
        const status = String(event.status || "UNKNOWN").toUpperCase();

        statusBadge.className = "status-badge";

        if (status === "FAILED") {
            statusBadge.classList.add("status-failed");
        } else if (status === "DETECTED") {
            statusBadge.classList.add("status-detected");
        } else if (status === "SUCCESS") {
            statusBadge.classList.add("status-success");
        }

        statusBadge.textContent = status;
        statusCell.appendChild(statusBadge);

        const detailsCell = row.insertCell();
        detailsCell.textContent = event.details || "—";

        const timeCell = row.insertCell();
        timeCell.textContent = event.eventTime
            ? formatDate(event.eventTime)
            : "—";
    });
}

// Group the returned events by local calendar date and render a bar chart.
function renderThreatTrends(threats) {
    const chart = document.getElementById("threatTrendChart");

    if (!chart) return;

    chart.replaceChildren();

    if (threats.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No threat events available to chart.";

        chart.appendChild(empty);
        return;
    }

    const countsByDate = new Map();

    threats.forEach(event => {
        if (!event.eventTime) return;

        const date = new Date(event.eventTime);

        if (Number.isNaN(date.getTime())) return;

        const key = [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");

        countsByDate.set(key, (countsByDate.get(key) || 0) + 1);
    });

    const entries = [...countsByDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-7);

    if (entries.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent =
            "No valid event timestamps are available for the chart.";

        chart.appendChild(empty);
        return;
    }

    const maxCount = Math.max(...entries.map(entry => entry[1]), 1);

    const bars = document.createElement("div");
    bars.className = "chart-bars";

    entries.forEach(([dateKey, count]) => {
        const column = document.createElement("div");
        column.className = "chart-column";

        const value = document.createElement("span");
        value.className = "chart-value";
        value.textContent = String(count);

        const track = document.createElement("div");
        track.className = "chart-bar-track";

        const bar = document.createElement("div");
        bar.className = "chart-bar";
        bar.style.height = `${(count / maxCount) * 100}%`;
        bar.title = `${dateKey}: ${count} threat-related events`;

        track.appendChild(bar);

        const label = document.createElement("span");
        label.className = "chart-label";

        const parts = dateKey.split("-");
        label.textContent = `${parts[2]}/${parts[1]}`;

        column.append(value, track, label);
        bars.appendChild(column);
    });

    chart.appendChild(bars);
}

function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
        element.textContent = String(value);
    }
}

function showMessage(text, type) {
    if (!message) return;

    message.textContent = text;
    message.className = type;
}

function formatDate(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString();
}

// Filter events as the admin types or changes severity.
if (searchInput) {
    searchInput.addEventListener("input", () => {
        renderThreats(allThreats);
    });
}

if (severityFilter) {
    severityFilter.addEventListener("change", () => {
        renderThreats(allThreats);
    });
}

if (refreshButton) {
    refreshButton.addEventListener("click", loadThreatAnalytics);
}

const backButton = document.getElementById("backButton");

if (backButton) {
    backButton.addEventListener("click", () => {
        window.location.href = "admin-dashboard.html";
    });
}

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {
    logoutButton.addEventListener("click", () => {
        localStorage.removeItem("vaultToken");
        localStorage.removeItem("vaultRole");
        localStorage.removeItem("vaultName");
        localStorage.removeItem("vaultEmail");

        window.location.replace("login.html");
    });
}
