import React, { useCallback, useEffect, useState } from "react";
import "./App.css";

function App({ accessToken, currentUser, onLogout }) {
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

  const [dashboardStats, setDashboardStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [users, setUsers] = useState([]);
  const [assignableRoles, setAssignableRoles] = useState([]);
  const [roleSelections, setRoleSelections] = useState({});
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [userActionMessage, setUserActionMessage] = useState("");
  const [vaultStats, setVaultStats] = useState(null);
  const [vaultStatsLoading, setVaultStatsLoading] = useState(false);
  const [vaultStatsError, setVaultStatsError] = useState("");
  const [securityAnalytics, setSecurityAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState("");
  const [adminSettings, setAdminSettings] = useState({
    securityMonitoringEnabled: true,
    activityMonitoringEnabled: true,
  });
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");

  const refreshAdminSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error(`Settings could not be loaded (HTTP ${response.status}).`);
      setAdminSettings(await response.json());
      setSettingsLoaded(true);
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not load settings. Try refreshing.");
    } finally {
      setSettingsLoading(false);
    }
  }, [accessToken, onLogout]);

  const saveAdminSettings = async () => {
    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMessage("");
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(adminSettings),
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error(`Settings could not be saved (HTTP ${response.status}).`);
      setAdminSettings(await response.json());
      setSettingsLoaded(true);
      setSettingsMessage("Settings saved successfully.");
    } catch (error) {
      setSettingsError(error instanceof Error ? error.message : "Could not save settings. Try again.");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    if (activePage === "Settings") refreshAdminSettings();
  }, [activePage, refreshAdminSettings]);

  const refreshActivityLogs = useCallback(async () => {
    setActivityLogsLoading(true);
    setActivityLogsError("");
    try {
      const response = await fetch("/api/admin/activity-logs", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error("Activity logs could not be loaded.");
      setActivityLogs(await response.json());
    } catch {
      setActivityLogsError("Could not load activity logs. Try refreshing.");
    } finally {
      setActivityLogsLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    if (activePage === "Activity Logs" || activePage === "Dashboard") refreshActivityLogs();
  }, [activePage, refreshActivityLogs]);

  const refreshSecurityAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch("/api/admin/analytics/security-events", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error(`Analytics could not be loaded (HTTP ${response.status}).`);
      setSecurityAnalytics(await response.json());
    } catch (error) {
      setAnalyticsError(error instanceof Error
        ? error.message
        : "Could not load security analytics. Try refreshing.");
    } finally {
      setAnalyticsLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    if (activePage === "Security Analytics") refreshSecurityAnalytics();
  }, [activePage, refreshSecurityAnalytics]);

  const refreshVaultStatistics = useCallback(async () => {
    setVaultStatsLoading(true);
    setVaultStatsError("");
    try {
      const response = await fetch("/api/admin/vault/statistics", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error("Vault statistics could not be loaded.");
      setVaultStats(await response.json());
    } catch {
      setVaultStatsError("Could not load vault statistics. Try refreshing.");
    } finally {
      setVaultStatsLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    if (activePage === "Password Vault") refreshVaultStatistics();
  }, [activePage, refreshVaultStatistics]);

  const refreshStatistics = useCallback(async () => {
    setStatsLoading(true);
    setStatsError("");
    try {
      const response = await fetch("/api/admin/dashboard/statistics", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error("Statistics could not be loaded.");
      setDashboardStats(await response.json());
    } catch {
      setStatsError("Could not load live dashboard statistics. Try refreshing.");
    } finally {
      setStatsLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    refreshStatistics();
  }, [refreshStatistics]);

  const refreshUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");
    setUserActionMessage("");
    try {
      const headers = { Authorization: `Bearer ${accessToken}` };
      const [usersResponse, rolesResponse] = await Promise.all([
        fetch("/api/admin/users", { headers }),
        fetch("/api/admin/roles", { headers }),
      ]);
      if ([usersResponse.status, rolesResponse.status].some((status) => status === 401 || status === 403)) {
        onLogout?.();
        return;
      }
      if (!usersResponse.ok || !rolesResponse.ok) {
        throw new Error("User information could not be loaded.");
      }
      const [userList, roleList] = await Promise.all([usersResponse.json(), rolesResponse.json()]);
      setUsers(userList);
      setAssignableRoles(roleList);
      setRoleSelections((previous) => Object.fromEntries(
        userList.map((user) => [user.id, previous[user.id] || roleList[0] || ""]),
      ));
    } catch {
      setUsersError("Could not load users and available roles. Try refreshing.");
    } finally {
      setUsersLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    if (activePage === "User Management") refreshUsers();
  }, [activePage, refreshUsers]);

  const assignUserRole = async (userId) => {
    setUsersError("");
    setUserActionMessage("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: roleSelections[userId] }),
      });
      if (response.status === 401 || response.status === 403) {
        onLogout?.();
        return;
      }
      if (!response.ok) throw new Error("Role assignment failed.");
      await refreshUsers();
      setUserActionMessage("Role assigned successfully.");
    } catch {
      setUsersError("Could not assign the selected role. Try again.");
    }
  };

  const stats = [
    {
      title: "Total Users",
      key: "totalUsers",
      description: "Registered accounts",
      icon: "fa-solid fa-users",
      color: "blue",
    },
    {
      title: "Stored Credentials",
      key: "storedCredentials",
      description: "Credentials in vaults",
      icon: "fa-solid fa-key",
      color: "purple",
    },
    {
      title: "Active Sessions",
      key: "activeSessions",
      description: "Unrevoked, unexpired sessions",
      icon: "fa-solid fa-desktop",
      color: "green",
    },
    {
      title: "Security Alerts",
      key: "securityAlerts",
      description: "Unresolved security events",
      icon: "fa-solid fa-shield-halved",
      color: "orange",
    },
  ];

  const filteredActivities = activityLogs.filter((activity) =>
    `${activity.username} ${activity.activity} ${activity.device || ""} ${activity.status}`.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const formatActivityTime = (timestamp) => new Date(timestamp).toLocaleString();

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

                </div>

                <p className="stat-title">{stat.title}</p>

                <h2 className="stat-value">
                  {statsLoading ? "…" : dashboardStats?.[stat.key] ?? "—"}
                </h2>

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
                  Overview
                </span>
              </div>

              <div className="security-content">
                <div className="fingerprint-display">
                  <div className="fingerprint-circle">
                    <i className="fa-solid fa-fingerprint"></i>
                  </div>

                  <span className="security-check">
                    <i className="fa-solid fa-circle-question"></i>
                  </span>
                </div>

                <div className="security-score">
                    <h3>Not assessed</h3>
                    <p>No current security score is available</p>

                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: "0%" }}></div>
                  </div>

                  <span>Security score unavailable</span>
                </div>
              </div>

              <div className="security-footer">
                <div>
                  <i className="fa-solid fa-lock"></i>
                  <span>Encryption status unavailable</span>
                </div>

                <div>
                  <i className="fa-solid fa-shield-halved"></i>
                  <span>Monitoring preference</span>
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
                  {activityLogsLoading && (
                    <tr><td colSpan="5" className="empty-results">Loading recent activity…</td></tr>
                  )}
                  {!activityLogsLoading && activityLogsError && (
                    <tr><td colSpan="5" className="empty-results">{activityLogsError}</td></tr>
                  )}
                  {!activityLogsLoading && !activityLogsError && activityLogs.length === 0 && (
                    <tr><td colSpan="5" className="empty-results">No activity records found.</td></tr>
                  )}
                  {!activityLogsLoading && !activityLogsError && activityLogs.slice(0, 4).map((activity, index) => (
                    <tr key={index}>
                      <td>
                        <div className="user-cell">
                          <div className={`user-avatar avatar-${index + 1}`}>
                            {activity.username.slice(0, 2).toUpperCase()}
                          </div>

                          <div>
                            <strong>{activity.username}</strong>
                          </div>
                        </div>
                      </td>

                      <td>{activity.activity}</td>

                      <td>{activity.device || "Unknown device"}</td>

                      <td>{formatActivityTime(activity.timestamp)}</td>

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
                <p>Live protection status is unavailable.</p>
                <span className="info-status">
                  <i className="fa-solid fa-circle-check"></i>
                  Status unavailable
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
      const activeUsers = users.filter((user) => user.active).length;
      return (
        <>
          <section className="dashboard-card page-placeholder user-management-summary">
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
                <strong>{usersLoading ? "…" : users.length}</strong>
              </div>

              <div>
                <span>Active Users</span>
                <strong>{usersLoading ? "…" : activeUsers}</strong>
              </div>

              <div>
                <span>Inactive Users</span>
                <strong>{usersLoading ? "…" : users.length - activeUsers}</strong>
              </div>
            </div>

            <div className="user-management-toolbar">
              <span>{assignableRoles.length} assignable roles available</span>
              <button className="refresh-button" onClick={refreshUsers} disabled={usersLoading}>
                <i className="fa-solid fa-rotate-right"></i> Refresh users
              </button>
            </div>
            {usersError && <p className="user-management-message error" role="alert">{usersError}</p>}
            {userActionMessage && <p className="user-management-message" role="status">{userActionMessage}</p>}
          </section>

          <section className="dashboard-card activity-card user-management-card">
            <div className="card-heading activity-heading">
              <div>
                <h2>Registered Users</h2>
                <p>Review account status and assign an allowed role.</p>
              </div>
            </div>
            <div className="table-wrapper">
              <table className="activity-table user-management-table">
                <thead>
                  <tr><th>USERNAME</th><th>EMAIL</th><th>STATUS</th><th>ROLES</th><th>ASSIGN ROLE</th></tr>
                </thead>
                <tbody>
                  {usersLoading && <tr><td colSpan="5" className="empty-results">Loading users…</td></tr>}
                  {!usersLoading && users.length === 0 && <tr><td colSpan="5" className="empty-results">No users found.</td></tr>}
                  {!usersLoading && users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{user.email}</td>
                      <td><span className={`status-badge ${user.active ? "success" : "review"}`}>
                        <span className="status-dot"></span>{user.active ? "Active" : "Inactive"}
                      </span></td>
                      <td>{user.roles.length ? user.roles.join(", ") : "—"}</td>
                      <td>
                        <div className="user-role-controls">
                          <select
                            aria-label={`Role to assign to ${user.username}`}
                            value={roleSelections[user.id] || ""}
                            onChange={(event) => setRoleSelections((previous) => ({
                              ...previous,
                              [user.id]: event.target.value,
                            }))}
                            disabled={!assignableRoles.length}
                          >
                            {assignableRoles.map((role) => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <button
                            className="refresh-button user-role-assign-button"
                            onClick={() => assignUserRole(user.id)}
                            disabled={!assignableRoles.length || usersLoading}
                          >Add role</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
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
            <strong>{vaultStatsLoading ? "…" : vaultStats?.storedCredentials?.toLocaleString() ?? "—"}</strong>
            </div>

            <div>
              <span>Protected Vaults</span>
            <strong>{vaultStatsLoading ? "…" : vaultStats?.protectedVaults?.toLocaleString() ?? "—"}</strong>
            </div>

            <div>
              <span>Security Status</span>
              <strong>Not assessed</strong>
            </div>
          </div>

          {vaultStatsError && <p className="demo-notice" role="alert">{vaultStatsError}</p>}
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
            {securityAnalytics.map((point, index, points) => (
              <div className="bar-column" key={index}>
                <div className="bar" title={`${point.count} security events`} style={{ height: `${point.count === 0 ? 0 : Math.max(8, (point.count / Math.max(...points.map(({ count }) => count))) * 100)}%` }}></div>

                <span>
                  {new Date(`${point.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })}
                </span>
              </div>
            ))}
          </div>

          {analyticsLoading && <p className="demo-notice" role="status">Loading security analytics…</p>}
          {analyticsError && <p className="demo-notice" role="alert">{analyticsError}</p>}
          {!analyticsLoading && !analyticsError && securityAnalytics.length > 0
            && securityAnalytics.every((point) => point.count === 0)
            && <p className="demo-notice" role="status">No security events recorded in the last 7 days.</p>}
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
                          {activity.username.slice(0, 2).toUpperCase()}
                        </div>

                        <div>
                          <strong>{activity.username}</strong>
                        </div>
                      </div>
                    </td>

                    <td>{activity.activity}</td>
                    <td>{activity.device || "Unknown device"}</td>
                    <td>{formatActivityTime(activity.timestamp)}</td>

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
                      {activityLogsLoading ? "Loading activity logs…" : activityLogsError || "No activity records found."}
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

            <button
              type="button"
              className="settings-enabled"
              aria-pressed={settingsLoaded ? adminSettings.securityMonitoringEnabled : undefined}
              disabled={settingsLoading || settingsSaving || !settingsLoaded}
              onClick={() => setAdminSettings((current) => ({
                ...current,
                securityMonitoringEnabled: !current.securityMonitoringEnabled,
              }))}
            >
              {settingsLoading ? "Loading…" : settingsLoaded ? adminSettings.securityMonitoringEnabled ? "Enabled" : "Disabled" : "Unavailable"}
            </button>
          </div>

          <div className="settings-row">
            <div>
              <strong>Activity Monitoring</strong>
              <span>Review account activity records</span>
            </div>

            <button
              type="button"
              className="settings-enabled"
              aria-pressed={settingsLoaded ? adminSettings.activityMonitoringEnabled : undefined}
              disabled={settingsLoading || settingsSaving || !settingsLoaded}
              onClick={() => setAdminSettings((current) => ({
                ...current,
                activityMonitoringEnabled: !current.activityMonitoringEnabled,
              }))}
            >
              {settingsLoading ? "Loading…" : settingsLoaded ? adminSettings.activityMonitoringEnabled ? "Enabled" : "Disabled" : "Unavailable"}
            </button>
          </div>

          <button className="refresh-button" onClick={saveAdminSettings}
            disabled={settingsLoading || settingsSaving || !settingsLoaded}>
            {settingsSaving ? "Saving…" : "Save Settings"}
          </button>
          {settingsMessage && <p className="demo-notice" role="status">{settingsMessage}</p>}
          {settingsError && <p className="demo-notice" role="alert">{settingsError}</p>}
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
              <strong>{currentUser?.username || "Administrator"}</strong>
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

              </button>

              {showNotifications && (
                <div className="floating-menu notification-menu">
                  <h3>Notifications</h3>

                  <p className="empty-results">No notifications available.</p>
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
                    <strong>{currentUser?.username || "Administrator"}</strong>
                    <span>{currentUser?.email || "Admin account"}</span>
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
                      onLogout?.();
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
              refreshStatistics();
              if (activePage === "User Management") refreshUsers();
              if (activePage === "Security Analytics") refreshSecurityAnalytics();
              if (activePage === "Password Vault") refreshVaultStatistics();
              if (activePage === "Activity Logs" || activePage === "Dashboard") refreshActivityLogs();
              if (activePage === "Settings") refreshAdminSettings();
            }}
            disabled={statsLoading || analyticsLoading || vaultStatsLoading || activityLogsLoading || settingsLoading || settingsSaving}
          >
            <i className="fa-solid fa-rotate-right"></i>
            Refresh View
          </button>
        </section>

        {/* PAGE CONTENT */}

        {statsError && <p className="demo-notice" role="alert">{statsError}</p>}
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
