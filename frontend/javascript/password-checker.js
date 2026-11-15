
// ========================================
// SECURE VAULT - PASSWORD STRENGTH CHECKER
// ========================================

const passwordInput = document.getElementById("passwordInput");
const strengthBar = document.getElementById("strengthBar");
const strengthText = document.getElementById("strengthText");
const strengthSuggestions = document.getElementById("strengthSuggestions");

// ========================================
// CHECK PASSWORD STRENGTH
// ========================================

function checkPasswordStrength(password) {

    let score = 0;
    const suggestions = [];

    if (password.length >= 8) {
        score++;
    } else {
        suggestions.push("Use at least 8 characters.");
    }

    if (password.length >= 12) {
        score++;
    } else {
        suggestions.push("Use 12 or more characters for better security.");
    }

    if (/[A-Z]/.test(password)) {
        score++;
    } else {
        suggestions.push("Include uppercase letters.");
    }

    if (/[a-z]/.test(password)) {
        score++;
    } else {
        suggestions.push("Include lowercase letters.");
    }

    if (/[0-9]/.test(password)) {
        score++;
    } else {
        suggestions.push("Include numbers.");
    }

    if (/[^A-Za-z0-9]/.test(password)) {
        score++;
    } else {
        suggestions.push("Include special characters.");
    }

    if (/(.)\1{2,}/.test(password)) {
        score--;
        suggestions.push("Avoid repeating the same character.");
    }

    if (/1234|abcd|qwerty|password/i.test(password)) {
        score--;
        suggestions.push("Avoid common sequences and passwords.");
    }

    score = Math.max(0, Math.min(score, 6));

    let strength;
    let percentage;
    let color;

    if (score <= 2) {
        strength = "Weak";
        percentage = 25;
        color = "#ef4444";
    } else if (score <= 4) {
        strength = "Medium";
        percentage = 60;
        color = "#f59e0b";
    } else {
        strength = "Strong";
        percentage = 100;
        color = "#22c55e";
    }

    return {
        strength,
        percentage,
        color,
        suggestions
    };
}

// ========================================
// UPDATE STRENGTH DISPLAY
// ========================================

function updatePasswordStrength() {

    const password = passwordInput.value;

    if (!password) {

        strengthBar.style.width = "0%";
        strengthText.textContent = "Enter a password to check strength.";

        strengthSuggestions.innerHTML = "";

        return;
    }

    const result = checkPasswordStrength(password);

    strengthBar.style.width = result.percentage + "%";
    strengthBar.style.backgroundColor = result.color;

    strengthText.textContent =
        "Password Strength: " + result.strength;

    strengthText.style.color = result.color;

    strengthSuggestions.innerHTML = "";

    if (result.suggestions.length === 0) {

        const item = document.createElement("li");
        item.textContent = "Your password meets all these checks!";
        strengthSuggestions.appendChild(item);

    } else {

        result.suggestions.forEach(suggestion => {

            const item = document.createElement("li");
            item.textContent = suggestion;

            strengthSuggestions.appendChild(item);

        });
    }
}

// ========================================
// INPUT LISTENER
// ========================================

if (passwordInput) {
    passwordInput.addEventListener(
        "input",
        updatePasswordStrength
    );
}

console.log("SecureVault password checker initialized.");
