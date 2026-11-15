
const API_BASE_URL = "http://localhost:8080";

// ============================================
// DISPLAY API MESSAGES SAFELY
// ============================================

function showMessage(element, message, type) {
    if (!element) return;

    element.textContent = message;
    element.className = `message ${type}`;
}


// ============================================
// COMMON LOGIN SUCCESS HANDLER
// ============================================

function handleLoginSuccess(result, message) {

    const token = result.token || result.accessToken;

    if (!token) {
        throw new Error("Authentication response did not contain a JWT token.");
    }

    const role = String(result.role || "")
        .replace(/^ROLE_/, "")
        .toUpperCase();

    if (!["ADMIN", "MANAGER", "USER"].includes(role)) {
        throw new Error("Account role is missing or invalid.");
    }

    // Save authentication details only after successful verification
    localStorage.setItem("vaultToken", token);
    localStorage.setItem("vaultRole", role);
    localStorage.setItem("vaultName", result.name || "");
    localStorage.setItem("vaultEmail", result.email || "");

    showMessage(message, "Login successful! Redirecting...", "success");

    if (role === "ADMIN") {
        window.location.href = "admin-dashboard.html";
    } else if (role === "MANAGER") {
        window.location.href = "manager-dashboard.html";
    } else {
        window.location.href = "user-dashboard.html";
    }
}


// ============================================
// 1. LOGIN API + TWO-FACTOR VERIFICATION
// ============================================

const loginForm = document.getElementById("loginForm");

if (loginForm) {

    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("togglePassword");

    let pendingEmail = "";

    // Show / Hide Password
    if (togglePassword && passwordInput) {

        togglePassword.addEventListener("click", () => {

            const isPassword = passwordInput.type === "password";

            passwordInput.type = isPassword ? "text" : "password";

            togglePassword.setAttribute(
                "aria-label",
                isPassword ? "Hide password" : "Show password"
            );

            togglePassword.textContent = isPassword ? "◉" : "◎";
        });
    }

    // Create OTP verification form dynamically
    function showTwoFactorForm() {

        let otpContainer = document.getElementById("twoFactorLoginContainer");

        if (!otpContainer) {

            otpContainer = document.createElement("div");

            otpContainer.id = "twoFactorLoginContainer";

            otpContainer.innerHTML = `
                <div class="form-group">
                    <h3>Email Verification</h3>
                    <p>
                        A six-digit verification code has been sent
                        to your registered email address.
                    </p>

                    <form id="twoFactorLoginForm">

                        <label for="loginOtp">
                            Enter Verification Code
                        </label>

                        <input
                            type="text"
                            id="loginOtp"
                            placeholder="Enter 6-digit OTP"
                            maxlength="6"
                            pattern="[0-9]{6}"
                            inputmode="numeric"
                            autocomplete="one-time-code"
                            required
                        >

                        <button type="submit" id="verifyOtpButton">
                            Verify OTP
                        </button>

                    </form>
                </div>
            `;

            loginForm.insertAdjacentElement("afterend", otpContainer);

            document.getElementById("twoFactorLoginForm")
                .addEventListener("submit", verifyLoginOtp);
        }

        loginForm.style.display = "none";
        otpContainer.style.display = "block";

        showMessage(
            document.getElementById("message"),
            "Verification code sent to your registered email.",
            "success"
        );
    }


    // Verify login OTP
    async function verifyLoginOtp(event) {

        event.preventDefault();

        const otpInput = document.getElementById("loginOtp");
        const verifyButton = document.getElementById("verifyOtpButton");
        const message = document.getElementById("message");

        const otp = otpInput.value.trim();

        if (!/^[0-9]{6}$/.test(otp)) {

            showMessage(
                message,
                "Enter a valid 6-digit verification code.",
                "error"
            );

            return;
        }

        verifyButton.disabled = true;
        verifyButton.textContent = "Verifying...";

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/auth/verify-2fa`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: pendingEmail,
                        otp: otp
                    })
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "OTP verification failed."
                );
            }

            // Save JWT and redirect only after OTP verification
            handleLoginSuccess(result, message);

        } catch (error) {

            showMessage(
                message,
                error instanceof TypeError
                    ? "Cannot connect to the server. Check Spring Boot and CORS."
                    : error.message,
                "error"
            );

        } finally {

            verifyButton.disabled = false;
            verifyButton.textContent = "Verify OTP";
        }
    }


    // Login Form Submission
    loginForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const message = document.getElementById("message");
        const button = document.getElementById("loginButton");

        button.disabled = true;

        const buttonText = button.querySelector("span");

        if (buttonText) {
            buttonText.textContent = "Signing in...";
        }

        showMessage(message, "", "");

        try {

            const email = document.getElementById("email").value.trim();

            const response = await fetch(
                `${API_BASE_URL}/api/auth/login`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        email: email,
                        password: passwordInput.value
                    })
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Login failed. Check your email and password."
                );
            }

            // Check whether 2FA is required
            if (result.twoFactorRequired === true) {

                pendingEmail = email;

                showTwoFactorForm();

                return;
            }

            // Normal login without 2FA
            handleLoginSuccess(result, message);

        } catch (error) {

            showMessage(
                message,
                error instanceof TypeError
                    ? "Cannot connect to the server. Check Spring Boot and CORS."
                    : error.message,
                "error"
            );

        } finally {

            button.disabled = false;

            if (buttonText) {
                buttonText.textContent = "Sign in";
            }
        }
    });
}


// ============================================
// 2. REGISTRATION API
// ============================================

const registerForm = document.getElementById("registerForm");

if (registerForm) {

    registerForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const message = document.getElementById("message");
        const button = document.getElementById("registerButton");

        button.disabled = true;

        showMessage(message, "", "");

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/auth/register`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        name: document.getElementById("name").value.trim(),

                        email: document.getElementById("email").value.trim(),

                        password: document.getElementById("password").value

                    })
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Registration failed. Please check your details."
                );
            }

            showMessage(
                message,
                result.message ||
                "Account created successfully! You can sign in now.",
                "success"
            );

            registerForm.reset();

        } catch (error) {

            showMessage(
                message,
                error instanceof TypeError
                    ? "Cannot connect to the server. Check Spring Boot and CORS."
                    : error.message,
                "error"
            );

        } finally {

            button.disabled = false;
        }
    });
}


