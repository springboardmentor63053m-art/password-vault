
// ========================================
// SECURE VAULT - PASSWORD GENERATOR
// ========================================

const passwordLength = document.getElementById("passwordLength");
const uppercase = document.getElementById("uppercase");
const lowercase = document.getElementById("lowercase");
const numbers = document.getElementById("numbers");
const symbols = document.getElementById("symbols");

const generateBtn = document.getElementById("generateBtn");
const generatedPassword = document.getElementById("generatedPassword");
const copyBtn = document.getElementById("copyBtn");

// ========================================
// SECURE RANDOM NUMBER
// ========================================

function secureRandomInt(max) {
    const randomValues = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;

    do {
        crypto.getRandomValues(randomValues);
    } while (randomValues[0] >= limit);

    return randomValues[0] % max;
}

// ========================================
// GENERATE PASSWORD
// ========================================

function generatePassword() {

    const length = Number(passwordLength.value);

    const characterSets = [];

    if (uppercase.checked) {
        characterSets.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    }

    if (lowercase.checked) {
        characterSets.push("abcdefghijklmnopqrstuvwxyz");
    }

    if (numbers.checked) {
        characterSets.push("0123456789");
    }

    if (symbols.checked) {
        characterSets.push("!@#$%^&*()_+-=[]{}|;:,.<>?");
    }

    if (characterSets.length === 0) {
        alert("Please select at least one character type.");
        return;
    }

    if (length < 8 || length > 64) {
        alert("Password length must be between 8 and 64.");
        return;
    }

    let password = "";

    // Include at least one character from each selected set
    characterSets.forEach(set => {
        password += set[secureRandomInt(set.length)];
    });

    const allCharacters = characterSets.join("");

    // Fill remaining positions
    while (password.length < length) {
        password += allCharacters[
            secureRandomInt(allCharacters.length)
        ];
    }

    // Fisher-Yates shuffle
    const passwordArray = password.split("");

    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = secureRandomInt(i + 1);

        [passwordArray[i], passwordArray[j]] =
            [passwordArray[j], passwordArray[i]];
    }

    generatedPassword.value = passwordArray.join("");
}

// ========================================
// GENERATE BUTTON
// ========================================

if (generateBtn) {
    generateBtn.addEventListener("click", generatePassword);
}

// ========================================
// COPY PASSWORD
// ========================================

if (copyBtn) {

    copyBtn.addEventListener("click", async () => {

        const password = generatedPassword.value;

        if (!password) {
            alert("Generate a password first.");
            return;
        }

        try {

            await navigator.clipboard.writeText(password);

            alert("Password copied successfully!");

        } catch (error) {

            alert("Unable to copy password. Please copy it manually.");

        }
    });
}

// ========================================
// INITIALIZE
// ========================================

console.log("SecureVault password generator initialized.");
