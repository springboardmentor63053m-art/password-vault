// ========================================
// SECURE VAULT - CATEGORY FILTERS
// ========================================

const categoryCountElements = {
    "All": "countAll",
    "Social Media": "countSocialMedia",
    "Email": "countEmail",
    "Banking & Finance": "countBankingFinance",
    "Shopping": "countShopping",
    "Entertainment": "countEntertainment",
    "Work & Development": "countWorkDevelopment",
    "Wi-Fi & Networks": "countWifiNetworks",
    "Other": "countOther"
};

let selectedCategory = "All";

// ========================================
// UPDATE CATEGORY COUNTS
// ========================================

function updateCategoryCounts(credentials) {
    const counts = {};

    Object.keys(categoryCountElements).forEach(category => {
        counts[category] = 0;
    });

    credentials.forEach(credential => {
        const category = credential.category || "Other";

        if (counts[category] !== undefined) {
            counts[category]++;
        }
    });

    counts["All"] = credentials.length;

    Object.entries(categoryCountElements).forEach(([category, elementId]) => {
        const element = document.getElementById(elementId);

        if (element) {
            element.textContent = counts[category];
        }
    });
}

// ========================================
// UPDATE SELECTED CATEGORY HEADING
// ========================================

function updateSelectedCategoryHeading(credentials) {
    const title = document.getElementById("selectedCategoryTitle");
    const count = document.getElementById("selectedCategoryCount");

    const filtered = selectedCategory === "All"
        ? credentials
        : credentials.filter(item => item.category === selectedCategory);

    if (title) title.textContent = selectedCategory;
    if (count) count.textContent = filtered.length;
}

// ========================================
// FILTER CREDENTIALS
// ========================================

function setupCategoryFilters() {
    const categoryItems = document.querySelectorAll("[data-category]");

    categoryItems.forEach(item => {
        item.addEventListener("click", () => {
            selectedCategory = item.dataset.category;

            categoryItems.forEach(category => {
                category.classList.remove("active");
            });

            item.classList.add("active");

            const filteredCredentials = selectedCategory === "All"
                ? credentials
                : credentials.filter(
                    credential => credential.category === selectedCategory
                );

            updateSelectedCategoryHeading(credentials);
            displayFilteredCredentials(filteredCredentials);
        });
    });
}

// ========================================
// DISPLAY FILTERED CREDENTIALS
// ========================================

function displayFilteredCredentials(filteredCredentials) {
    if (!credentialList) return;

    credentialList.innerHTML = "";

    if (filteredCredentials.length === 0) {
        credentialList.innerHTML = "<p>No credentials in this category.</p>";
        return;
    }

    const previousCredentials = credentials;

    credentials = filteredCredentials;
    displayCredentials();

    credentials = previousCredentials;
}

console.log("SecureVault categories initialized.");