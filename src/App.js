import React, { useState } from "react";
import "./App.css";

// Initial user base with devices, sessions, and security risk levels
const initialUsersData = [
  {
    id: "USR-001",
    name: "Rahul Verma",
    email: "rahul@example.com",
    role: "Administrator", // ADMIN ACCOUNT (PROTECTED FROM DELETION)
    department: "Security & Operations",
    avatarColor: "avatar-2",
    initials: "RV",
    status: "Active",
    suspiciousLevel: "Low",
    suspiciousScore: 4,
    joinDate: "15 Jan 2024",
    riskFactors: [
      "No security anomalies detected in the last 90 days",
      "Two-Factor Authentication (Hardware Token) actively verified",
      "All login geolocations match corporate trusted subnet",
    ],
    connectedDevices: [
      {
        id: "DEV-101",
        name: "MacBook Pro 16\" (M2 Max)",
        os: "macOS Sonoma 14.4",
        browser: "Chrome 122.0.6",
        ip: "103.21.244.18",
        location: "Mumbai, India",
        type: "Laptop",
        icon: "fa-solid fa-laptop",
        isCurrent: true,
        lastActive: "Just now",
        firstSeen: "15 Jan 2024",
        flagged: false,
      },
      {
        id: "DEV-102",
        name: "iPhone 15 Pro Max",
        os: "iOS 17.4.1",
        browser: "Safari 17.4",
        ip: "103.21.244.20",
        location: "Mumbai, India",
        type: "Mobile",
        icon: "fa-solid fa-mobile-screen-button",
        isCurrent: false,
        lastActive: "2 hours ago",
        firstSeen: "20 Jan 2024",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-201",
        device: "MacBook Pro 16\"",
        ip: "103.21.244.18 (Mumbai, IN)",
        loginTime: "23 Oct 2026, 09:15 AM",
        logoutTime: "Active Session",
        duration: "2h 30m",
        status: "Normal",
      },
      {
        id: "SES-202",
        device: "iPhone 15 Pro Max",
        ip: "103.21.244.20 (Mumbai, IN)",
        loginTime: "22 Oct 2026, 08:30 PM",
        logoutTime: "22 Oct 2026, 09:45 PM",
        duration: "1h 15m",
        status: "Normal",
      },
      {
        id: "SES-203",
        device: "MacBook Pro 16\"",
        ip: "103.21.244.18 (Mumbai, IN)",
        loginTime: "22 Oct 2026, 09:00 AM",
        logoutTime: "22 Oct 2026, 06:15 PM",
        duration: "9h 15m",
        status: "Normal",
      },
    ],
  },
  {
    id: "USR-002",
    name: "Arjun Kumar",
    email: "arjun@example.com",
    role: "Standard User",
    department: "Marketing & Growth",
    avatarColor: "avatar-4",
    initials: "AK",
    status: "Suspicious",
    suspiciousLevel: "Critical",
    suspiciousScore: 94,
    joinDate: "05 Jun 2025",
    riskFactors: [
      "Simultaneous concurrent login from two different countries (India & Russia)",
      "5 consecutive failed password attempts detected within 3 minutes",
      "Unrecognized Tor Exit Node IP detected during last credential access",
      "Abnormal mass download request from SecureVault",
    ],
    connectedDevices: [
      {
        id: "DEV-103",
        name: "Unknown Linux Terminal (Proxy)",
        os: "Kali Linux / Headless",
        browser: "Python-requests / cURL CLI",
        ip: "185.220.101.5",
        location: "Moscow, Russia (Tor Node)",
        type: "Unknown",
        icon: "fa-solid fa-triangle-exclamation",
        isCurrent: true,
        lastActive: "48 minutes ago",
        firstSeen: "23 Oct 2026",
        flagged: true,
      },
      {
        id: "DEV-104",
        name: "Dell Inspiron Desktop",
        os: "Windows 11 Home",
        browser: "Chrome 121.0.1",
        ip: "49.36.128.45",
        location: "Bangalore, India",
        type: "Desktop",
        icon: "fa-solid fa-desktop",
        isCurrent: false,
        lastActive: "1 day ago",
        firstSeen: "05 Jun 2025",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-204",
        device: "Unknown Linux Terminal",
        ip: "185.220.101.5 (Moscow, RU)",
        loginTime: "23 Oct 2026, 10:45 AM",
        logoutTime: "Active Session",
        duration: "48m",
        status: "Critical: Proxy / Tor detected",
      },
      {
        id: "SES-205",
        device: "Unknown Device",
        ip: "185.220.101.5 (Moscow, RU)",
        loginTime: "23 Oct 2026, 10:30 AM",
        logoutTime: "23 Oct 2026, 10:35 AM",
        duration: "Failed (5 attempts)",
        status: "Brute-force lockout alert",
      },
      {
        id: "SES-206",
        device: "Dell Inspiron Desktop",
        ip: "49.36.128.45 (Bangalore, IN)",
        loginTime: "22 Oct 2026, 04:15 PM",
        logoutTime: "22 Oct 2026, 06:00 PM",
        duration: "1h 45m",
        status: "Normal",
      },
    ],
  },
  {
    id: "USR-003",
    name: "Priya Reddy",
    email: "priya@example.com",
    role: "Finance Lead",
    department: "Corporate Finance",
    avatarColor: "avatar-3",
    initials: "PR",
    status: "Under Review",
    suspiciousLevel: "High",
    suspiciousScore: 78,
    joinDate: "18 Aug 2024",
    riskFactors: [
      "Access requested during unusual off-hours (03:15 AM IST)",
      "Rapid succession access to 18 encrypted payment gateway keys",
      "Geographic IP anomaly: switched to unverified mobile ISP range",
    ],
    connectedDevices: [
      {
        id: "DEV-105",
        name: "Samsung Galaxy S24 Ultra",
        os: "Android 14 (OneUI 6.1)",
        browser: "Chrome Mobile 123",
        ip: "157.48.21.90",
        location: "Hyderabad, India",
        type: "Mobile",
        icon: "fa-solid fa-mobile-screen-button",
        isCurrent: true,
        lastActive: "32 minutes ago",
        firstSeen: "10 Mar 2026",
        flagged: true,
      },
      {
        id: "DEV-106",
        name: "HP EliteBook 840 G9",
        os: "Windows 11 Pro",
        browser: "Edge 122.0.1",
        ip: "157.48.21.90",
        location: "Hyderabad, India",
        type: "Laptop",
        icon: "fa-solid fa-laptop",
        isCurrent: false,
        lastActive: "5 hours ago",
        firstSeen: "18 Aug 2024",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-207",
        device: "Samsung Galaxy S24 Ultra",
        ip: "157.48.21.90 (Hyderabad, IN)",
        loginTime: "23 Oct 2026, 11:01 AM",
        logoutTime: "Active Session",
        duration: "32m",
        status: "High: Off-pattern access",
      },
      {
        id: "SES-208",
        device: "Samsung Galaxy S24 Ultra",
        ip: "157.48.21.90 (Hyderabad, IN)",
        loginTime: "23 Oct 2026, 03:15 AM",
        logoutTime: "23 Oct 2026, 03:52 AM",
        duration: "37m",
        status: "High: Off-hours login",
      },
      {
        id: "SES-209",
        device: "HP EliteBook 840 G9",
        ip: "103.11.14.22 (Hyderabad, IN)",
        loginTime: "22 Oct 2026, 09:30 AM",
        logoutTime: "22 Oct 2026, 06:10 PM",
        duration: "8h 40m",
        status: "Normal",
      },
    ],
  },
  {
    id: "USR-004",
    name: "Sneha Patel",
    email: "sneha@example.com",
    role: "Support Specialist",
    department: "Customer Success",
    avatarColor: "avatar-5",
    initials: "SP",
    status: "Active",
    suspiciousLevel: "Medium",
    suspiciousScore: 42,
    joinDate: "12 Nov 2025",
    riskFactors: [
      "Password reset requested twice in 48 hours",
      "Login from unverified private browser session",
    ],
    connectedDevices: [
      {
        id: "DEV-107",
        name: "iPhone 14 Plus",
        os: "iOS 17.3",
        browser: "Safari Mobile 17",
        ip: "106.213.14.78",
        location: "Ahmedabad, India",
        type: "Mobile",
        icon: "fa-solid fa-mobile-screen-button",
        isCurrent: true,
        lastActive: "1 hour ago",
        firstSeen: "12 Nov 2025",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-210",
        device: "iPhone 14 Plus",
        ip: "106.213.14.78 (Ahmedabad, IN)",
        loginTime: "23 Oct 2026, 10:33 AM",
        logoutTime: "Active Session",
        duration: "1h",
        status: "Medium: Password Reset",
      },
      {
        id: "SES-211",
        device: "iPhone 14 Plus",
        ip: "106.213.14.78 (Ahmedabad, IN)",
        loginTime: "21 Oct 2026, 02:10 PM",
        logoutTime: "21 Oct 2026, 05:40 PM",
        duration: "3h 30m",
        status: "Normal",
      },
    ],
  },
  {
    id: "USR-005",
    name: "Ananya Sharma",
    email: "ananya@example.com",
    role: "Lead Developer",
    department: "Engineering",
    avatarColor: "avatar-1",
    initials: "AS",
    status: "Active",
    suspiciousLevel: "Low",
    suspiciousScore: 8,
    joinDate: "02 Mar 2024",
    riskFactors: [
      "Consistent hardware fingerprint verified across all sessions",
      "Multi-factor authentication fully compliant and up to date",
    ],
    connectedDevices: [
      {
        id: "DEV-108",
        name: "ThinkPad X1 Extreme",
        os: "Windows 11 Enterprise",
        browser: "Chrome 122.0.4",
        ip: "122.161.49.12",
        location: "Delhi, India",
        type: "Laptop",
        icon: "fa-solid fa-laptop",
        isCurrent: true,
        lastActive: "2 minutes ago",
        firstSeen: "02 Mar 2024",
        flagged: false,
      },
      {
        id: "DEV-109",
        name: "iPad Air 5th Gen",
        os: "iPadOS 17.4",
        browser: "Safari 17",
        ip: "122.161.49.12",
        location: "Delhi, India",
        type: "Tablet",
        icon: "fa-solid fa-tablet-screen-button",
        isCurrent: false,
        lastActive: "Yesterday",
        firstSeen: "14 May 2024",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-212",
        device: "ThinkPad X1 Extreme",
        ip: "122.161.49.12 (Delhi, IN)",
        loginTime: "23 Oct 2026, 11:31 AM",
        logoutTime: "Active Session",
        duration: "2m",
        status: "Normal",
      },
      {
        id: "SES-213",
        device: "ThinkPad X1 Extreme",
        ip: "122.161.49.12 (Delhi, IN)",
        loginTime: "22 Oct 2026, 10:00 AM",
        logoutTime: "22 Oct 2026, 07:15 PM",
        duration: "9h 15m",
        status: "Normal",
      },
    ],
  },
  {
    id: "USR-006",
    name: "Vikram Malhotra",
    email: "vikram@example.com",
    role: "DevOps Engineer",
    department: "Cloud Infrastructure",
    avatarColor: "avatar-3",
    initials: "VM",
    status: "Active",
    suspiciousLevel: "Low",
    suspiciousScore: 6,
    joinDate: "11 Sep 2024",
    riskFactors: [
      "Hardware SSH keys and FIDO2 MFA certified",
      "Static encrypted corporate VPN endpoint detected",
    ],
    connectedDevices: [
      {
        id: "DEV-110",
        name: "Dell Precision 5570",
        os: "Ubuntu 22.04 LTS",
        browser: "Firefox 123.0",
        ip: "115.112.80.34",
        location: "Pune, India",
        type: "Laptop",
        icon: "fa-solid fa-laptop",
        isCurrent: true,
        lastActive: "15 minutes ago",
        firstSeen: "11 Sep 2024",
        flagged: false,
      },
    ],
    sessions: [
      {
        id: "SES-214",
        device: "Dell Precision 5570",
        ip: "115.112.80.34 (Pune, IN)",
        loginTime: "23 Oct 2026, 11:18 AM",
        logoutTime: "Active Session",
        duration: "15m",
        status: "Normal",
      },
    ],
  },
];

