
document.addEventListener("DOMContentLoaded", () => {

    const logoutBtn = document.getElementById("logoutBtn");

    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {

            const confirmLogout = confirm("Are you sure you want to logout?");

            if (!confirmLogout) return;

            // Clear login session
            localStorage.removeItem("vaultToken");
            localStorage.removeItem("vaultRole");
            localStorage.removeItem("vaultName");
            localStorage.removeItem("vaultEmail");

            // Redirect to login page
            window.location.href = "login.html";
        });
    }

});
