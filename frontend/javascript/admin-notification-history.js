
const API_BASE_URL = "http://localhost:8080";

document.addEventListener("DOMContentLoaded", () => {
    loadNotificationHistory();

    document.getElementById("refreshButton")
        ?.addEventListener("click", loadNotificationHistory);

    document.getElementById("logoutButton")
        ?.addEventListener("click", logout);
});

async function loadNotificationHistory() {

    const token = localStorage.getItem("vaultToken");
    const tableBody = document.getElementById("notificationTableBody");
    const message = document.getElementById("message");

    if (!token) {
        window.location.href = "login.html";
        return;
    }

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">
                Loading notification history...
            </td>
        </tr>
    `;

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/admin/notifications/history`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            throw new Error("You are not authorized to view notification history.");
        }

        if (!response.ok) {
            throw new Error("Failed to load notification history.");
        }

        const notifications = await response.json();

        displayNotificationHistory(notifications);
        updateStatistics(notifications);

        message.textContent = "";

    } catch (error) {

        console.error("Notification history error:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    ${escapeHTML(error.message)}
                </td>
            </tr>
        `;

        message.textContent = error.message;
    }
}

function displayNotificationHistory(notifications) {

    const tableBody = document.getElementById("notificationTableBody");

    if (!notifications || notifications.length === 0) {

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    No notifications have been sent yet.
                </td>
            </tr>
        `;

        return;
    }

    tableBody.innerHTML = notifications.map(notification => {

        const statusClass = notification.read
            ? "status-read"
            : "status-unread";

        const statusText = notification.read
            ? "Read"
            : "Unread";

        return `
            <tr>
                <td>${escapeHTML(notification.userName)}</td>

                <td>${escapeHTML(notification.userEmail)}</td>

                <td>${escapeHTML(notification.credentialTitle)}</td>

                <td class="history-message">
                    <strong>${escapeHTML(notification.title)}</strong>
                    <p>${escapeHTML(notification.message)}</p>
                </td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>

                <td>${formatDate(notification.createdAt)}</td>
            </tr>
        `;

    }).join("");
}

function updateStatistics(notifications) {

    const total = notifications.length;

    const unread = notifications.filter(
        notification => !notification.read
    ).length;

    const read = total - unread;

    document.getElementById("totalNotifications").textContent = total;
    document.getElementById("unreadNotifications").textContent = unread;
    document.getElementById("readNotifications").textContent = read;
}

function formatDate(dateValue) {

    if (!dateValue) {
        return "—";
    }

    const date = new Date(dateValue);

    if (isNaN(date.getTime())) {
        return "—";
    }

    return date.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function escapeHTML(value) {

    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

function logout() {

    localStorage.removeItem("vaultToken");
    localStorage.removeItem("vaultRole");
    localStorage.removeItem("vaultName");
    localStorage.removeItem("vaultEmail");

    window.location.href = "login.html";
}