function App() {
  const [activePage, setActivePage] = useState("Dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // User Management Specific States
  const [users, setUsers] = useState(initialUsersData);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userFilter, setUserFilter] = useState("All");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userToDelete, setUserToDelete] = useState(null);
  const [toast, setToast] = useState(null);

  const showToastNotification = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

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
      value: `${2840 + users.length}`,
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

  const [activities, setActivities] = useState([
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
  ]);

  const filteredActivities = activities.filter((activity) =>
    `${activity.name} ${activity.email} ${activity.action} ${activity.status}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase()),
  );

  const handleNavigation = (page) => {
    setActivePage(page);
    setSearchTerm("");
  };

  // User Deletion Handler
  const handleInitiateDelete = (user, e) => {
    if (e) e.stopPropagation();

    // STRICT CHECK: Admin accounts cannot be deleted
    if (user.role === "Administrator") {
      showToastNotification(
        "Action Blocked: Administrator accounts are strictly protected from deletion.",
        "error"
      );
      return;
    }

    // Standard user can be deleted based on suspicious level
    setUserToDelete(user);
  };

  const handleConfirmDelete = () => {
    if (!userToDelete) return;

    if (userToDelete.role === "Administrator") {
      showToastNotification("Cannot delete Administrator account.", "error");
      setUserToDelete(null);
      return;
    }

    // Remove user
    setUsers((prevUsers) => prevUsers.filter((u) => u.id !== userToDelete.id));

    // Log this security action into activities
    setActivities((prev) => [
      {
        name: userToDelete.name,
        email: userToDelete.email,
        action: `Account deleted (Suspicious: ${userToDelete.suspiciousLevel})`,
        device: "Admin Console",
        time: "Just now",
        status: "Review",
        initials: userToDelete.initials,
      },
      ...prev,
    ]);

    // If deleted user was open in the modal, close it
    if (selectedUser?.id === userToDelete.id) {
      setSelectedUser(null);
    }

    showToastNotification(
      `User account "${userToDelete.name}" permanently deleted. All active sessions revoked.`,
      "success"
    );

    setUserToDelete(null);
  };

  // Revoke individual device for a user
  const handleRevokeDevice = (deviceId, e) => {
    if (e) e.stopPropagation();
    if (!selectedUser) return;

    const updatedDevices = selectedUser.connectedDevices.filter(
      (d) => d.id !== deviceId
    );

    const updatedUser = {
      ...selectedUser,
      connectedDevices: updatedDevices,
    };

    setSelectedUser(updatedUser);
    setUsers((prevUsers) =>
      prevUsers.map((u) => (u.id === selectedUser.id ? updatedUser : u))
    );

    showToastNotification("Device access token revoked successfully.", "info");
  };

  // Filtered Users List
  const displayedUsers = users.filter((user) => {
    const matchesSearch =
      `${user.name} ${user.email} ${user.department} ${user.role}`
        .toLowerCase()
        .includes(userSearchQuery.toLowerCase());

    if (userFilter === "All") return matchesSearch;
    return matchesSearch && userFilter.toLowerCase() === user.suspiciousLevel.toLowerCase();
  });

  const criticalCount = users.filter((u) => u.suspiciousLevel === "Critical").length;
  const highCount = users.filter((u) => u.suspiciousLevel === "High").length;
  const adminCount = users.filter((u) => u.role === "Administrator").length;

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
                  <small>View & inspect user devices ({users.length} registered)</small>
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

    // USER MANAGEMENT FULL INTERFACE
    if (activePage === "User Management") {
      return (
        <div className="users-management-wrapper">
          {/* STATS OVERVIEW CARDS */}
          <div className="users-stats-grid">
            <div className="user-stat-card">
              <div className="user-stat-icon blue">
                <i className="fa-solid fa-users"></i>
              </div>
              <div className="user-stat-info">
                <p>Total Registered Users</p>
                <h3>{users.length}</h3>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon red">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div className="user-stat-info">
                <p>High & Critical Suspicious</p>
                <h3>{criticalCount + highCount}</h3>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon purple">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <div className="user-stat-info">
                <p>Protected Admin Accounts</p>
                <h3>{adminCount}</h3>
              </div>
            </div>

            <div className="user-stat-card">
              <div className="user-stat-icon green">
                <i className="fa-solid fa-laptop"></i>
              </div>
              <div className="user-stat-info">
                <p>Active Connected Devices</p>
                <h3>
                  {users.reduce((acc, u) => acc + u.connectedDevices.length, 0)}
                </h3>
              </div>
            </div>
          </div>

          {/* TOOLBAR: SEARCH & FILTER TABS */}
          <div className="users-toolbar">
            <div className="users-search-box">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search user by name, email, department or role..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
              />
              {userSearchQuery && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8" }}
                  onClick={() => setUserSearchQuery("")}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            <div className="users-filter-tabs">
              <button
                className={`risk-filter-tab ${userFilter === "All" ? "active" : ""}`}
                onClick={() => setUserFilter("All")}
              >
                All Users ({users.length})
              </button>
              <button
                className={`risk-filter-tab ${userFilter === "Critical" ? "active critical" : ""}`}
                onClick={() => setUserFilter("Critical")}
              >
                <i className="fa-solid fa-circle-exclamation"></i> Critical ({criticalCount})
              </button>
              <button
                className={`risk-filter-tab ${userFilter === "High" ? "active high" : ""}`}
                onClick={() => setUserFilter("High")}
              >
                <i className="fa-solid fa-shield-halved"></i> High ({highCount})
              </button>
              <button
                className={`risk-filter-tab ${userFilter === "Medium" ? "active medium" : ""}`}
                onClick={() => setUserFilter("Medium")}
              >
                Medium
              </button>
              <button
                className={`risk-filter-tab ${userFilter === "Low" ? "active low" : ""}`}
                onClick={() => setUserFilter("Low")}
              >
                Low Risk
              </button>
            </div>
          </div>

          {/* USERS LIST TABLE */}
          <div className="table-responsive-container">
            <table className="users-data-table">
              <thead>
                <tr>
                  <th>User Identity</th>
                  <th>Role & Status</th>
                  <th>Suspicious Level</th>
                  <th>Connected Devices</th>
                  <th>Recent Activity</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((user) => (
                  <tr key={user.id} onClick={() => setSelectedUser(user)}>
                    <td>
                      <div className="user-identity-cell">
                        <div className={`user-avatar-badge ${user.avatarColor}`}>
                          {user.initials}
                        </div>
                        <div>
                          <strong>{user.name}</strong>
                          <span>{user.email}</span>
                          <span style={{ fontSize: "10px", color: "#94a3b8" }}>{user.department}</span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span
                          className={`role-badge ${
                            user.role === "Administrator" ? "admin" : "user"
                          }`}
                        >
                          {user.role === "Administrator" && (
                            <i className="fa-solid fa-shield-halved"></i>
                          )}
                          {user.role}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b" }}>
                          Status: <strong>{user.status}</strong>
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <span
                          className={`suspicious-pill ${user.suspiciousLevel.toLowerCase()}`}
                        >
                          <i
                            className={
                              user.suspiciousLevel === "Critical"
                                ? "fa-solid fa-triangle-exclamation"
                                : user.suspiciousLevel === "High"
                                ? "fa-solid fa-shield-halved"
                                : user.suspiciousLevel === "Medium"
                                ? "fa-solid fa-circle-exclamation"
                                : "fa-solid fa-circle-check"
                            }
                          ></i>
                          {user.suspiciousLevel} ({user.suspiciousScore}%)
                        </span>
                      </div>
                    </td>

                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span
                          className={`device-chip ${
                            user.connectedDevices.some((d) => d.flagged) ? "flagged" : ""
                          }`}
                        >
                          <i className="fa-solid fa-laptop"></i>
                          {user.connectedDevices.length} Connected
                        </span>
                        {user.connectedDevices.some((d) => d.flagged) && (
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#dc2626",
                              fontWeight: 700,
                              background: "#fee2e2",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            Flagged IP
                          </span>
                        )}
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: "12px", color: "#475569" }}>
                        {user.sessions[0]?.loginTime || "Never"}
                      </span>
                      <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                        {user.sessions[0]?.device || "No device"}
                      </div>
                    </td>

                    <td>
                      <div
                        className="table-action-btns"
                        style={{ justifyContent: "flex-end" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="btn-inspect"
                          onClick={() => setSelectedUser(user)}
                          title="View Devices & Login/Logout Timeline"
                        >
                          <i className="fa-solid fa-eye"></i> Details
                        </button>

                        {/* ADMIN PROTECTION RULE */}
                        {user.role === "Administrator" ? (
                          <span
                            className="btn-protected-admin"
                            title="Administrator accounts cannot be deleted as per security governance policy"
                          >
                            <i className="fa-solid fa-lock"></i> Admin Protected
                          </span>
                        ) : (
                          <button
                            className="btn-delete-user"
                            onClick={(e) => handleInitiateDelete(user, e)}
                            title={`Delete user account (Suspicious Level: ${user.suspiciousLevel})`}
                          >
                            <i className="fa-solid fa-trash-can"></i> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {displayedUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      <i className="fa-solid fa-users-slash" style={{ fontSize: "28px", marginBottom: "10px", display: "block" }}></i>
                      No users match your criteria. Try adjusting the search term or risk filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    if (activePage === "Password Vault") {
      return (
        <section className="dashboard-card page-placeholder">
          <div className="placeholder-icon purple">
            <i className="fa-solid fa-fingerprint"></i>
          </div>

          <h2>Password Vault Overview</h2>
          <p>Monitor stored credentials and review vault security information.</p>

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
            This is a dashboard preview. Live vault data will be connected through the backend.
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
            Sample visualization only. Connect real analytics data for production use.
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
            Settings shown here are a frontend preview. Save settings through the backend when it is integrated.
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

              {item.name === "User Management" && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "#edf2ff",
                    color: "#2455e8",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  {users.length}
                </span>
              )}

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
              {activePage === "Dashboard"
                ? "Dashboard Overview"
                : activePage === "User Management"
                ? "User Identity & Device Management"
                : activePage}
            </h1>

            <p>
              {activePage === "Dashboard"
                ? "Welcome back! Here's what's happening with your vault today."
                : activePage === "User Management"
                ? "Inspect connected devices, track login/logout histories, evaluate suspicious activity levels, and manage user accounts."
                : `Review and manage your ${activePage.toLowerCase()} information.`}
            </p>
          </div>

          <button
            className="refresh-button"
            onClick={() => {
              setSearchTerm("");
              setShowNotifications(false);
              setShowProfile(false);
              setUserSearchQuery("");
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

      {/* ========================================================= */}
      {/* MODAL 1: USER DETAILS (DEVICES, SESSIONS, SUSPICIOUS LEVEL) */}
      {/* ========================================================= */}
      {selectedUser && (
        <div className="modal-backdrop" onClick={() => setSelectedUser(null)}>
          <div
            className="user-detail-modal"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header-section">
              <div className="modal-user-identity">
                <div className={`modal-user-avatar ${selectedUser.avatarColor}`}>
                  {selectedUser.initials}
                </div>
                <div className="modal-user-info">
                  <h2>
                    {selectedUser.name}
                    <span
                      className={`role-badge ${
                        selectedUser.role === "Administrator" ? "admin" : "user"
                      }`}
                    >
                      {selectedUser.role === "Administrator" && (
                        <i className="fa-solid fa-shield-halved"></i>
                      )}
                      {selectedUser.role}
                    </span>
                  </h2>
                  <p>
                    {selectedUser.email} • {selectedUser.department} • ID: {selectedUser.id}
                  </p>
                </div>
              </div>

              <button
                className="modal-close-btn"
                onClick={() => setSelectedUser(null)}
                aria-label="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="modal-scrollable-content">
              {/* SUSPICIOUS LEVEL EVALUATION CARD */}
              <div
                className={`risk-evaluation-card ${selectedUser.suspiciousLevel.toLowerCase()}`}
              >
                <div className="risk-card-top">
                  <div
                    className={`risk-level-badge-large ${selectedUser.suspiciousLevel.toLowerCase()}`}
                  >
                    <i
                      className={
                        selectedUser.suspiciousLevel === "Critical"
                          ? "fa-solid fa-triangle-exclamation"
                          : selectedUser.suspiciousLevel === "High"
                          ? "fa-solid fa-shield-halved"
                          : selectedUser.suspiciousLevel === "Medium"
                          ? "fa-solid fa-circle-exclamation"
                          : "fa-solid fa-circle-check"
                      }
                    ></i>
                    Suspicious Level: {selectedUser.suspiciousLevel.toUpperCase()}
                  </div>

                  <span className="risk-score-value">
                    Risk Score: {selectedUser.suspiciousScore}%
                  </span>
                </div>

                <div className="risk-progress-bar">
                  <div
                    className={`risk-progress-fill ${selectedUser.suspiciousLevel.toLowerCase()}`}
                    style={{ width: `${selectedUser.suspiciousScore}%` }}
                  ></div>
                </div>

                <div className="risk-triggers-section">
                  <h4>Security Audit & Risk Indicators</h4>
                  <ul
                    className={`risk-triggers-list ${selectedUser.suspiciousLevel.toLowerCase()}`}
                  >
                    {selectedUser.riskFactors.map((factor, idx) => (
                      <li key={idx}>
                        <i
                          className={
                            selectedUser.suspiciousLevel === "Low"
                              ? "fa-solid fa-circle-check"
                              : "fa-solid fa-triangle-exclamation"
                          }
                        ></i>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* CONNECTED DEVICES SECTION */}
              <div>
                <div className="modal-section-heading">
                  <h3>
                    <i className="fa-solid fa-laptop"></i> Connected Devices (
                    {selectedUser.connectedDevices.length})
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Hardware fingerprint & authorized tokens
                  </span>
                </div>

                <div className="devices-list-grid">
                  {selectedUser.connectedDevices.map((device) => (
                    <div
                      key={device.id}
                      className={`connected-device-item ${
                        device.flagged ? "flagged" : ""
                      }`}
                    >
                      <div className="device-type-icon">
                        <i className={device.icon}></i>
                      </div>

                      <div className="device-details-box">
                        <div className="device-title-row">
                          <strong>{device.name}</strong>
                          <span
                            className={`device-session-badge ${
                              device.flagged
                                ? "flagged"
                                : device.isCurrent
                                ? "current"
                                : ""
                            }`}
                          >
                            {device.flagged
                              ? "Flagged Session"
                              : device.isCurrent
                              ? "Current Device"
                              : "Active"}
                          </span>
                        </div>

                        <div className="device-specs-meta">
                          {device.os} • {device.browser}
                        </div>

                        <div className="device-footer-row">
                          <span className="device-ip-location">
                            <i className="fa-solid fa-network-wired"></i>
                            {device.ip} ({device.location})
                          </span>

                          <button
                            className="btn-revoke-device"
                            onClick={(e) => handleRevokeDevice(device.id, e)}
                            title="Revoke this device session immediately"
                          >
                            <i className="fa-solid fa-ban"></i> Revoke
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedUser.connectedDevices.length === 0 && (
                    <div
                      style={{
                        padding: "20px",
                        textAlign: "center",
                        background: "#f8fafc",
                        borderRadius: "8px",
                        gridColumn: "1 / -1",
                        color: "#64748b",
                        fontSize: "12px",
                      }}
                    >
                      No active devices currently connected.
                    </div>
                  )}
                </div>
              </div>

              {/* LOGIN / LOGOUT SESSIONS TIMELINE */}
              <div>
                <div className="modal-section-heading">
                  <h3>
                    <i className="fa-solid fa-clock-rotate-left"></i> Login &
                    Logout Session Timeline
                  </h3>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Recent authentication events
                  </span>
                </div>

                <div className="sessions-history-card">
                  <table className="sessions-mini-table">
                    <thead>
                      <tr>
                        <th>Device & Network IP</th>
                        <th>Login Time</th>
                        <th>Logout Time</th>
                        <th>Duration</th>
                        <th>Event Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedUser.sessions.map((sess) => (
                        <tr key={sess.id}>
                          <td>
                            <strong>{sess.device}</strong>
                            <div style={{ fontSize: "10px", color: "#64748b" }}>
                              {sess.ip}
                            </div>
                          </td>
                          <td>
                            <span style={{ color: "#059669", fontWeight: 600 }}>
                              <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: "4px" }}></i>
                              {sess.loginTime}
                            </span>
                          </td>
                          <td>
                            <span
                              style={{
                                color:
                                  sess.logoutTime === "Active Session"
                                    ? "#2563eb"
                                    : "#64748b",
                                fontWeight: 600,
                              }}
                            >
                              {sess.logoutTime === "Active Session" ? (
                                <>
                                  <i className="fa-solid fa-circle-dot" style={{ marginRight: "4px", color: "#2563eb" }}></i>
                                  Active Session
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-arrow-right-from-bracket" style={{ marginRight: "4px" }}></i>
                                  {sess.logoutTime}
                                </>
                              )}
                            </span>
                          </td>
                          <td>{sess.duration}</td>
                          <td>
                            <span
                              className={`session-status-tag ${
                                sess.status.toLowerCase().includes("critical")
                                  ? "danger"
                                  : sess.status.toLowerCase().includes("high") ||
                                    sess.status.toLowerCase().includes("off") ||
                                    sess.status.toLowerCase().includes("lockout")
                                  ? "warn"
                                  : "normal"
                              }`}
                            >
                              {sess.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer / Actions */}
            <div className="modal-footer-bar">
              {/* ADMIN DELETION RESTRICTION RULE */}
              {selectedUser.role === "Administrator" ? (
                <div className="admin-protection-note">
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>
                    <strong>Admin Account Protected:</strong> Administrator accounts cannot be deleted as per security and governance policy.
                  </span>
                </div>
              ) : (
                <div className="danger-account-action">
                  <button
                    className="btn-modal-delete"
                    onClick={() => handleInitiateDelete(selectedUser)}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    Delete User Account (Risk: {selectedUser.suspiciousLevel})
                  </button>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    Revokes all {selectedUser.connectedDevices.length} connected device(s)
                  </span>
                </div>
              )}

              <button
                className="btn-modal-close-secondary"
                onClick={() => setSelectedUser(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CONFIRM USER DELETION DIALOG */}
      {/* ========================================================= */}
      {userToDelete && (
        <div className="modal-backdrop" onClick={() => setUserToDelete(null)}>
          <div
            className="confirm-delete-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="confirm-delete-icon-wrapper">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>

            <div>
              <h3>Confirm User Account Deletion</h3>
              <p>
                Are you sure you want to delete the user account for{" "}
                <strong>{userToDelete.name}</strong>? This action is irreversible.
              </p>
            </div>

            <div className="deletion-summary-box">
              <div className="deletion-summary-row">
                <span>User Email:</span>
                <strong>{userToDelete.email}</strong>
              </div>
              <div className="deletion-summary-row">
                <span>Account Role:</span>
                <strong>{userToDelete.role}</strong>
              </div>
              <div className="deletion-summary-row">
                <span>Suspicious Level:</span>
                <span
                  className={`suspicious-pill ${userToDelete.suspiciousLevel.toLowerCase()}`}
                  style={{ fontSize: "10px", padding: "2px 8px" }}
                >
                  {userToDelete.suspiciousLevel} ({userToDelete.suspiciousScore}%)
                </span>
              </div>
              <div className="deletion-summary-row">
                <span>Devices to Revoke:</span>
                <strong style={{ color: "#dc2626" }}>
                  {userToDelete.connectedDevices.length} Connected Device(s)
                </strong>
              </div>
            </div>

            <div className="confirm-dialog-actions">
              <button
                className="btn-dialog-cancel"
                onClick={() => setUserToDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn-dialog-confirm-delete"
                onClick={handleConfirmDelete}
              >
                <i className="fa-solid fa-trash-can"></i>
                Yes, Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TOAST NOTIFICATION BANNER */}
      {/* ========================================================= */}
      {toast && (
        <div className="toast-container">
          <div className={`toast-item ${toast.type}`}>
            <i
              className={
                toast.type === "success"
                  ? "fa-solid fa-circle-check"
                  : toast.type === "error"
                  ? "fa-solid fa-triangle-exclamation"
                  : "fa-solid fa-circle-info"
              }
            ></i>
            <div className="toast-content">
              <strong>
                {toast.type === "success"
                  ? "Action Successful"
                  : toast.type === "error"
                  ? "Action Blocked"
                  : "Notification"}
              </strong>
              <p>{toast.message}</p>
            </div>
            <button
              className="toast-close-btn"
              onClick={() => setToast(null)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
