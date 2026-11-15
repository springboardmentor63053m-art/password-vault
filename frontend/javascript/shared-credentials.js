
// ========================================
// SECURE VAULT - SHARED CREDENTIALS
// ========================================

const API_BASE_URL = "http://localhost:8080";

const sharedCredentialList =
    document.getElementById("sharedCredentialList");

const refreshSharedBtn =
    document.getElementById("refreshSharedBtn");

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

async function sharedApiRequest(url, options = {}) {
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
        throw new Error(data?.message || "Unable to load shared credentials.");
    }

    return data;
}

// ========================================
// LOAD SHARED CREDENTIALS
// ========================================

async function loadSharedCredentials() {
    if (!sharedCredentialList) return;

    sharedCredentialList.innerHTML = "<p>Loading shared credentials...</p>";

    try {
        const sharedCredentials =
            await sharedApiRequest("/api/shares/received") || [];

        displaySharedCredentials(sharedCredentials);

    } catch (error) {
        console.error("Shared credentials error:", error);
        sharedCredentialList.textContent = error.message;
    }
}

// ========================================
// DISPLAY SHARED CREDENTIALS
// ========================================

function displaySharedCredentials(sharedCredentials) {
    sharedCredentialList.innerHTML = "";

    if (!sharedCredentials.length) {
        sharedCredentialList.innerHTML =
            "<p>No credentials have been shared with you.</p>";
        return;
    }

    sharedCredentials.forEach(item => {

        const credential = item.credential || item;

        const card = document.createElement("div");
        card.className = "credential-card";

        const title = document.createElement("h3");
        title.textContent = credential.title || "Untitled";

        const website = document.createElement("p");
        website.textContent =
            "Website: " + (credential.website || "-");

        const username = document.createElement("p");
        username.textContent =
            "Username: " + (credential.username || "-");

        const password = document.createElement("p");
        password.textContent = "Password: ••••••••";

        const notes = document.createElement("p");
        notes.textContent =
            "Notes: " + (credential.notes || "-");

        const owner = document.createElement("p");
        owner.textContent =
            "Shared by: " +
            (item.ownerName || item.ownerEmail || "Unknown");

        const permission = document.createElement("p");
        const access = (item.permission || "").toUpperCase();

        permission.textContent = "Permission: " + access;

        const showButton = document.createElement("button");
        showButton.textContent = "Show Password";

        let passwordVisible = false;

        showButton.addEventListener("click", () => {
            passwordVisible = !passwordVisible;

            password.textContent = passwordVisible
                ? "Password: " + (credential.password || "")
                : "Password: ••••••••";

            showButton.textContent = passwordVisible
                ? "Hide Password"
                : "Show Password";
        });

        card.append(
            title,
            website,
            username,
            password,
            notes,
            owner,
            permission,
            showButton
        );

        // EDIT ACCESS
        if (access === "EDIT") {
            const editButton = document.createElement("button");
            editButton.textContent = "Edit Access";

            editButton.addEventListener("click", () => {
                alert(
                    "You have EDIT permission. " +
                    "The edit form will be connected after checking your backend response structure."
                );
            });

            card.appendChild(editButton);
        }

        sharedCredentialList.appendChild(card);
    });
}

// ========================================
// REFRESH
// ========================================

if (refreshSharedBtn) {
    refreshSharedBtn.addEventListener(
        "click",
        loadSharedCredentials
    );
}

// ========================================
// INITIALIZE
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    if (!checkAuthentication()) return;
    loadSharedCredentials();
});

console.log("SecureVault shared credentials initialized.");
