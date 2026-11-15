
const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");

const role = (localStorage.getItem("vaultRole") || "")
    .replace(/^ROLE_/, "")
    .toUpperCase();

const staffForm = document.getElementById("addStaffForm");
const staffTable = document.getElementById("staffTable");
const staffMessage = document.getElementById("staffMessage");
const searchInput = document.getElementById("staffSearch");
const message = document.getElementById("message");

let allStaff = [];

if (!token || role !== "ADMIN") {
    window.location.replace("login.html");
} else {
    const adminName = document.getElementById("adminName");

    if (adminName) {
        adminName.textContent =
            localStorage.getItem("vaultName") || "Admin";
    }

    loadStaff();
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
// LOAD STAFF
// ========================================

async function loadStaff() {

    const refreshButton = document.getElementById("refreshButton");

    if (refreshButton) {
        refreshButton.disabled = true;
    }

    staffTable.innerHTML =
        '<tr><td colspan="6">Loading staff...</td></tr>';

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
            clearSession();
            return;
        }

        if (!response.ok) {
            throw new Error(`Failed to load staff (${response.status}).`);
        }

        const users = await response.json();

        if (!Array.isArray(users)) {
            throw new Error("Invalid staff response.");
        }

        allStaff = users.filter(user => {
            const userRole = normalizeRole(user.role);
            return userRole === "ADMIN" || userRole === "MANAGER";
        });

        renderStaff(allStaff);

        if (message) {
            message.textContent = "Staff information loaded successfully.";
            message.className = "success";
        }

    } catch (error) {

        console.error(error);

        staffTable.innerHTML =
            '<tr><td colspan="6">Unable to load staff.</td></tr>';

        if (message) {
            message.textContent =
                error instanceof TypeError
                    ? "Cannot connect to the backend."
                    : error.message;

            message.className = "error";
        }

    } finally {

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}

// ========================================
// DISPLAY STAFF
// ========================================

function renderStaff(staff) {

    staffTable.replaceChildren();

    if (staff.length === 0) {
        const row = staffTable.insertRow();
        const cell = row.insertCell();

        cell.colSpan = 6;
        cell.textContent = "No staff accounts found.";
        return;
    }

    staff.forEach(user => {

        const row = staffTable.insertRow();

        const values = [
            user.id ?? "",
            user.name ?? "",
            user.email ?? "",
            normalizeRole(user.role)
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
    });
}

// ========================================
// CREATE STAFF ACCOUNT
// ========================================

if (staffForm) {

    staffForm.addEventListener("submit", async event => {

        event.preventDefault();

        const name = document.getElementById("staffName").value.trim();
        const email = document.getElementById("staffEmail").value.trim();
        const password = document.getElementById("staffPassword").value;
        const staffRole = document.getElementById("staffRole").value;

        staffMessage.textContent = "";
        staffMessage.className = "";

        if (password.length < 8) {
            showStaffMessage(
                "Password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        const submitButton = staffForm.querySelector(
            'button[type="submit"]'
        );

        try {

            submitButton.disabled = true;
            submitButton.textContent = "Creating...";

            const response = await fetch(
                `${API_BASE_URL}/api/admin/create-staff`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        role: staffRole
                    })
                }
            );

            const data = await response.json().catch(() => ({}));

            if (response.status === 401 || response.status === 403) {
                clearSession();
                return;
            }

            if (!response.ok) {
                throw new Error(
                    data.message ||
                    `Account creation failed (${response.status}).`
                );
            }

            showStaffMessage(
                data.message || "Staff account created successfully.",
                "success"
            );

            staffForm.reset();

            await loadStaff();

        } catch (error) {

            showStaffMessage(
                error instanceof TypeError
                    ? "Cannot connect to the backend."
                    : error.message,
                "error"
            );

        } finally {

            submitButton.disabled = false;
            submitButton.textContent = "Create Staff Account";
        }
    });
}

// ========================================
// SEARCH STAFF
// ========================================

if (searchInput) {

    searchInput.addEventListener("input", () => {

        const query = searchInput.value.trim().toLowerCase();

        const filteredStaff = allStaff.filter(user =>

            String(user.name || "").toLowerCase().includes(query) ||

            String(user.email || "").toLowerCase().includes(query) ||

            normalizeRole(user.role).toLowerCase().includes(query)
        );

        renderStaff(filteredStaff);
    });
}

// ========================================
// REFRESH
// ========================================

const refreshButton = document.getElementById("refreshButton");

if (refreshButton) {
    refreshButton.addEventListener("click", loadStaff);
}

// ========================================
// HELPERS
// ========================================

function showStaffMessage(text, type) {

    staffMessage.textContent = text;
    staffMessage.className = type;
}

function clearSession() {

    localStorage.removeItem("vaultToken");
    localStorage.removeItem("vaultRole");
    localStorage.removeItem("vaultName");
    localStorage.removeItem("vaultEmail");

    window.location.replace("login.html");
}

// ========================================
// LOGOUT
// ========================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {

    logoutButton.addEventListener("click", () => {
        clearSession();
    });
}