// ============================================
// 3. REGISTRATION PASSWORD TOGGLE
// ============================================

const registerPassword = document.querySelector(
    "#registerForm #password"
);

const registerToggle = document.querySelector(
    "#registerForm #togglePassword"
);

if (registerPassword && registerToggle) {

    registerToggle.addEventListener("click", () => {

        const show = registerPassword.type === "password";

        registerPassword.type = show ? "text" : "password";

        registerToggle.textContent = show ? "◉" : "◎";

        registerToggle.setAttribute(
            "aria-label",
            show ? "Hide password" : "Show password"
        );
    });
}


// ============================================
// 4. FORGOT PASSWORD - REQUEST OTP
// ============================================

const forgotPasswordForm = document.getElementById(
    "forgotPasswordForm"
);

if (forgotPasswordForm) {

    forgotPasswordForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        const message = document.getElementById("message");

        const button = document.getElementById("submitBtn");

        button.disabled = true;
        button.textContent = "Sending...";

        showMessage(message, "", "");

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/auth/forgot-password`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({ email: email })
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Unable to process your request."
                );
            }

            showMessage(
                message,
                result.message ||
                "If the email is registered, a verification code has been sent.",
                "success"
            );

        } catch (error) {

            showMessage(
                message,
                error instanceof TypeError
                    ? "Cannot connect to the server. Check Spring Boot and CORS."
                    : error.message,
                "error"
            );

        } finally {

            button.disabled = false;
            button.textContent = "Send Verification Code";
        }
    });
}


// ============================================
// 5. RESET PASSWORD - VERIFY OTP
// ============================================

const resetPasswordForm = document.getElementById(
    "resetPasswordForm"
);

if (resetPasswordForm) {

    resetPasswordForm.addEventListener("submit", async (event) => {

        event.preventDefault();

        const email = document.getElementById("email").value.trim();

        const verificationCode = document.getElementById(
            "verificationCode"
        ).value.trim();

        const newPassword = document.getElementById(
            "newPassword"
        ).value;

        const confirmPassword = document.getElementById(
            "confirmPassword"
        ).value;

        const message = document.getElementById("message");

        const button = document.getElementById("submitBtn");

        if (newPassword !== confirmPassword) {

            showMessage(
                message,
                "Passwords do not match.",
                "error"
            );

            return;
        }

        if (!/^\d{6}$/.test(verificationCode)) {

            showMessage(
                message,
                "Enter a valid 6-digit verification code.",
                "error"
            );

            return;
        }

        button.disabled = true;
        button.textContent = "Resetting...";

        showMessage(message, "", "");

        try {

            const response = await fetch(
                `${API_BASE_URL}/api/auth/reset-password`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        email: email,

                        verificationCode: verificationCode,

                        newPassword: newPassword,

                        confirmPassword: confirmPassword

                    })
                }
            );

            const result = await response.json().catch(() => ({}));

            if (!response.ok) {

                throw new Error(
                    result.message ||
                    result.error ||
                    "Password reset failed."
                );
            }

            showMessage(
                message,
                result.message || "Password reset successfully!",
                "success"
            );

            resetPasswordForm.reset();

            setTimeout(() => {

                window.location.href = "login.html";

            }, 2000);

        } catch (error) {

            showMessage(
                message,
                error instanceof TypeError
                    ? "Cannot connect to the server. Check Spring Boot and CORS."
                    : error.message,
                "error"
            );

        } finally {

            button.disabled = false;
            button.textContent = "Reset Password";
        }
    });
}
