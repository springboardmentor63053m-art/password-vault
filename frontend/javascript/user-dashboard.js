
const API_BASE_URL = "http://localhost:8080";

function getToken() {
    return localStorage.getItem("vaultToken");
}

function checkAuthentication() {

    if (!getToken()) {
        alert("Please login to continue.");
        window.location.href = "login.html";
        return false;
    }

    return true;
}



async function dashboardApiRequest(url) {

    const token = getToken();

    const response = await fetch(API_BASE_URL + url, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json"
        }
    });

    if (!response.ok) {
        throw new Error("Unable to load dashboard information.");
    }

    return response.json();
}


async function loadDashboardStatistics() {

    const totalElement =
        document.getElementById("totalCredentials");

    const sharedElement =
        document.getElementById("sharedCredentials");

    const recentElement =
        document.getElementById("recentCredentials");

    try {

        const [credentials, sharedCredentials] =
            await Promise.all([
                dashboardApiRequest("/api/user/credentials"),
                dashboardApiRequest("/api/shares/received")
            ]);

        const total = Array.isArray(credentials)
            ? credentials.length
            : 0;

        const shared = Array.isArray(sharedCredentials)
            ? sharedCredentials.length
            : 0;

        const sevenDaysAgo = new Date();

        sevenDaysAgo.setDate(
            sevenDaysAgo.getDate() - 7
        );

        const recent = Array.isArray(credentials)
            ? credentials.filter(item => {

                if (!item.createdAt) return false;

                return new Date(item.createdAt) >= sevenDaysAgo;

            }).length
            : 0;

        if (totalElement) {
            totalElement.textContent = total;
        }

        if (sharedElement) {
            sharedElement.textContent = shared;
        }

        if (recentElement) {
            recentElement.textContent = recent;
        }

    } catch (error) {

        console.error("Dashboard error:", error);

        if (totalElement) totalElement.textContent = "-";
        if (sharedElement) sharedElement.textContent = "-";
        if (recentElement) recentElement.textContent = "-";
    }
}



async function loadUnreadNotificationCount() {

    const badge =
        document.getElementById("notificationBadge");

    if (!badge) return;

    try {

        const result = await dashboardApiRequest(
            "/api/user/notifications/unread-count"
        );

        const unreadCount = Number(result);

        if (!Number.isFinite(unreadCount)) {
            throw new Error("Invalid unread notification count.");
        }

        if (unreadCount > 0) {

            badge.textContent = unreadCount > 99
                ? "99+"
                : unreadCount;

            badge.style.display = "inline-flex";

        } else {

            badge.textContent = "0";
            badge.style.display = "none";
        }

    } catch (error) {

        console.error(
            "Notification count error:",
            error
        );

        badge.style.display = "none";
    }
}



const logoutBtn =
    document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

        const confirmed =
            confirm("Are you sure you want to logout?");

        if (!confirmed) return;

        localStorage.removeItem("vaultToken");
        localStorage.removeItem("vaultRole");
        localStorage.removeItem("vaultName");
        localStorage.removeItem("vaultEmail");

        window.location.href = "login.html";
    });
}



document.addEventListener("DOMContentLoaded", () => {

    if (!checkAuthentication()) return;

    loadDashboardStatistics();

    // Load unread security notification count
    loadUnreadNotificationCount();

});

console.log("SecureVault dashboard initialized.");
