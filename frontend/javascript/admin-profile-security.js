
// ========================================
// SECURE VAULT - ADMIN PROFILE & SECURITY
// ========================================

const API_BASE_URL = "http://localhost:8080";

const token = localStorage.getItem("vaultToken");
const role = localStorage.getItem("vaultRole");

const message = document.getElementById("message");

// 2FA elements
const twoFactorButton = document.getElementById("twoFactorButton");
const twoFactorStatus = document.getElementById("twoFactorStatus");
const twoFactorSetupForm = document.getElementById("twoFactorSetupForm");
const twoFactorOtpForm = document.getElementById("twoFactorOtpForm");

const twoFactorDisableForm =
    document.getElementById("twoFactorDisableForm");

const twoFactorDisableFormElement =
    document.getElementById("twoFactorDisableFormElement");

const cancelDisable2FA =
    document.getElementById("cancelDisable2FA");

// ========================================
// AUTHENTICATION
// ========================================

if (!token || role !== "ADMIN") {
    window.location.href = "login.html";
}

// ========================================
// MESSAGE
// ========================================

function showMessage(text, success = true) {
    message.textContent = text;
    message.style.color = success ? "#16a34a" : "#dc2626";
}

// ========================================
// UPDATE 2FA UI
// ========================================

function updateTwoFactorUI(enabled) {

    twoFactorSetupForm.style.display = "none";
    twoFactorDisableForm.style.display = "none";

    if (enabled) {

        twoFactorStatus.textContent = "Enabled";
        twoFactorButton.textContent = "Disable 2FA";
        twoFactorButton.disabled = false;

    } else {

        twoFactorStatus.textContent = "Disabled";
        twoFactorButton.textContent = "Enable 2FA";
        twoFactorButton.disabled = false;
    }
}

// ========================================
// LOAD ADMIN PROFILE
// ========================================

async function loadAdminProfile() {

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/profile`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Unable to load administrator profile.");
        }

        const admin = await response.json();

        document.getElementById("adminName").value = admin.name;
        document.getElementById("adminEmail").value = admin.email;
        document.getElementById("adminRole").value = admin.role;

        updateTwoFactorUI(admin.twoFactorEnabled === true);

    } catch (error) {
        showMessage(error.message, false);
    }
}

// ========================================
// UPDATE ADMIN PROFILE
// ========================================

document.getElementById("profileForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const name = document.getElementById("adminName").value.trim();

        if (name.length < 2 || name.length > 50) {
            showMessage("Name must contain 2 to 50 characters.", false);
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/admin/profile`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ name })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Profile update failed.");
            }

            showMessage(result.message);
            await loadAdminProfile();

        } catch (error) {
            showMessage(error.message, false);
        }
    });

// ========================================
// CHANGE ADMIN PASSWORD
// ========================================

document.getElementById("changePasswordForm")
    .addEventListener("submit", async function (event) {

        event.preventDefault();

        const currentPassword =
            document.getElementById("currentPassword").value;

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (newPassword !== confirmPassword) {
            showMessage("New password and confirm password do not match.", false);
            return;
        }

        if (newPassword.length < 8) {
            showMessage("Password must contain at least 8 characters.", false);
            return;
        }

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/auth/change-password`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        currentPassword,
                        newPassword,
                        confirmPassword
                    })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "Password change failed.");
            }

            showMessage(result.message);

            document.getElementById("changePasswordForm").reset();

        } catch (error) {
            showMessage(error.message, false);
        }
    });

// ========================================
// 2FA BUTTON
// ========================================

twoFactorButton.addEventListener("click", async function () {

    const isEnabled =
        twoFactorStatus.textContent.trim() === "Enabled";

    // If enabled, display disable form
    if (isEnabled) {

        twoFactorDisableForm.style.display = "block";
        twoFactorSetupForm.style.display = "none";

        return;
    }

    // If disabled, request setup OTP
    try {

        twoFactorButton.disabled = true;

        const response = await fetch(
            `${API_BASE_URL}/api/admin/2fa/setup`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Unable to send setup OTP.");
        }

        twoFactorSetupForm.style.display = "block";
        twoFactorDisableForm.style.display = "none";

        showMessage(result.message);

    } catch (error) {
        showMessage(error.message, false);

    } finally {
        twoFactorButton.disabled = false;
    }
});

// ========================================
// VERIFY SETUP OTP
// ========================================

twoFactorOtpForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const otp = document.getElementById("twoFactorOtp").value.trim();

    if (!/^[0-9]{6}$/.test(otp)) {
        showMessage("Enter a valid 6-digit OTP.", false);
        return;
    }

    const submitButton =
        twoFactorOtpForm.querySelector('button[type="submit"]');

    try {

        submitButton.disabled = true;

        const response = await fetch(
            `${API_BASE_URL}/api/admin/2fa/verify`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ otp })
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "OTP verification failed.");
        }

        showMessage(result.message);

        twoFactorOtpForm.reset();

        await loadAdminProfile();

    } catch (error) {
        showMessage(error.message, false);

    } finally {
        submitButton.disabled = false;
    }
});

// ========================================
// DISABLE 2FA
// ========================================

twoFactorDisableFormElement.addEventListener(
    "submit",
    async function (event) {

        event.preventDefault();

        const currentPassword =
            document.getElementById("twoFactorCurrentPassword").value;

        if (!currentPassword.trim()) {
            showMessage("Enter your current password.", false);
            return;
        }

        const submitButton =
            twoFactorDisableFormElement.querySelector(
                'button[type="submit"]'
            );

        try {

            submitButton.disabled = true;

            const response = await fetch(
                `${API_BASE_URL}/api/admin/2fa/disable`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ currentPassword })
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to disable 2FA."
                );
            }

            twoFactorDisableFormElement.reset();

            showMessage(result.message);

            await loadAdminProfile();

        } catch (error) {
            showMessage(error.message, false);

        } finally {
            submitButton.disabled = false;
        }
    }
);

// ========================================
// CANCEL DISABLE FORM
// ========================================

cancelDisable2FA.addEventListener("click", function () {

    twoFactorDisableForm.style.display = "none";
    twoFactorDisableFormElement.reset();

});

// ========================================
// LOGOUT
// ========================================

const logoutButton = document.getElementById("logoutButton");

if (logoutButton) {

    logoutButton.addEventListener("click", function () {

        localStorage.clear();

        window.location.href = "login.html";
    });
}

// ========================================
// LOAD PROFILE
// ========================================

loadAdminProfile();
