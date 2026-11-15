
const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");

const role = (localStorage.getItem("vaultRole") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();

const usersTable = document.getElementById("usersTable");
const searchInput = document.getElementById("search");
const message = document.getElementById("message");

let allUsers = [];

if (!token || role !== "ADMIN") {
    window.location.replace("login.html");
} else {
    const adminName = document.getElementById("adminName");

    if (adminName) {
        adminName.textContent =
            localStorage.getItem("vaultName") || "Admin";
    }

    loadUsers();
}

function normalizeRole(role) {
    return String(role || "")
        .replace(/^ROLE_/, "")
        .toUpperCase();
}

// ========================================
// LOAD USERS
// ========================================

async function loadUsers() {

    const refreshButton =
        document.getElementById("refreshButton");

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    usersTable.innerHTML =
        '<tr><td colspan="7">Loading users...</td></tr>';

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

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem("vaultToken");
            localStorage.removeItem("vaultRole");
            localStorage.removeItem("vaultName");
            localStorage.removeItem("vaultEmail");

            window.location.replace("login.html");
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to load users (${response.status}).`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Invalid users response.");
        }

        allUsers = data;
        renderUsers(allUsers);

        showMessage("Users loaded successfully.", "success");

    } catch (error) {

        console.error(error);

        usersTable.innerHTML =
            '<tr><td colspan="7">Unable to load users.</td></tr>';

        showMessage(
            error instanceof TypeError
                ? "Cannot connect to the backend."
                : error.message,
            "error"
        );

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

// ========================================
// DISPLAY USERS
// ========================================

function renderUsers(users) {

    usersTable.replaceChildren();

    if (users.length === 0) {
        const row = usersTable.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 7;
        cell.textContent = "No users found.";
        return;
    }

    const adminEmail =
        (localStorage.getItem("vaultEmail") || "").toLowerCase();

    users.forEach(user => {

        const row = usersTable.insertRow();

        const values = [
            user.id ?? "",
            user.name ?? "",
            user.email ?? "",
            normalizeRole(user.role) || "UNKNOWN"
        ];

        values.forEach((value, index) => {

            const cell = row.insertCell();

            if (index === 3) {
                const badge = document.createElement("span");
                badge.className = "role";
                badge.textContent = String(value);
                cell.appendChild(badge);
            } else {
                cell.textContent = String(value);
            }
        });

        const statusCell = row.insertCell();
        const active = user.active === true;

        statusCell.textContent = active ? "Active" : "Inactive";
        statusCell.className = active
            ? "status-active"
            : "status-inactive";

        const createdCell = row.insertCell();

        createdCell.textContent = user.createdAt
            ? new Date(user.createdAt).toLocaleDateString()
            : "—";

        const actionCell = row.insertCell();

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "Delete";

        const isCurrentAdmin =
            String(user.email || "").toLowerCase() === adminEmail;

        if (isCurrentAdmin) {
            deleteButton.disabled = true;
            deleteButton.title = "You cannot delete your own account";
        } else {
            deleteButton.addEventListener("click", () => {
                deleteUser(user.id, user.name);
            });
        }

        actionCell.appendChild(deleteButton);
    });
}

// ========================================
// DELETE USER
// ========================================

async function deleteUser(userId, userName) {

    const confirmed = window.confirm(
        `Are you sure you want to delete ${userName}? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {

        showMessage("Deleting user...", "success");

        const response = await fetch(
            `${API_BASE_URL}/api/admin/users/${userId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Accept": "application/json"
                }
            }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.message || `Failed to delete user (${response.status}).`
            );
        }

        await loadUsers();

        showMessage(
            data.message || "User deleted successfully.",
            "success"
        );

    } catch (error) {

        showMessage(
            error instanceof TypeError
                ? "Cannot connect to the backend."
                : error.message,
            "error"
        );
    }
}

// ========================================
// SEARCH USERS
// ========================================

if (searchInput) {

    searchInput.addEventListener("input", () => {

        const query = searchInput.value.trim().toLowerCase();

        const filteredUsers = allUsers.filter(user =>

            String(user.name || "").toLowerCase().includes(query) ||

            String(user.email || "").toLowerCase().includes(query) ||

            normalizeRole(user.role).includes(query)
        );

        renderUsers(filteredUsers);
    });
}

// ========================================
// REFRESH
// ========================================

const refreshButton = document.getElementById("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", loadUsers);
}

// ========================================
// COMMON HELPERS
// ========================================

function showMessage(text, type) {

    if (!message) return;

    message.textContent = text;
    message.className = type;
}

// ========================================
// LOGOUT
// ========================================

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
