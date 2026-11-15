// ========================================
// SECUREVAULT SECURITY MONITORING
// ========================================

const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");

const role = (localStorage.getItem("vaultRole") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();


// ========================================
// 1. AUTHENTICATION CHECK
// ========================================

if (!token || role !== "ADMIN") {
    window.location.replace("login.html");
} else {
    initializeSecurityMonitoring();
}


// ========================================
// 2. INITIALIZATION
// ========================================

function initializeSecurityMonitoring() {

    const adminName = document.getElementById("adminName");

    if (adminName) {
        adminName.textContent =
            localStorage.getItem("vaultName") || "Admin";
    }

    document.getElementById("refreshSecurityButton")
        ?.addEventListener("click", loadSecurityData);

    setupLogout();

    loadSecurityData();
}


// ========================================
// 3. LOAD SECURITY DATA
// ========================================

async function loadSecurityData() {

    const refreshButton =
        document.getElementById("refreshSecurityButton");

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    showMessage("", "");

    setText("successfulLogins", "...");
    setText("failedLogins", "...");
    setText("totalSecurityEvents", "...");
    setText("suspiciousActivity", "...");

    try {

        const headers = {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
        };

        const [statsResponse, eventsResponse] = await Promise.all([

            fetch(`${API_BASE_URL}/api/admin/security/stats`, {
                method: "GET",
                headers
            }),

            fetch(`${API_BASE_URL}/api/admin/security/events`, {
                method: "GET",
                headers
            })

        ]);

        if (
            statsResponse.status === 401 ||
            statsResponse.status === 403 ||
            eventsResponse.status === 401 ||
            eventsResponse.status === 403
        ) {
            logout();
            return;
        }

        if (!statsResponse.ok) {
            throw new Error(
                `Security statistics request failed (${statsResponse.status}).`
            );
        }

        if (!eventsResponse.ok) {
            throw new Error(
                `Security events request failed (${eventsResponse.status}).`
            );
        }

        const stats = await statsResponse.json();
        const events = await eventsResponse.json();

        displayStatistics(stats);
        displaySecurityEvents(events);

        showMessage("Security data loaded successfully.", "success");

    } catch (error) {

        console.error("Security monitoring error:", error);

        showMessage(
            error instanceof TypeError
                ? "Cannot connect to the backend."
                : error.message,
            "error"
        );

        setText("successfulLogins", "—");
        setText("failedLogins", "—");
        setText("totalSecurityEvents", "—");
        setText("suspiciousActivity", "—");

        document.getElementById("securityEventsTable").innerHTML = `
            <tr>
                <td colspan="5">Unable to load security events.</td>
            </tr>
        `;

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}


// ========================================
// 4. DISPLAY STATISTICS
// ========================================

function displayStatistics(stats) {

    setText(
        "successfulLogins",
        stats.successfulLogins ?? 0
    );

    setText(
        "failedLogins",
        stats.failedLogins ?? 0
    );

    setText(
        "totalSecurityEvents",
        stats.totalEvents ?? stats.totalSecurityEvents ?? 0
    );

    setText(
        "suspiciousActivity",
        stats.suspiciousActivity ?? stats.suspiciousLogins ?? 0
    );
}


// ========================================
// 5. DISPLAY SECURITY EVENTS
// ========================================

function displaySecurityEvents(events) {

    const table = document.getElementById("securityEventsTable");

    if (!Array.isArray(events) || events.length === 0) {

        table.innerHTML = `
            <tr>
                <td colspan="5">No security events found.</td>
            </tr>
        `;

        return;
    }

    table.innerHTML = events.map(event => {

        const status = String(event.status || "UNKNOWN").toUpperCase();

        const statusClass =
            status === "SUCCESS" ? "status-active" : "status-inactive";

        const dateValue = event.eventTime
            ? new Date(event.eventTime).toLocaleString()
            : "N/A";

        return `
            <tr>
                <td>${escapeHTML(event.userEmail || "N/A")}</td>
                <td>${escapeHTML(event.eventType || "N/A")}</td>
                <td>
                    <span class="${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>
                <td>${escapeHTML(event.details || "N/A")}</td>
                <td>${escapeHTML(dateValue)}</td>
            </tr>
        `;

    }).join("");
}


// ========================================
// 6. HTML ESCAPING
// ========================================

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}


// ========================================
// 7. COMMON HELPERS
// ========================================

function setText(elementId, value) {

    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = String(value);
    }
}

function showMessage(message, type) {

    const messageElement = document.getElementById("message");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = type;
}


// ========================================
// 8. LOGOUT
// ========================================

function setupLogout() {

    document.getElementById("logoutButton")
        ?.addEventListener("click", logout);
}

function logout() {

    localStorage.removeItem("vaultToken");
    localStorage.removeItem("vaultRole");
    localStorage.removeItem("vaultName");
    localStorage.removeItem("vaultEmail");

    window.location.replace("login.html");
}