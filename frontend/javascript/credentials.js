
// ========================================
// SECURE VAULT - CREDENTIALS
// ========================================

const API_BASE_URL = "http://localhost:8080";

const credentialForm = document.getElementById("credentialForm");
const credentialList = document.getElementById("credentialList");
const addCredentialBtn = document.getElementById("addCredentialBtn");
const cancelCredentialBtn = document.getElementById("cancelCredentialBtn");

let credentials = [];


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

async function credentialApiRequest(url, options = {}) {

    const token = getToken();

    const response = await fetch(API_BASE_URL + url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
            ...(options.headers || {})
        }
    });

    if (response.status === 204) return null;

    const data = await response.json().catch(() => null);

    if (!response.ok) {
        throw new Error(data?.message || "Something went wrong.");
    }

    return data;
}


// ========================================
// SHOW MESSAGE
// ========================================

function showVaultMessage(message, type = "success") {

    const messageElement = document.getElementById("vaultMessage");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = type;
}


// ========================================
// RESET FORM
// ========================================

function resetCredentialForm() {

    if (!credentialForm) return;

    credentialForm.reset();

    document.getElementById("credentialId").value = "";

    document.getElementById("formTitle").textContent =
        "Add New Credential";

    document.getElementById("saveCredentialBtn").textContent =
        "Save Credential";
}


// ========================================
// OPEN FORM
// ========================================

function openCredentialForm() {

    credentialForm.style.display = "block";

    credentialForm.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


// ========================================
// CLOSE FORM
// ========================================

function closeCredentialForm() {

    resetCredentialForm();

    credentialForm.style.display = "none";
}


// ========================================
// LOAD CREDENTIALS
// ========================================

async function loadCredentials() {

    try {

        credentials =
            await credentialApiRequest("/api/user/credentials") || [];

        updateCategoryCounts(credentials);

        updateSelectedCategoryHeading(credentials);

        displayCredentials();

    } catch (error) {

        console.error("Load credentials error:", error);

        showVaultMessage(error.message, "error");

    }
}


// ========================================
// DISPLAY CREDENTIALS
// ========================================

function displayCredentials() {

    if (!credentialList) return;

    credentialList.innerHTML = "";

    const filteredCredentials = selectedCategory === "All"
        ? credentials
        : credentials.filter(
            credential => credential.category === selectedCategory
        );

    if (filteredCredentials.length === 0) {

        credentialList.innerHTML =
            "<p>No credentials found in this category.</p>";

        return;
    }

    filteredCredentials.forEach(credential => {

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


        // SHOW / HIDE PASSWORD

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


        // EDIT BUTTON

        const editButton = document.createElement("button");
        editButton.textContent = "Edit";

        editButton.addEventListener("click", () => {
            editCredential(credential);
        });


        // DELETE BUTTON

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";

        deleteButton.addEventListener("click", () => {
            deleteCredential(credential.id);
        });


        // SHARE BUTTON

        const shareButton = document.createElement("button");
        shareButton.textContent = "Share";

        shareButton.addEventListener("click", () => {
            shareCredential(credential.id);
        });


        card.append(
            title,
            website,
            username,
            password,
            showButton,
            editButton,
            deleteButton,
            shareButton
        );

        credentialList.appendChild(card);

    });
}


// ========================================
// ADD CREDENTIAL BUTTON
// ========================================

if (addCredentialBtn) {

    addCredentialBtn.addEventListener("click", () => {

        resetCredentialForm();

        openCredentialForm();

    });

}


// ========================================
// CANCEL BUTTON
// ========================================

if (cancelCredentialBtn) {

    cancelCredentialBtn.addEventListener("click", () => {

        closeCredentialForm();

    });

}


// ========================================
// ADD / UPDATE CREDENTIAL
// ========================================

if (credentialForm) {

    credentialForm.addEventListener("submit", async event => {

        event.preventDefault();

        const id =
            document.getElementById("credentialId").value;

        const credential = {

            title: document.getElementById("credentialTitle").value,

            website: document.getElementById("credentialWebsite").value,

            category: document.getElementById("credentialCategory").value,

            username: document.getElementById("credentialUsername").value,

            password: document.getElementById("credentialPassword").value,

            notes: document.getElementById("credentialNotes").value

        };

        try {

            if (id) {

                // UPDATE EXISTING CREDENTIAL

                await credentialApiRequest(
                    `/api/user/credentials/${id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(credential)
                    }
                );

                showVaultMessage(
                    "Credential updated successfully!"
                );

            } else {

                // CREATE NEW CREDENTIAL

                await credentialApiRequest(
                    "/api/user/credentials",
                    {
                        method: "POST",
                        body: JSON.stringify(credential)
                    }
                );

                showVaultMessage(
                    "Credential saved successfully!"
                );

            }

            closeCredentialForm();

            await loadCredentials();

        } catch (error) {

            console.error("Save credential error:", error);

            showVaultMessage(error.message, "error");

        }

    });

}


// ========================================
// EDIT CREDENTIAL
// ========================================

function editCredential(credential) {

    // IMPORTANT: Make hidden form visible
    openCredentialForm();

    // Store credential ID
    document.getElementById("credentialId").value =
        credential.id;

    // Populate existing values
    document.getElementById("credentialTitle").value =
        credential.title || "";

    document.getElementById("credentialWebsite").value =
        credential.website || "";

    document.getElementById("credentialCategory").value =
        credential.category || "Other";

    document.getElementById("credentialUsername").value =
        credential.username || "";

    document.getElementById("credentialPassword").value =
        credential.password || "";

    document.getElementById("credentialNotes").value =
        credential.notes || "";

    // Change form heading
    document.getElementById("formTitle").textContent =
        "Edit Credential";

    // Change submit button
    document.getElementById("saveCredentialBtn").textContent =
        "Update Credential";

}


// ========================================
// DELETE CREDENTIAL
// ========================================

async function deleteCredential(id) {

    if (!confirm("Are you sure you want to delete this credential?")) {
        return;
    }

    try {

        await credentialApiRequest(
            `/api/user/credentials/${id}`,
            {
                method: "DELETE"
            }
        );

        showVaultMessage("Credential deleted successfully!");

        await loadCredentials();

    } catch (error) {

        console.error("Delete error:", error);

        showVaultMessage(error.message, "error");

    }
}


// ========================================
// SHARE CREDENTIAL
// ========================================

async function shareCredential(id) {

    const email = prompt("Enter recipient email:");

    if (!email || !email.trim()) return;

    const permission = prompt("Enter permission: VIEW or EDIT");

    if (!permission) return;

    const normalizedPermission =
        permission.trim().toUpperCase();

    if (!["VIEW", "EDIT"].includes(normalizedPermission)) {

        alert("Please enter VIEW or EDIT.");

        return;
    }

    try {

        await credentialApiRequest(
            `/api/shares/${id}`,
            {
                method: "POST",
                body: JSON.stringify({
                    recipientEmail: email.trim(),
                    permission: normalizedPermission
                })
            }
        );

        showVaultMessage("Credential shared successfully!");

    } catch (error) {

        console.error("Share error:", error);

        showVaultMessage(error.message, "error");

    }
}


// ========================================
// INITIALIZE
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    if (!checkAuthentication()) return;

    setupCategoryFilters();

    loadCredentials();

});

console.log("SecureVault credentials page initialized.");
