

const API_BASE_URL = "http://localhost:8080";

const scanBtn = document.getElementById("scanBreachesBtn");
const scanStatus = document.getElementById("scanStatus");

const passwordsChecked = document.getElementById("passwordsChecked");
const compromisedPasswords = document.getElementById("compromisedPasswords");
const safePasswords = document.getElementById("safePasswords");

const resultCount = document.getElementById("resultCount");
const breachResultsBody = document.getElementById("breachResultsBody");

const breachWarning = document.getElementById("breachWarning");
const breachWarningMessage = document.getElementById("breachWarningMessage");



scanBtn.addEventListener("click", async () => {

    const token = localStorage.getItem("vaultToken");

    if (!token) {
        updateStatus("Please login again.", "#dc2626");
        return;
    }

    scanBtn.disabled = true;
    scanBtn.textContent = "Scanning All Users...";

    breachWarning.hidden = true;
    breachResultsBody.innerHTML = "";

    updateStatus("Scanning credentials of all regular users...", "#3730a3");

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/breach/scan`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        if (response.status === 401 || response.status === 403) {
            throw new Error("Access denied. Please login as Admin.");
        }

        if (!response.ok) {
            throw new Error("Unable to scan credentials. Please try again.");
        }

        const results = await response.json();

        displayResults(results);

    } catch (error) {

        updateStatus(error.message, "#dc2626");
        breachWarning.hidden = true;

    } finally {

        scanBtn.disabled = false;
        scanBtn.textContent = "🔍 Scan All Users' Passwords";

    }

});



function displayResults(results) {

    const total = results.length;

    const compromised = results.filter(
        result => result.breached
    );

    const safe = total - compromised.length;

    passwordsChecked.textContent = total;
    compromisedPasswords.textContent = compromised.length;
    safePasswords.textContent = safe;

    resultCount.textContent =
        `${compromised.length} compromised credentials found`;

    breachResultsBody.innerHTML = "";


    if (compromised.length === 0) {

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.textContent =
            total === 0
                ? "No credentials available to scan."
                : "No compromised passwords found.";

        cell.style.textAlign = "center";

        row.appendChild(cell);
        breachResultsBody.appendChild(row);

        breachWarning.hidden = true;

        updateStatus(
            total === 0
                ? "No user credentials were available to scan."
                : "Scan completed. No compromised passwords were found.",
            "#166534"
        );

        return;
    }

    compromised.forEach(result => {

        const row = document.createElement("tr");


        const nameCell = document.createElement("td");
        nameCell.textContent = result.userName || "Unknown";


        const emailCell = document.createElement("td");
        emailCell.textContent = result.userEmail || "Unknown";


        const credentialCell = document.createElement("td");
        credentialCell.textContent =
            result.website || result.title || "Unknown";


        const statusCell = document.createElement("td");

        const badge = document.createElement("span");
        badge.className = "breach-danger";
        badge.textContent = "Compromised";

        statusCell.appendChild(badge);


        const occurrencesCell = document.createElement("td");
        occurrencesCell.textContent =
            Number(result.occurrences).toLocaleString();


        const actionCell = document.createElement("td");

        const notifyButton = document.createElement("button");

        notifyButton.textContent = "Notify User";
        notifyButton.className = "notify-user-btn";

        notifyButton.addEventListener("click", () => {
            notifyUser(result, notifyButton);
        });

        actionCell.appendChild(notifyButton);

        row.appendChild(nameCell);
        row.appendChild(emailCell);
        row.appendChild(credentialCell);
        row.appendChild(statusCell);
        row.appendChild(occurrencesCell);
        row.appendChild(actionCell);

        breachResultsBody.appendChild(row);

    });


    breachWarning.hidden = false;

    breachWarningMessage.textContent =
        `${compromised.length} credentials belonging to your users ` +
        `have appeared in known data breaches. Notify the affected users ` +
        `so they can change their passwords immediately.`;

    updateStatus(
        "Scan completed. Compromised credentials were detected.",
        "#dc2626"
    );
}


// ========================================
// SEND IN-APP NOTIFICATION TO USER
// ========================================

async function notifyUser(result, button) {

    const token = localStorage.getItem("vaultToken");

    if (!token) {
        updateStatus("Please login again.", "#dc2626");
        return;
    }

    button.disabled = true;
    button.textContent = "Sending...";

    try {

        const response = await fetch(
            `${API_BASE_URL}/api/admin/notifications/breach`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    userId: result.userId,
                    credentialId: result.credentialId,
                    scanId: result.scanId
                })
            }
        );

        if (response.status === 401 || response.status === 403) {
            throw new Error("Admin access denied. Please login again.");
        }

        if (!response.ok) {

            const errorText = await response.text();

            throw new Error(
                errorText || "Unable to send notification."
            );
        }

        button.textContent = "✓ Notification Sent";
        button.classList.add("notification-sent");

        updateStatus(
            `Security notification sent to ${result.userEmail}.`,
            "#166534"
        );

    } catch (error) {

        button.disabled = false;
        button.textContent = "Notify User";

        updateStatus(error.message, "#dc2626");

    }

}




function updateStatus(message, color) {

    scanStatus.textContent = message;
    scanStatus.style.color = color;

}
