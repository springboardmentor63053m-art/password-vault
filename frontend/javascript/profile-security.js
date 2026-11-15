
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


function getAuthHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getToken()
    };
}



function loadProfileInformation() {

    const name = document.getElementById("profileName");
    const email = document.getElementById("profileEmail");
    const role = document.getElementById("profileRole");

    if (name) {
        name.textContent = localStorage.getItem("vaultName") || "-";
    }

    if (email) {
        email.textContent = localStorage.getItem("vaultEmail") || "-";
    }

    if (role) {
        role.textContent = localStorage.getItem("vaultRole") || "USER";
    }
}



function setupChangePassword() {

    const form = document.getElementById("changePasswordForm");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const currentPassword =
            document.getElementById("currentPassword").value;

        const newPassword =
            document.getElementById("newPassword").value;

        const confirmPassword =
            document.getElementById("confirmNewPassword").value;

        const message =
            document.getElementById("changePasswordMessage");

        const button =
            document.getElementById("changePasswordBtn");

        if (newPassword.length < 8) {
            message.textContent =
                "New password must contain at least 8 characters.";
            message.className = "error";
            return;
        }

        if (newPassword !== confirmPassword) {
            message.textContent = "New passwords do not match.";
            message.className = "error";
            return;
        }

        if (currentPassword === newPassword) {
            message.textContent =
                "New password must be different from the current password.";
            message.className = "error";
            return;
        }

        try {

            button.disabled = true;
            button.textContent = "Updating...";

            const response = await fetch(
                API_BASE_URL + "/api/auth/change-password",
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        currentPassword: currentPassword,
                        newPassword: newPassword,
                        confirmPassword: confirmPassword
                    })
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message || "Password update failed."
                );
            }

            message.textContent =
                data?.message || "Password changed successfully!";

            message.className = "success";

            form.reset();

        } catch (error) {

            message.textContent = error.message;
            message.className = "error";

        } finally {

            button.disabled = false;
            button.textContent = "Change Password";

        }
    });
}



async function loadTwoFactorStatus() {

    const status = document.getElementById("twoFactorStatus");
    const enableSection =
        document.getElementById("enableTwoFactorSection");
    const verifySection =
        document.getElementById("verifyTwoFactorSection");
    const disableSection =
        document.getElementById("disableTwoFactorSection");

    if (!status) return;

    try {

        const response = await fetch(
            API_BASE_URL + "/api/user/2fa/status",
            {
                method: "GET",
                headers: getAuthHeaders()
            }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
            throw new Error(
                data?.message || "Unable to load 2FA status."
            );
        }

        if (data.twoFactorEnabled === true) {

            status.textContent = "Enabled";
            status.style.color = "green";

            enableSection.style.display = "none";
            verifySection.style.display = "none";
            disableSection.style.display = "block";

        } else {

            status.textContent = "Disabled";
            status.style.color = "red";

            enableSection.style.display = "block";
            verifySection.style.display = "none";
            disableSection.style.display = "none";
        }

    } catch (error) {

        status.textContent = "Unable to load";
        showTwoFactorMessage(error.message, "error");

    }
}


function showTwoFactorMessage(message, type) {

    const messageElement =
        document.getElementById("twoFactorMessage");

    if (!messageElement) return;

    messageElement.textContent = message;
    messageElement.className = type;
}



function setupEnableTwoFactor() {

    const button =
        document.getElementById("enableTwoFactorBtn");

    if (!button) return;

    button.addEventListener("click", async () => {

        try {

            button.disabled = true;
            button.textContent = "Sending OTP...";

            showTwoFactorMessage("", "");

            const response = await fetch(
                API_BASE_URL + "/api/user/2fa/setup",
                {
                    method: "POST",
                    headers: getAuthHeaders()
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message || "Unable to send setup OTP."
                );
            }

            document.getElementById(
                "enableTwoFactorSection"
            ).style.display = "none";

            document.getElementById(
                "verifyTwoFactorSection"
            ).style.display = "block";

            showTwoFactorMessage(
                data.message || "OTP sent to your registered email.",
                "success"
            );

        } catch (error) {

            showTwoFactorMessage(error.message, "error");

        } finally {

            button.disabled = false;
            button.textContent = "Enable Two-Factor Authentication";

        }
    });
}



function setupVerifyTwoFactor() {

    const form =
        document.getElementById("verifyTwoFactorForm");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const otp =
            document.getElementById("twoFactorOtp").value.trim();

        const button =
            document.getElementById("verifyTwoFactorBtn");

        if (!/^[0-9]{6}$/.test(otp)) {

            showTwoFactorMessage(
                "Please enter a valid 6-digit OTP.",
                "error"
            );

            return;
        }

        try {

            button.disabled = true;
            button.textContent = "Verifying...";

            const response = await fetch(
                API_BASE_URL + "/api/user/2fa/verify",
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        otp: otp
                    })
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message || "OTP verification failed."
                );
            }

            form.reset();

            showTwoFactorMessage(
                data.message ||
                "Two-Factor Authentication enabled successfully.",
                "success"
            );

            await loadTwoFactorStatus();

        } catch (error) {

            showTwoFactorMessage(error.message, "error");

        } finally {

            button.disabled = false;
            button.textContent = "Verify & Enable 2FA";

        }
    });
}



function setupDisableTwoFactor() {

    const form =
        document.getElementById("disableTwoFactorForm");

    if (!form) return;

    form.addEventListener("submit", async event => {

        event.preventDefault();

        const currentPassword =
            document.getElementById("disableCurrentPassword").value;

        const button =
            document.getElementById("disableTwoFactorBtn");

        if (!currentPassword.trim()) {

            showTwoFactorMessage(
                "Please enter your current password.",
                "error"
            );

            return;
        }

        try {

            button.disabled = true;
            button.textContent = "Disabling...";

            const response = await fetch(
                API_BASE_URL + "/api/user/2fa/disable",
                {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({
                        currentPassword: currentPassword
                    })
                }
            );

            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.message || "Unable to disable 2FA."
                );
            }

            form.reset();

            showTwoFactorMessage(
                data.message ||
                "Two-Factor Authentication disabled successfully.",
                "success"
            );

            await loadTwoFactorStatus();

        } catch (error) {

            showTwoFactorMessage(error.message, "error");

        } finally {

            button.disabled = false;
            button.textContent = "Disable Two-Factor Authentication";

        }
    });
}



function setupLogout() {

    const logoutBtn = document.getElementById("logoutBtn");

    if (!logoutBtn) return;

    logoutBtn.addEventListener("click", () => {

        const confirmed = confirm(
            "Are you sure you want to logout?"
        );

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

    loadProfileInformation();

    setupChangePassword();

    setupEnableTwoFactor();

    setupVerifyTwoFactor();

    setupDisableTwoFactor();

    setupLogout();

    loadTwoFactorStatus();

});

console.log("SecureVault profile and security initialized.");
