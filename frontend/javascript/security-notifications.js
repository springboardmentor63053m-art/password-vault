
const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");

const notificationList = document.getElementById("notificationList");
const totalNotifications = document.getElementById("totalNotifications");
const unreadNotifications = document.getElementById("unreadNotifications");


if (!token) {
    window.location.href = "login.html";
}


async function loadNotifications() {

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/user/notifications`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            alert("Session expired. Please login again.");
            localStorage.removeItem("vaultToken");
            window.location.href = "login.html";
            return;
        }

        if (!response.ok) {
            throw new Error("Failed to load notifications");
        }

        const notifications = await response.json();

        totalNotifications.textContent = notifications.length;

        displayNotifications(notifications);

        await loadUnreadCount();

    } catch (error) {
        console.error("Notification loading error:", error);

        notificationList.innerHTML = `
            <div class="empty-notifications">
                <h3>Unable to load notifications</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}


async function loadUnreadCount() {

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/user/notifications/unread-count`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Failed to load unread count");
        }

        const count = await response.json();

        unreadNotifications.textContent = count;

    } catch (error) {
        console.error("Unread count error:", error);
    }
}


function displayNotifications(notifications) {

    notificationList.innerHTML = "";

    if (!notifications || notifications.length === 0) {

        notificationList.innerHTML = `
            <div class="empty-notifications">
                <h3>No Security Notifications</h3>
                <p>You are all caught up. Your vault is waiting for you.</p>
            </div>
        `;

        return;
    }

    notifications.forEach(notification => {

        const card = document.createElement("div");

        card.className = notification.read
            ? "notification-card read"
            : "notification-card";

        const date = notification.createdAt
            ? new Date(notification.createdAt).toLocaleString()
            : "Date unavailable";

        card.innerHTML = `
            <div class="notification-top">
                <div class="notification-title">
                    ${escapeHTML(notification.title)}
                </div>

                <span class="notification-badge">
                    ${notification.read ? "Read" : "Unread"}
                </span>
            </div>

            <div class="notification-message">
                ${escapeHTML(notification.message)}
            </div>

            <div class="notification-meta">
                Credential: ${escapeHTML(notification.credentialTitle || "Unknown")}
                <br>
                Received: ${escapeHTML(date)}
            </div>

            <div class="notification-actions">

                <a href="credentials.html"
                   class="change-password-btn">
                    View My Credentials
                </a>

                ${
                    !notification.read
                    ? `<button class="mark-read-btn"
                               onclick="markAsRead(${notification.id})">
                            Mark as Read
                       </button>`
                    : ""
                }

            </div>
        `;

        notificationList.appendChild(card);
    });
}


async function markAsRead(notificationId) {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/user/notifications/${notificationId}/read`,
            {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to mark notification as read");
        }


        await loadNotifications();

    } catch (error) {

        console.error("Mark as read error:", error);

        alert("Unable to update notification. Please try again.");
    }
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

loadNotifications();
