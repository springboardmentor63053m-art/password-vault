
// ========================================
// SECURE VAULT - SHARING HISTORY
// ========================================

const API_BASE_URL = "http://localhost:8080";

const sharingHistoryList =
    document.getElementById("sharingHistoryList");

// ========================================
// AUTHENTICATION
// ========================================

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

// ========================================
// API REQUEST
// ========================================

async function historyApiRequest(url, options = {}) {
    const response = await fetch(API_BASE_URL + url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + getToken(),
            ...(options.headers || {})
        }
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(
            data?.message || "Unable to process sharing history."
        );
    }

    return data;
}

// ========================================
// LOAD SHARING HISTORY
// ========================================

async function loadSharingHistory() {
    if (!sharingHistoryList) return;

    sharingHistoryList.innerHTML =
        "<p>Loading sharing history...</p>";

    try {
        const history =
            await historyApiRequest("/api/shares/history") || [];

        displaySharingHistory(history);

    } catch (error) {
        console.error("Sharing history error:", error);
        sharingHistoryList.textContent = error.message;
    }
}

// ========================================
// DISPLAY SHARING HISTORY
// ========================================

function displaySharingHistory(history) {
    sharingHistoryList.innerHTML = "";

    if (!history.length) {
        sharingHistoryList.innerHTML =
            "<p>You haven't shared any credentials yet.</p>";
        return;
    }

    history.forEach(item => {
        const card = document.createElement("div");
        card.className = "credential-card";

        const title = document.createElement("h3");
        title.textContent =
            item.credentialTitle || item.title || "Shared Credential";

        const recipient = document.createElement("p");
        recipient.textContent =
            "Shared with: " +
            (item.recipientName || item.recipientEmail || "Unknown");

        const email = document.createElement("p");
        email.textContent =
            "Recipient email: " + (item.recipientEmail || "-");

        const permission = document.createElement("p");
        permission.textContent =
            "Permission: " + (item.permission || "-");

        const status = document.createElement("p");
        status.textContent =
            "Status: " + (item.status || "-");

        const date = document.createElement("p");

        if (item.sharedAt) {
            const formattedDate =
                new Date(item.sharedAt).toLocaleString();

            date.textContent = "Shared on: " + formattedDate;
        } else {
            date.textContent = "Shared on: -";
        }

        card.append(
            title,
            recipient,
            email,
            permission,
            status,
            date
        );

        // REVOKE ACCESS

        const revokeButton = document.createElement("button");
        revokeButton.textContent = "Revoke Access";

        const isActive =
            String(item.status || "").toUpperCase() === "ACTIVE";

        revokeButton.disabled = !isActive;

        if (!isActive) {
            revokeButton.textContent = "Access Revoked";
        }

        revokeButton.addEventListener("click", () => {
            revokeSharingAccess(item.shareId || item.id);
        });

        card.appendChild(revokeButton);

        sharingHistoryList.appendChild(card);
    });
}

// ========================================
// REVOKE SHARING ACCESS
// ========================================

async function revokeSharingAccess(shareId) {
    if (!shareId) {
        alert("Sharing ID not found. Please check the API response.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to revoke this user's access?"
    );

    if (!confirmed) return;

    try {
        await historyApiRequest(`/api/shares/${shareId}`, {
            method: "DELETE"
        });

        alert("Sharing access revoked successfully!");

        await loadSharingHistory();

    } catch (error) {
        console.error("Revoke error:", error);
        alert(error.message);
    }
}

// ========================================
// INITIALIZE
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuthentication()) return;

    loadSharingHistory();
});

console.log("SecureVault sharing history initialized.");
