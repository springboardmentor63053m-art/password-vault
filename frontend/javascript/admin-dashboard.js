
const API_BASE_URL = "http://localhost:8080";

// ========================================
// AUTHENTICATION
// ========================================

const token = localStorage.getItem("vaultToken");

const role = (localStorage.getItem("vaultRole") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();

if (!token || role !== "ADMIN") {
    window.location.replace("login.html");
} else {
    initializeDashboard();
}

// ========================================
// INITIALIZE DASHBOARD
// ========================================

function initializeDashboard() {

    loadAdminName();

    loadDashboardStatistics();

    const refreshButton =
        document.getElementById("refreshButton");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            () => {
                loadAdminName();
                loadDashboardStatistics();
            }
        );
    }

    setupLogout();
}

// ========================================
// LOAD LATEST ADMIN NAME FROM DATABASE
// ========================================

async function loadAdminName() {

    const adminName = document.getElementById("adminName");

    if (!adminName) return;

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/profile`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load admin profile.");
        }

        const admin = await response.json();

        adminName.textContent = admin.name;

        // Keep localStorage synchronized
        localStorage.setItem("vaultName", admin.name);

    } catch (error) {

        console.error("Admin name loading error:", error);

    }
}

// ========================================
// LOAD DASHBOARD STATISTICS
// ========================================

async function loadDashboardStatistics() {

    const refreshButton =
        document.getElementById("refreshButton");

    const message =
        document.getElementById("message");

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    if (message) {
        message.textContent = "";
    }

    setText("totalUsers", "...");
    setText("adminCount", "...");
    setText("managerCount", "...");
    setText("userCount", "...");

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/users`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        if (response.status === 401 ||
            response.status === 403) {

            localStorage.clear();
            window.location.replace("login.html");
            return;
        }

        if (!response.ok) {
            throw new Error(
                `Failed to load dashboard data (${response.status}).`
            );
        }

        const users = await response.json();

        if (!Array.isArray(users)) {
            throw new Error(
                "Invalid response received from users API."
            );
        }

        const adminCount = users.filter(
            user => normalizeRole(user.role) === "ADMIN"
        ).length;

        const managerCount = users.filter(
            user => normalizeRole(user.role) === "MANAGER"
        ).length;

        const userCount = users.filter(
            user => normalizeRole(user.role) === "USER"
        ).length;

        setText("totalUsers", users.length);
        setText("adminCount", adminCount);
        setText("managerCount", managerCount);
        setText("userCount", userCount);

        if (message) {
            message.textContent =
                "Dashboard statistics loaded successfully.";

            message.className = "success";
        }

    } catch (error) {

        console.error("Dashboard error:", error);

        if (message) {
            message.textContent =
                error instanceof TypeError
                    ? "Cannot connect to the backend."
                    : error.message;

            message.className = "error";
        }

        setText("totalUsers", "—");
        setText("adminCount", "—");
        setText("managerCount", "—");
        setText("userCount", "—");

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

// ========================================
// ROLE NORMALIZATION
// ========================================

function normalizeRole(role) {

    return String(role || "")
        .replace(/^ROLE_/, "")
        .toUpperCase();
}

// ========================================
// UPDATE HTML ELEMENTS
// ========================================

function setText(elementId, value) {

    const element = document.getElementById(elementId);

    if (element) {
        element.textContent = String(value);
    }
}

// ========================================
// LOGOUT
// ========================================

function setupLogout() {

    const logoutButton =
        document.getElementById("logoutButton");

    if (logoutButton) {

        logoutButton.addEventListener("click", () => {

            localStorage.removeItem("vaultToken");
            localStorage.removeItem("vaultRole");
            localStorage.removeItem("vaultName");
            localStorage.removeItem("vaultEmail");

            window.location.replace("login.html");
        });
    }
}
