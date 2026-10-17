import React, { useState } from "react";
import "./App.css";

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const navigation = [
    { name: "Dashboard", icon: "fa-solid fa-house" },
    { name: "User Management", icon: "fa-solid fa-users" },
    { name: "Password Vault", icon: "fa-solid fa-vault" },
    { name: "Security Analytics", icon: "fa-solid fa-shield-halved" },
    { name: "Activity Logs", icon: "fa-solid fa-clock-rotate-left" },
    { name: "Settings", icon: "fa-solid fa-gear" },
  ];

  const stats = [
    {
      title: "Total Users",
      value: "2,845",
      change: "+12.8%",
      description: "Compared to last month",
      icon: "fa-solid fa-users",
      color: "blue",
    },
    {
      title: "Stored Credentials",
      value: "12,490",
      change: "+8.4%",
      description: "Compared to last month",
      icon: "fa-solid fa-key",
      color: "purple",
    },
    {
      title: "Active Sessions",
      value: "184",
      change: "+5.2%",
      description: "Compared to last month",
      icon: "fa-solid fa-desktop",
      color: "green",
    },
    {
      title: "Security Alerts",
      value: "07",
      change: "Needs review",
      description: "Review security events",
      icon: "fa-solid fa-shield-halved",
      color: "orange",
    },
  ];

  const activities = [
    {
      name: "Ananya Sharma",
      email: "ananya@example.com",
      action: "Logged in",
      device: "Windows · Chrome",
      time: "2 minutes ago",
      status: "Success",
      initials: "AS",
    },
    {
      name: "Rahul Verma",
      email: "rahul@example.com",
      action: "Password updated",
      device: "Android · Chrome",
      time: "15 minutes ago",
      status: "Success",
      initials: "RV",
    },
    {
      name: "Priya Reddy",
      email: "priya@example.com",
      action: "New account created",
      device: "Windows · Edge",
      time: "32 minutes ago",
      status: "Success",
      initials: "PR",
    },
    {
      name: "Arjun Kumar",
      email: "arjun@example.com",
      action: "Login attempt",
      device: "Unknown device",
      time: "48 minutes ago",
      status: "Review",
      initials: "AK",
    },
    {
      name: "Sneha Patel",
      email: "sneha@example.com",
      action: "Vault accessed",
      device: "iPhone · Safari",
      time: "1 hour ago",
      status: "Success",
      initials: "SP",
    },
  ];

  const filteredActivities = activities.filter((activity) =>
    `${activity.name} ${activity.email} ${activity.action} ${activity.status}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const handleNavigation = (page) => {
    setActivePage(page);
    setSearchTerm("");
  };

  const renderPageContent = () => {
    if (activePage === "Dashboard") {
      return (
        <>
          {/* STATISTICS */}

          <section className="stats-grid">
            {stats.map((stat) => (
              <article className="stat-card" key={stat.title}>
                <div className="stat-card-top">
                  <div className={`stat-icon ${stat.color}`}>
                    <i className={stat.icon}></i>
                  </div>

                  {stat.title !== "Security Alerts" && (
                    <span className="stat-change">
                      <i className="fa-solid fa-arrow-trend-up"></i>
                      {stat.change}
                    </span>
                  )}
                </div>

                <p className="stat-title">{stat.title}</p>

                <h2 className="stat-value">{stat.value}</h2>

                <p className="stat-description">{stat.description}</p>
              </article>
            ))}
          </section>

          {/* MAIN DASHBOARD GRID */}

          <section className="dashboard-grid">
            {/* SECURITY OVERVIEW */}

            <article className="dashboard-card security-card">
              <div className="card-heading">
                <div>
                  <h2>Security Overview</h2>
                  <p>Your vault protection status</p>
                </div>

                <span className="live-badge">
                  <span className="live-dot"></span>
                  Live
                </span>
              </div>

              <div className="security-content">
                <div className="fingerprint-display">
                  <div className="fingerprint-circle">
                    <i className="fa-solid fa-fingerprint"></i>
                  </div>

                  <span className="security-check">
                    <i className="fa-solid fa-check"></i>
                  </span>
                </div>

                <div className="security-score">
                  <h3>Excellent</h3>
                  <p>Your vault is protected</p>

                  <div className="progress-track">
                    <div className="progress-fill"></div>
                  </div>

                  <span>92% security score</span>
                </div>
              </div>

              <div className="security-footer">
                <div>
                  <i className="fa-solid fa-lock"></i>
                  <span>Encryption enabled</span>
                </div>

                <div>
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Security monitoring</span>
                </div>
              </div>
            </article>

            {/* QUICK ACTIONS */}

            <article className="dashboard-card quick-actions-card">
              <div className="card-heading">
                <div>
                  <h2>Quick Actions</h2>
                  <p>Manage your application</p>
                </div>
              </div>

              <button
                className="quick-action"
                onClick={() => handleNavigation("User Management")}
              >
                <span className="action-icon blue">
                  <i className="fa-solid fa-user-plus"></i>
                </span>

                <span className="action-text">
                  <strong>Manage Users</strong>
                  <small>View and manage accounts</small>
                </span>

                <i className="fa-solid fa-chevron-right action-arrow"></i>
              </button>

              <button
                className="quick-action"
                onClick={() => handleNavigation("Password Vault")}
              >
                <span className="action-icon purple">
                  <i className="fa-solid fa-key"></i>
                </span>

                <span className="action-text">
                  <strong>View Password Vault</strong>
                  <small>Review vault overview</small>
                </span>

                <i className="fa-solid fa-chevron-right action-arrow"></i>
              </button>

              <button
                className="quick-action"
                onClick={() => handleNavigation("Security Analytics")}
              >
                <span className="action-icon green">
                  <i className="fa-solid fa-chart-line"></i>
                </span>

                <span className="action-text">
                  <strong>Security Analytics</strong>
                  <small>Review security insights</small>
                </span>

                <i className="fa-solid fa-chevron-right action-arrow"></i>
              </button>
            </article>
          </section>

          {/* ACTIVITY TABLE */}

          <section className="dashboard-card activity-card">
            <div className="card-heading activity-heading">
              <div>
                <h2>Recent Activities</h2>
                <p>Monitor the latest account activities</p>
              </div>

              <button
                className="view-all-button"
                onClick={() => handleNavigation("Activity Logs")}
              >
                View all
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            </div>

            <div className="table-wrapper">
              <table className="activity-table">
                <thead>
                  <tr>
                    <th>USER</th>
                    <th>ACTIVITY</th>
                    <th>DEVICE</th>
                    <th>TIME</th>
                    <th>STATUS</th>
                  </tr>
                </thead>

                <tbody>
                  {activities.slice(0, 4).map((activity, index) => (
                    <tr key={index}>
                      <td>
                        <div className="user-cell">
                          <div className={`user-avatar avatar-${index + 1}`}>
                            {activity.initials}
                          </div>

                          <div>
                            <strong>{activity.name}</strong>
                            <span>{activity.email}</span>
                          </div>
                        </div>
                      </td>

                      <td>{activity.action}</td>

                      <td>{activity.device}</td>

                      <td>{activity.time}</td>

                      <td>
                        <span
                          className={`status-badge ${
                            activity.status === "Success" ? "success" : "review"
                          }`}
                        >
                          <span className="status-dot"></span>
                          {activity.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* BOTTOM INFORMATION */}

          <section className="bottom-grid">
            <article className="dashboard-card bottom-info-card">
              <div className="bottom-icon green">
                <i className="fa-solid fa-shield-halved"></i>
              </div>

              <div>
                <h3>System Protection</h3>
                <p>Security monitoring is enabled.</p>
                <span className="info-status">
                  <i className="fa-solid fa-circle-check"></i>
                  Protection active
                </span>
              </div>
            </article>

            <article className="dashboard-card bottom-info-card">
              <div className="bottom-icon purple">
                <i className="fa-solid fa-fingerprint"></i>
              </div>

              <div>
                <h3>Vault Authentication</h3>
                <p>Multi-factor authentication overview.</p>
                <span className="info-status purple-text">
                  Authentication settings
                </span>
              </div>
            </article>
          </section>
        </>
      );
    }

    if (activePage === "User Management") {
      return (
        <section className="dashboard-card page-placeholder">
          <div className="placeholder-icon blue">
            <i className="fa-solid fa-users"></i>
          </div>

          <h2>User Management</h2>

          <p>
            Manage registered users, review account details, and monitor user
            access.
          </p>

          <div className="placeholder-stats">
            <div>
              <span>Total Users</span>
              <strong>2,845</strong>
            </div>

            <div>
              <span>Active Users</span>
              <strong>2,610</strong>
            </div>

            <div>
              <span>Pending Reviews</span>
              <strong>07</strong>
            </div>
          </div>
        </section>
      );
    }

    if (activePage === "Password Vault") {
      return (
        <section className="dashboard-card page-placeholder">
          <div className="placeholder-icon purple">
            <i className="fa-solid fa-fingerprint"></i>
          </div>

          <h2>Password Vault Overview</h2>

          <p>
            Monitor stored credentials and review vault security information.
          </p>

          <div className="placeholder-stats">
            <div>
              <span>Stored Credentials</span>
              <strong>12,490</strong>
            </div>

            <div>
              <span>Protected Vaults</span>
              <strong>2,610</strong>
            </div>

            <div>
              <span>Security Status</span>
              <strong className="green-text">Protected</strong>
            </div>
          </div>

          <p className="demo-notice">
            This is a dashboard preview. Live vault data will be connected
            through the backend.
          </p>
        </section>
      );
    }

    if (activePage === "Security Analytics") {
      return (
        <section className="dashboard-card page-placeholder">
          <div className="placeholder-icon green">
            <i className="fa-solid fa-chart-line"></i>
          </div>

          <h2>Security Analytics</h2>

          <p>Review security indicators and monitor application protection.</p>

          <div className="analytics-bars">
            {[65, 85, 55, 95, 72, 88, 60].map((height, index) => (
              <div className="bar-column" key={index}>
                <div className="bar" style={{ height: `${height}%` }}></div>

                <span>
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index]}
                </span>
              </div>
            ))}
          </div>

          <p className="demo-notice">
            Sample visualization only. Connect real analytics data for
            production use.
          </p>
        </section>
      );
    }

    if (activePage === "Activity Logs") {
      return (
        <section className="dashboard-card activity-card">
          <div className="card-heading activity-heading">
            <div>
              <h2>Activity Logs</h2>
              <p>Search and review recent account activities</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="activity-table">
              <thead>
                <tr>
                  <th>USER</th>
                  <th>ACTIVITY</th>
                  <th>DEVICE</th>
                  <th>TIME</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {filteredActivities.map((activity, index) => (
                  <tr key={index}>
                    <td>
                      <div className="user-cell">
                        <div
                          className={`user-avatar avatar-${(index % 5) + 1}`}
                        >
                          {activity.initials}
                        </div>

                        <div>
                          <strong>{activity.name}</strong>
                          <span>{activity.email}</span>
                        </div>
                      </div>
                    </td>

                    <td>{activity.action}</td>
                    <td>{activity.device}</td>
                    <td>{activity.time}</td>

                    <td>
                      <span
                        className={`status-badge ${
                          activity.status === "Success" ? "success" : "review"
                        }`}
                      >
                        <span className="status-dot"></span>
                        {activity.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {filteredActivities.length === 0 && (
                  <tr>
                    <td colSpan="5" className="empty-results">
                      No matching activities found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      );
    }

    if (activePage === "Settings") {
      return (
        <section className="dashboard-card page-placeholder">
          <div className="placeholder-icon blue">
            <i className="fa-solid fa-gear"></i>
          </div>

          <h2>Dashboard Settings</h2>

          <p>Manage administrator preferences and review security settings.</p>

          <div className="settings-row">
            <div>
              <strong>Security Monitoring</strong>
              <span>Display security monitoring status</span>
            </div>

            <span className="settings-enabled">Enabled</span>
          </div>

          <div className="settings-row">
            <div>
              <strong>Activity Monitoring</strong>
              <span>Review account activity records</span>
            </div>

            <span className="settings-enabled">Enabled</span>
          </div>

          <p className="demo-notice">
            Settings shown here are a frontend preview. Save settings through
            the backend when it is integrated.
          </p>
        </section>
      );
    }

    return null;
  };

  return (
    <div className="admin-layout">
      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <i className="fa-solid fa-user-lock"></i>
          </div>

          <div className="brand-text">
            <h2>SecureVault</h2>
            <span>ADMIN CONSOLE</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>

        <nav className="sidebar-navigation">
          {navigation.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${activePage === item.name ? "active" : ""}`}
              onClick={() => handleNavigation(item.name)}
            >
              <i className={item.icon}></i>
              <span>{item.name}</span>

              {item.name === "Security Analytics" && (
                <span className="nav-new">NEW</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-security">
            <div className="sidebar-security-icon">
              <i className="fa-solid fa-fingerprint"></i>
            </div>

            <h3>Your Vault, Protected</h3>

            <p>Security monitoring keeps your vault activity visible.</p>

            <div className="sidebar-security-status">
              <span></span>
              Security overview
            </div>
          </div>

          <button
            className="sidebar-admin"
            onClick={() => setShowProfile(!showProfile)}
          >
            <div className="admin-avatar">
              <i className="fa-solid fa-user-shield"></i>
            </div>

            <div className="admin-details">
              <strong>Administrator</strong>
              <span>System Admin</span>
            </div>

            <i className="fa-solid fa-ellipsis"></i>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="main-content">
        {/* TOPBAR */}

        <header className="topbar">
          <div className="topbar-left">
            <div className="breadcrumb">
              <span>SecureVault</span>
              <i className="fa-solid fa-chevron-right"></i>
              <strong>{activePage}</strong>
            </div>

            <p>Manage your vault with confidence.</p>
          </div>

          <div className="topbar-right">
            <label className="search-box">
              <i className="fa-solid fa-magnifying-glass"></i>

              <input
                type="search"
                placeholder="Search activities..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);

                  if (activePage !== "Activity Logs") {
                    setActivePage("Activity Logs");
                  }
                }}
              />

              <kbd>⌘ K</kbd>
            </label>

            <div className="topbar-action-wrapper">
              <button
                className={`icon-button ${showNotifications ? "selected" : ""}`}
                aria-label="Notifications"
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  setShowProfile(false);
                }}
              >
                <i className="fa-regular fa-bell"></i>
                <span className="notification-dot"></span>
              </button>

              {showNotifications && (
                <div className="floating-menu notification-menu">
                  <h3>Notifications</h3>

                  <div className="notification-item">
                    <span className="notification-icon orange">
                      <i className="fa-solid fa-shield-halved"></i>
                    </span>

                    <div>
                      <strong>Security review</strong>
                      <p>One login attempt needs review.</p>
                    </div>
                  </div>

                  <div className="notification-item">
                    <span className="notification-icon blue">
                      <i className="fa-solid fa-users"></i>
                    </span>

                    <div>
                      <strong>User activity</strong>
                      <p>Review recent account activity.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="topbar-action-wrapper">
              <button
                className="profile-button"
                onClick={() => {
                  setShowProfile(!showProfile);
                  setShowNotifications(false);
                }}
              >
                <span className="profile-avatar">
                  <i className="fa-solid fa-user-shield"></i>
                </span>

                <span className="profile-name">
                  <strong>Admin</strong>
                  <small>Administrator</small>
                </span>

                <i className="fa-solid fa-chevron-down profile-chevron"></i>
              </button>

              {showProfile && (
                <div className="floating-menu profile-menu">
                  <div className="profile-menu-heading">
                    <strong>Administrator</strong>
                    <span>Admin account</span>
                  </div>

                  <button
                    onClick={() => {
                      handleNavigation("Settings");
                      setShowProfile(false);
                    }}
                  >
                    <i className="fa-solid fa-gear"></i>
                    Dashboard Settings
                  </button>

                  <button
                    onClick={() => {
                      setShowProfile(false);
                      window.alert(
                        "Connect the backend logout endpoint to enable logout.",
                      );
                    }}
                  >
                    <i className="fa-solid fa-right-from-bracket"></i>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* PAGE HEADING */}

        <section className="page-heading">
          <div>
            <div className="heading-eyebrow">
              <span></span>
              SECUREVAULT ADMINISTRATION
            </div>

            <h1>
              {activePage === "Dashboard" ? "Dashboard Overview" : activePage}
            </h1>

            <p>
              {activePage === "Dashboard"
                ? "Welcome back! Here's what's happening with your vault today."
                : `Review and manage your ${activePage.toLowerCase()} information.`}
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={() => {
              setSearchTerm("");
              setShowNotifications(false);
              setShowProfile(false);
            }}
          >
            <i className="fa-solid fa-rotate-right"></i>
            Refresh View
          </button>
        </section>

        {/* PAGE CONTENT */}

        {renderPageContent()}

        {/* FOOTER */}

        <footer className="dashboard-footer">
          <p>
            © 2026 <strong>SecureVault</strong>. All rights reserved.
          </p>

          <div>
            <span>
              <i className="fa-solid fa-shield-halved"></i>
              Secure Admin Console
            </span>

            <span className="footer-divider">•</span>

            <span>Version 1.0.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
