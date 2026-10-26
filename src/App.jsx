import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import MfaSettingsPanel from "./MfaSettingsPanel";
import { exportAuditTrail } from "./auditExport";
import {
  AdminApiError,
  clearAdminSession,
  getActivities,
  getAdminIdentity,
  getAnalytics,
  getDashboardOverview,
  getMfaStatus,
  getSystemOverview,
  getUserDetails,
  getUserStats,
  getUsers,
  getVaultOverview,
  revokeDevice,
  setUserActive,
  setUserRole,
  startTotpSetup,
  confirmTotpSetup,
  disableTotp,
  completeAdminMfa,
  signInAdmin,
  signOutAdmin,
  updateSecurityEventStatus,
} from "./adminApi";

const PAGE_SIZE = 10;
const AUDIT_EXPORT_PAGE_SIZE = 100;
const MAX_AUDIT_EXPORT_ROWS = 50000;
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: "fa-solid fa-grid-2" },
  { id: "users", label: "Users & roles", icon: "fa-solid fa-users" },
  { id: "security", label: "Threat analysis", icon: "fa-solid fa-shield-halved" },
  { id: "activity", label: "Audit trail", icon: "fa-solid fa-clock-rotate-left" },
  { id: "vaults", label: "Vaults", icon: "fa-solid fa-vault" },
  { id: "account-security", label: "Account security", icon: "fa-solid fa-mobile-screen-button" },
  { id: "system", label: "System health", icon: "fa-solid fa-sliders" },
];

const numberFormat = new Intl.NumberFormat("en-IN");
const formatCount = (value) => value == null ? "—" : numberFormat.format(value);
const formatDate = (value, fallback = "—") => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
};
const formatDay = (value) => {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { weekday: "short" });
};
const initials = (value = "SV") => value.trim().split(/[\s._-]+/).filter(Boolean).slice(0, 2)
  .map((part) => part[0].toUpperCase()).join("") || "SV";
const titleCase = (value = "") => value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const riskClass = (risk = "low") => risk.toLowerCase();
const roleValue = (user) => user?.roles?.includes("ROLE_ADMIN") ? "ROLE_ADMIN"
  : user?.roles?.includes("ROLE_TEAM_MEMBER") ? "ROLE_TEAM_MEMBER" : "ROLE_USER";

function errorMessage(error) {
  if (error instanceof AdminApiError) return error.message;
  return "The request could not be completed. Please try again.";
}

function AdminSignIn({ onSignedIn, initialMessage = "" }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage);
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState("");

  useEffect(() => setError(initialMessage), [initialMessage]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (challenge) {
        const identity = await completeAdminMfa({ challengeId: challenge.challengeId, code });
        onSignedIn(identity);
      } else {
        const result = await signInAdmin({ identifier, password });
        setPassword("");
        if (result.mfaChallenge) setChallenge(result.mfaChallenge);
        else onSignedIn(result);
      }
    } catch (requestError) {
      setError(requestError.status === 403
        ? "This account does not have administrator access. Contact an administrator."
        : errorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="admin-auth-screen">
      <div className="admin-auth-wrap">
        <a className="admin-auth-brand" href="http://localhost:3000/" aria-label="SecureVault user portal">
          <span className="admin-brand-mark"><i className="fa-solid fa-shield-halved" /></span>
          <span><strong>SecureVault</strong><small>SECURE ACCESS PLATFORM</small></span>
        </a>
        <section className="admin-auth-card" aria-labelledby="admin-login-title">
          <aside className="admin-auth-story">
            <div className="auth-story-topline"><span className="auth-eyebrow-dot" /> ADMINISTRATOR ACCESS</div>
            <div className="auth-story-copy">
              <div className="auth-shield-art"><span className="shield-orbit orbit-one" /><span className="shield-orbit orbit-two" /><i className="fa-solid fa-fingerprint" /></div>
              <p className="auth-kicker">SECUREVAULT CONTROL ROOM</p>
              <h1>Clarity for every layer of security.</h1>
              <p>Monitor account health, investigate unusual activity, and keep your workspace protected from one place.</p>
            </div>
            <div className="auth-story-footer"><span><i className="fa-solid fa-lock" /> Protected administrator session</span><span>01 / 01</span></div>
          </aside>
          <div className="admin-auth-form-panel">
            <div className="auth-mobile-mark"><span className="admin-brand-mark"><i className="fa-solid fa-shield-halved" /></span><span>SecureVault <b>ADMIN</b></span></div>
            <div className="auth-form-heading">
              <span className="auth-form-eyebrow">{challenge ? "VERIFY SIGN IN" : "WELCOME BACK"}</span>
              <h2 id="admin-login-title">{challenge ? "Confirm it’s you" : "Sign in to your console"}</h2>
              <p>{challenge?.method === "EMAIL" ? `Enter the six-digit code sent to ${challenge.maskedEmail}.` : challenge ? "Enter the current six-digit code from your authenticator app." : "Use your administrator account to continue."}</p>
            </div>
            {error && <div className="admin-auth-error" role="alert"><i className="fa-solid fa-circle-exclamation" /><span>{error}</span></div>}
            <form onSubmit={submit} className="admin-auth-form">
              {challenge ? <>
                <label htmlFor="admin-mfa-code">Six-digit verification code</label>
                <div className="admin-input-wrap"><i className="fa-solid fa-shield-halved" /><input id="admin-mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required /></div>
                <button className="admin-auth-submit" type="submit" disabled={busy || code.length !== 6}>{busy ? <><i className="fa-solid fa-spinner fa-spin" /> Verifying code…</> : <>Verify and continue <i className="fa-solid fa-arrow-right" /></>}</button>
                <button className="mfa-back-button" type="button" onClick={() => { setChallenge(null); setCode(""); setIdentifier(""); setError(""); }}>Back to administrator sign in</button>
              </> : <>
                <label htmlFor="admin-identifier">Username or email</label>
                <div className="admin-input-wrap"><i className="fa-regular fa-user" /><input id="admin-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" placeholder="name@company.com" required /></div>
                <div className="admin-password-label"><label htmlFor="admin-password">Password</label><span><i className="fa-solid fa-shield-halved" /> Admin role required</span></div>
                <div className="admin-input-wrap"><i className="fa-solid fa-key" /><input id="admin-password" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Enter your password" required /><button type="button" className="password-visibility" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"}><i className={`fa-regular ${visible ? "fa-eye-slash" : "fa-eye"}`} /></button></div>
                <button className="admin-auth-submit" type="submit" disabled={busy}>{busy ? <><i className="fa-solid fa-spinner fa-spin" /> Verifying access…</> : <>Continue securely <i className="fa-solid fa-arrow-right" /></>}</button>
              </>}
            </form>
            <div className="admin-auth-separator"><span /> <small>SECURE CONNECTION</small> <span /></div>
            <div className="admin-auth-footnote"><i className="fa-solid fa-circle-check" /><span>Your account role and active session are verified by the server on every request.</span></div>
            <a className="user-portal-link" href="http://localhost:3000/"><i className="fa-solid fa-arrow-left" /> Back to SecureVault user sign in</a>
          </div>
        </section>
        <p className="auth-legal-line">SecureVault <span>·</span> Administrator console <span>·</span> Protected workspace</p>
      </div>
    </main>
  );
}

function MetricCard({ label, value, note, icon, tone, trend }) {
  return (
    <article className="metric-card">
      <div className="metric-topline"><span className={`metric-icon ${tone}`}><i className={icon} /></span><span className="metric-trend"><i className="fa-solid fa-arrow-up-right-from-square" /> {trend}</span></div>
      <p>{label}</p><strong>{formatCount(value)}</strong><small>{note}</small>
    </article>
  );
}

function PageTitle({ eyebrow, title, description, children }) {
  return <div className="page-title-row"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</div>;
}

function Pagination({ pageData, onChange }) {
  if (!pageData || pageData.total <= pageData.size) return null;
  const pages = Math.ceil(pageData.total / pageData.size);
  return (
    <div className="pagination-row"><span>Showing {pageData.page * pageData.size + 1}–{Math.min(pageData.total, (pageData.page + 1) * pageData.size)} of {formatCount(pageData.total)}</span>
      <div><button onClick={() => onChange(Math.max(0, pageData.page - 1))} disabled={pageData.page === 0} aria-label="Previous page"><i className="fa-solid fa-arrow-left" /></button><span>Page {pageData.page + 1} of {pages}</span><button onClick={() => onChange(Math.min(pages - 1, pageData.page + 1))} disabled={pageData.page >= pages - 1} aria-label="Next page"><i className="fa-solid fa-arrow-right" /></button></div>
    </div>
  );
}

function ActivityRows({ items = [], compact = false, empty = "No activity to show yet." }) {
  if (!items.length) return <div className="empty-state compact-empty"><span className="empty-state-icon"><i className="fa-regular fa-folder-open" /></span><strong>{empty}</strong><p>New events will appear here as they are recorded.</p></div>;
  return <div className={`activity-list ${compact ? "activity-list-compact" : ""}`}>
    {items.map((activity, index) => <article className="activity-row" key={activity.id || `${activity.action}-${index}`}>
      <span className={`activity-avatar tone-${index % 4}`}>{initials(activity.name)}</span>
      <div className="activity-main"><strong>{activity.action}</strong><span>{activity.name}{activity.email ? ` · ${activity.email}` : ""}</span></div>
      <div className="activity-meta"><time>{formatDate(activity.time)}</time><span className={`activity-status ${activity.status === "Success" ? "good" : "review"}`}><i />{activity.status}</span></div>
    </article>)}
  </div>;
}

function RiskChart({ daily = [] }) {
  const peak = Math.max(1, ...daily.map((item) => item.total || 0));
  return (
    <div className="risk-chart" role="img" aria-label="Security events by severity for the last seven days">
      <div className="chart-grid-lines"><span>{peak}</span><span>{Math.ceil(peak / 2)}</span><span>0</span></div>
      <div className="chart-columns">{daily.map((day) => <div className="chart-day" key={day.date} title={`${day.date}: ${day.total} event(s)`}>
        <div className="chart-bar-track"><div className="chart-bar-stack">
          {[["low", day.low], ["medium", day.medium], ["high", day.high], ["critical", day.critical]].map(([severity, amount]) => <span key={severity} className={`chart-segment ${severity}`} style={{ height: `${Math.max(0, (amount / peak) * 100)}%` }} />)}
        </div></div><small>{formatDay(day.date)}</small>
      </div>)}</div>
    </div>
  );
}

function EventCard({ event, onStatusChange, busy }) {
  const severity = riskClass(event.severity || "low");
  const status = event.status || (event.resolved ? "RESOLVED" : "OPEN");
  return <article className="event-row"><span className={`event-severity-mark ${severity}`}><i className="fa-solid fa-bolt" /></span><div className="event-main"><div className="event-title"><strong>{titleCase((event.eventType || "Security event").replaceAll("_", " "))}</strong><span className={`severity-tag ${severity}`}>{titleCase(severity)}</span>{event.anomalyDetected && <span className="anomaly-tag">Anomaly</span>}</div><p>{event.username}{event.email ? ` · ${event.email}` : ""} <span>·</span> {event.ipAddress || "IP unavailable"}</p><small>{formatDate(event.timestamp)} <span>·</span> Risk score {event.riskScore}</small></div>
    <label className={`threat-status ${status.toLowerCase()}`}><span>Status</span><select aria-label={`Threat status for ${event.eventType}`} value={status} onChange={(change) => onStatusChange(event.id, change.target.value)} disabled={busy}><option value="OPEN">Open</option><option value="INVESTIGATING">Investigating</option><option value="RESOLVED">Resolved</option></select></label>
  </article>;
}

function App() {
  const [authState, setAuthState] = useState("checking");
  const [authMessage, setAuthMessage] = useState("");
  const [admin, setAdmin] = useState(null);
  const [activePage, setActivePage] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityExportFormat, setActivityExportFormat] = useState("");
  const [activityExportProgress, setActivityExportProgress] = useState("");
  const [overview, setOverview] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [users, setUsers] = useState({ items: [], page: 0, size: PAGE_SIZE, total: 0 });
  const [activities, setActivities] = useState({ items: [], page: 0, size: PAGE_SIZE, total: 0 });
  const [vaultOverview, setVaultOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [systemOverview, setSystemOverview] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [quickSearch, setQuickSearch] = useState("");
  const [activitySearch, setActivitySearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [userPage, setUserPage] = useState(0);
  const [activityPage, setActivityPage] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userToChange, setUserToChange] = useState(null);
  const [roleChange, setRoleChange] = useState(null);
  const [busyAction, setBusyAction] = useState("");
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, tone = "success") => {
    setToast({ message, tone, id: Date.now() });
  }, []);

  const expireSession = useCallback((message = "Your administrator session has expired. Sign in again.") => {
    clearAdminSession();
    setAdmin(null);
    setAuthMessage(message);
    setAuthState("signed-out");
  }, []);

  const handleRequestError = useCallback((error) => {
    if (error?.status === 401) {
      expireSession();
      return;
    }
    if (error?.status === 403) {
      expireSession("Administrator access could not be verified for this account.");
      return;
    }
    notify(errorMessage(error), "error");
  }, [expireSession, notify]);

  useEffect(() => {
    let mounted = true;
    let token = null;
    try { token = sessionStorage.getItem("securevault_admin_jwt"); } catch { /* storage unavailable */ }
    if (!token) {
      setAuthState("signed-out");
      return () => { mounted = false; };
    }
    getAdminIdentity().then((identity) => {
      if (!mounted) return;
      setAdmin(identity);
      setAuthState("signed-in");
    }).catch((error) => {
      clearAdminSession();
      if (!mounted) return;
      setAuthMessage(error.status === 403 ? "This account does not have administrator access." : "Your administrator session has expired. Sign in again.");
      setAuthState("signed-out");
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (authState !== "signed-in") return undefined;
    let mounted = true;
    setSummaryLoading(true);
    Promise.all([getDashboardOverview(), getUserStats(), getVaultOverview(), getAnalytics(), getSystemOverview()])
      .then(([dashboard, stats, vaults, reports, system]) => {
        if (!mounted) return;
        setOverview(dashboard); setUserStats(stats); setVaultOverview(vaults); setAnalytics(reports); setSystemOverview(system);
      }).catch((error) => { if (mounted) handleRequestError(error); })
      .finally(() => { if (mounted) setSummaryLoading(false); });
    return () => { mounted = false; };
  }, [authState, refreshKey, handleRequestError]);

  useEffect(() => {
    if (authState !== "signed-in") return undefined;
    let mounted = true;
    setUserLoading(true);
    const timer = window.setTimeout(() => {
      getUsers({ search: userSearch, risk: riskFilter, page: userPage, size: PAGE_SIZE })
        .then((data) => { if (mounted) setUsers(data); })
        .catch((error) => { if (mounted) handleRequestError(error); })
        .finally(() => { if (mounted) setUserLoading(false); });
    }, 180);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [authState, userSearch, riskFilter, userPage, refreshKey, handleRequestError]);

  useEffect(() => {
    if (authState !== "signed-in" || activePage !== "activity") return undefined;
    let mounted = true;
    setActivityLoading(true);
    const timer = window.setTimeout(() => {
      getActivities({ search: activitySearch, page: activityPage, size: PAGE_SIZE })
        .then((data) => { if (mounted) setActivities(data); })
        .catch((error) => { if (mounted) handleRequestError(error); })
        .finally(() => { if (mounted) setActivityLoading(false); });
    }, 160);
    return () => { mounted = false; window.clearTimeout(timer); };
  }, [authState, activePage, activitySearch, activityPage, refreshKey, handleRequestError]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleSignIn = (identity) => {
    setAdmin(identity);
    setAuthMessage("");
    setActivePage("overview");
    setAuthState("signed-in");
  };

  const handleSignOut = async () => {
    try { await signOutAdmin(); } catch { clearAdminSession(); }
    setAdmin(null); setSelectedUser(null); setAuthState("signed-out"); setActivePage("overview");
  };

  const navigate = (page) => {
    setActivePage(page);
    setSidebarOpen(false);
    if (page === "activity") setActivityPage(0);
  };

  const openUser = async (user) => {
    setSelectedUser({ ...user, loading: true, riskFactors: [], connectedDevices: [], sessions: [] });
    try {
      const details = await getUserDetails(user.id);
      setSelectedUser({ ...details.user, riskFactors: details.riskFactors || [], connectedDevices: details.connectedDevices || [], sessions: details.sessions || [], loading: false });
    } catch (error) {
      setSelectedUser(null);
      handleRequestError(error);
    }
  };

  const changeUserStatus = async () => {
    if (!userToChange) return;
    setBusyAction(userToChange.id);
    try {
      await setUserActive(userToChange.id, !userToChange.active);
      notify(userToChange.active ? "Account disabled. Its active sessions were revoked." : "Account enabled.");
      setUserToChange(null);
      if (selectedUser?.id === userToChange.id) setSelectedUser(null);
      setRefreshKey((key) => key + 1);
    } catch (error) { handleRequestError(error); }
    finally { setBusyAction(""); }
  };

  const requestRoleChange = (user, role) => {
    if (roleValue(user) === role || user.id === admin?.id) return;
    setRoleChange({ user, role, currentPassword: "" });
  };

  const changeUserRole = async (event) => {
    event.preventDefault();
    if (!roleChange) return;
    const { user, role, currentPassword } = roleChange;
    setBusyAction(user.id);
    try {
      await setUserRole(user.id, role, currentPassword);
      notify(`Role updated for ${user.name}.`);
      setRoleChange(null);
      setRefreshKey((key) => key + 1);
      if (selectedUser?.id === user.id) await openUser({ ...user, role, roles: [role] });
    } catch (error) {
      setRoleChange((current) => current ? { ...current, currentPassword: "" } : null);
      handleRequestError(error);
    }
    finally { setBusyAction(""); }
  };

  const handleRevokeDevice = async (device) => {
    if (!selectedUser || device.isCurrent) return;
    setBusyAction(device.id);
    try {
      await revokeDevice(selectedUser.id, device.id);
      notify("Device sessions revoked.", "info");
      await openUser(selectedUser);
      setRefreshKey((key) => key + 1);
    } catch (error) { handleRequestError(error); }
    finally { setBusyAction(""); }
  };

  const handleEventStatus = async (eventId, status) => {
    setBusyAction(eventId);
    try {
      await updateSecurityEventStatus(eventId, status);
      notify(`Threat marked ${status.toLowerCase()}.`);
      setRefreshKey((key) => key + 1);
    } catch (error) { handleRequestError(error); }
    finally { setBusyAction(""); }
  };

  const exportActivities = async (format) => {
    if (activityExportFormat) return;
    setActivityExportFormat(format);
    setActivityExportProgress("Loading audit records…");
    try {
      const firstPage = await getActivities({ search: activitySearch, page: 0, size: AUDIT_EXPORT_PAGE_SIZE });
      const total = Number(firstPage.total ?? firstPage.items?.length ?? 0);
      if (total > MAX_AUDIT_EXPORT_ROWS) {
        throw new Error("This export exceeds 50,000 records. Search to narrow the audit trail and try again.");
      }

      const rows = [...(firstPage.items || [])];
      setActivityExportProgress(`Loading ${formatCount(rows.length)} of ${formatCount(total)} records`);
      const pageCount = Math.ceil(total / AUDIT_EXPORT_PAGE_SIZE);
      for (let page = 1; page < pageCount; page += 1) {
        const result = await getActivities({ search: activitySearch, page, size: AUDIT_EXPORT_PAGE_SIZE });
        if (!result.items?.length) break;
        rows.push(...result.items);
        setActivityExportProgress(`Loading ${formatCount(Math.min(rows.length, total))} of ${formatCount(total)} records`);
      }

      const uniqueRows = [...new Map(rows.map((item) => [item.id, item])).values()];
      if (!uniqueRows.length) {
        notify("No audit records match this search.", "info");
        return;
      }
      exportAuditTrail(uniqueRows, format);
      notify(`Exported ${formatCount(uniqueRows.length)} audit records as ${format.toUpperCase()}.`);
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setActivityExportFormat("");
      setActivityExportProgress("");
    }
  };

  const jumpToUsers = (event) => {
    event.preventDefault();
    setUserSearch(quickSearch.trim());
    setUserPage(0);
    navigate("users");
  };

  const pages = useMemo(() => ({
    overview: { eyebrow: "SECUREVAULT / OVERVIEW", title: "Good to see you, " + (admin?.username || "admin"), description: "A live view of your accounts, security signals, and workspace health." },
    users: { eyebrow: "ACCESS CONTROL", title: "Users & roles", description: "Review accounts, risk, sessions, and administrator access." },
    security: { eyebrow: "THREAT MONITORING", title: "Threat analysis", description: "Review login risk, password health, vault activity, and security alerts." },
    activity: { eyebrow: "AUDIT & COMPLIANCE", title: "Audit trail", description: "Search the latest sign-in and administrator events." },
    vaults: { eyebrow: "DATA PROTECTION", title: "Vault overview", description: "Review protected vault totals without exposing credential contents." },
    "account-security": { eyebrow: "ACCOUNT SECURITY", title: "Sign-in protection", description: "Manage the authenticator linked to your administrator account." },
    system: { eyebrow: "PLATFORM STATUS", title: "System health", description: "Check the backend, database, session policy, and operational totals." },
  }), [admin?.username]);

  if (authState === "checking") return <main className="admin-auth-screen"><div className="auth-checking"><span className="admin-brand-mark"><i className="fa-solid fa-shield-halved" /></span><i className="fa-solid fa-spinner fa-spin" /> Checking your administrator session…</div></main>;
  if (authState !== "signed-in") return <AdminSignIn onSignedIn={handleSignIn} initialMessage={authMessage} />;

  const pageTitle = pages[activePage];
  const activeEvents = analytics?.events?.filter((event) => !event.resolved) || [];
  const unresolvedBySeverity = { critical: analytics?.critical ?? 0, high: analytics?.high ?? 0, medium: analytics?.medium ?? 0, low: analytics?.low ?? 0 };
  const securityStats = [
    { label: "Total accounts", value: overview?.totalUsers, note: "Registered in SecureVault", icon: "fa-solid fa-users", tone: "blue", trend: "Accounts" },
    { label: "Active sessions", value: overview?.activeSessions, note: "Current unexpired sessions", icon: "fa-solid fa-laptop", tone: "cyan", trend: "Live" },
    { label: "Open security alerts", value: overview?.securityAlerts, note: "Awaiting administrator review", icon: "fa-solid fa-triangle-exclamation", tone: "amber", trend: "Review" },
    { label: "Protected vaults", value: overview?.vaultCount, note: `${formatCount(overview?.storedCredentials)} encrypted records`, icon: "fa-solid fa-vault", tone: "violet", trend: "Protected" },
  ];

  const renderOverview = () => (
    <div className="page-stack">
      <section className="welcome-panel">
        <div className="welcome-copy"><span className="welcome-label"><i className="fa-solid fa-sparkles" /> YOUR SECURITY AT A GLANCE</span><h2>Everything important, <em>in view.</em></h2><p>Keep your workspace healthy. Review new signals, account activity, and access changes from one command center.</p><div className="welcome-actions"><button className="button-primary" onClick={() => navigate("security")}>Review security <i className="fa-solid fa-arrow-right" /></button><span className="welcome-live"><i /> Live data from SecureVault</span></div></div>
        <div className="welcome-score"><div className="score-ring" style={{ "--score": `${overview?.securityScore ?? 0}%` }}><div><strong>{overview?.securityScore ?? "—"}<small>%</small></strong><span>HEALTH SCORE</span></div></div><span className="score-caption"><i className="fa-solid fa-shield-check" /> Workspace posture</span></div>
        <div className="welcome-decoration welcome-decoration-one" /><div className="welcome-decoration welcome-decoration-two" />
      </section>
      <section className="metric-grid">{securityStats.map((metric) => <MetricCard key={metric.label} {...metric} />)}</section>
      <section className="overview-grid">
        <article className="panel chart-panel"><div className="panel-heading"><div><span className="panel-eyebrow">LAST 7 DAYS</span><h2>Security activity</h2><p>Events by severity over time</p></div><button className="panel-link" onClick={() => navigate("security")}>Explore <i className="fa-solid fa-arrow-up-right-from-square" /></button></div><RiskChart daily={analytics?.daily || []} /><div className="chart-legend"><span><i className="legend-dot critical" /> Critical</span><span><i className="legend-dot high" /> High</span><span><i className="legend-dot medium" /> Medium</span><span><i className="legend-dot low" /> Low</span></div></article>
        <article className="panel posture-panel"><div className="panel-heading"><div><span className="panel-eyebrow">OPEN ITEMS</span><h2>Needs attention</h2><p>Unresolved risk signals</p></div><span className="alert-total">{formatCount(overview?.securityAlerts)}</span></div><div className="severity-summary">{Object.entries(unresolvedBySeverity).map(([severity, count]) => <div key={severity}><span className={`severity-dot ${severity}`} /><span>{titleCase(severity)}</span><strong>{formatCount(count)}</strong><span className="severity-track"><i className={severity} style={{ width: `${overview?.securityAlerts ? Math.min(100, (count / overview.securityAlerts) * 100) : 0}%` }} /></span></div>)}</div><button className="panel-wide-link" onClick={() => navigate("security")}>Open security center <i className="fa-solid fa-arrow-right" /></button></article>
      </section>
      <section className="overview-grid overview-lower-grid">
        <article className="panel"><div className="panel-heading"><div><span className="panel-eyebrow">RECENT CHANGES</span><h2>Latest activity</h2><p>New events from your audit trail</p></div><button className="panel-link" onClick={() => navigate("activity")}>All activity <i className="fa-solid fa-arrow-right" /></button></div><ActivityRows items={overview?.recentActivities || []} compact /></article>
        <article className="panel event-preview-panel"><div className="panel-heading"><div><span className="panel-eyebrow">PRIORITY REVIEW</span><h2>Security events</h2><p>{activeEvents.length} recent unresolved item(s)</p></div><button className="panel-link" onClick={() => navigate("security")}>View all <i className="fa-solid fa-arrow-right" /></button></div>{activeEvents.slice(0, 3).map((event) => <EventCard key={event.id} event={event} onStatusChange={handleEventStatus} busy={busyAction === event.id} />)}{!activeEvents.length && <div className="clear-state"><span><i className="fa-solid fa-check" /></span><strong>All clear</strong><p>No unresolved security events.</p></div>}</article>
      </section>
      <div className="privacy-note"><i className="fa-solid fa-lock" /><span>Credential contents remain encrypted and are never exposed in administrator views.</span><button onClick={() => navigate("vaults")}>Vault privacy <i className="fa-solid fa-arrow-right" /></button></div>
    </div>
  );

  const renderUsers = () => (
    <div className="page-stack">
      <section className="mini-stat-grid"><article><span className="mini-stat-icon blue"><i className="fa-solid fa-users" /></span><div><small>Accounts</small><strong>{formatCount(userStats?.totalUsers)}</strong></div></article><article><span className="mini-stat-icon red"><i className="fa-solid fa-triangle-exclamation" /></span><div><small>High or critical risk</small><strong>{formatCount((userStats?.highRiskUsers || 0) + (userStats?.criticalUsers || 0))}</strong></div></article><article><span className="mini-stat-icon violet"><i className="fa-solid fa-user-shield" /></span><div><small>Administrators</small><strong>{formatCount(userStats?.adminAccounts)}</strong></div></article><article><span className="mini-stat-icon cyan"><i className="fa-solid fa-laptop" /></span><div><small>Registered devices</small><strong>{formatCount(userStats?.registeredDevices)}</strong></div></article></section>
      <section className="panel user-panel"><div className="table-toolbar"><div><span className="panel-eyebrow">ACCOUNT DIRECTORY</span><h2>People in your workspace</h2><p>Inspect accounts and manage access safely.</p></div><label className="table-search"><i className="fa-solid fa-magnifying-glass" /><input value={userSearch} onChange={(event) => { setUserSearch(event.target.value); setUserPage(0); }} placeholder="Search name, email or role" /></label></div>
        <div className="filter-row" role="group" aria-label="Filter users by risk">{["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((risk) => <button key={risk} className={`filter-chip ${riskFilter === risk ? "selected" : ""}`} onClick={() => { setRiskFilter(risk); setUserPage(0); }}>{risk === "ALL" ? "All accounts" : <><span className={`severity-dot ${risk.toLowerCase()}`} />{titleCase(risk)}</>}</button>)}<span className="filter-result-count">{formatCount(users.total)} account(s)</span></div>
        <div className="table-scroll"><table className="data-table users-table"><thead><tr><th>Account</th><th>Access role</th><th>Risk</th><th>Activity</th><th>Status</th><th><span className="visually-hidden">Actions</span></th></tr></thead><tbody>
          {users.items.map((user) => <tr key={user.id}>
            <td><div className="table-user"><span className="user-avatar">{initials(user.name)}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td>
            <td><label className="role-select-wrap"><select aria-label={`Role for ${user.name}`} value={roleValue(user)} disabled={busyAction === user.id || user.id === admin?.id} onChange={(event) => requestRoleChange(user, event.target.value)}><option value="ROLE_USER">Standard user</option><option value="ROLE_TEAM_MEMBER">Team member</option><option value="ROLE_ADMIN">Administrator</option></select><i className="fa-solid fa-chevron-down" /></label></td>
            <td><span className={`risk-badge ${riskClass(user.riskLevel)}`}><i />{titleCase(user.riskLevel)} <b>{user.riskScore}</b></span></td>
            <td><span className="table-activity-date">{formatDate(user.lastActivity, "No sign-in yet")}</span><small className="table-subline">{formatCount(user.activeSessions)} session(s) · {formatCount(user.registeredDevices)} device(s)</small></td>
            <td><span className={`account-status ${user.active ? "active" : "disabled"}`}><i />{user.active ? "Active" : "Disabled"}</span></td>
            <td><div className="row-actions"><button className="icon-action" onClick={() => openUser(user)} aria-label={`View ${user.name} details`} title="View account details"><i className="fa-regular fa-eye" /></button><button className={`icon-action ${user.active ? "danger-action" : "good-action"}`} disabled={user.role === "Administrator" || busyAction === user.id} onClick={() => setUserToChange(user)} aria-label={user.active ? `Disable ${user.name}` : `Enable ${user.name}`} title={user.role === "Administrator" ? "Administrator accounts are protected" : user.active ? "Disable account" : "Enable account"}><i className={`fa-solid ${user.active ? "fa-user-slash" : "fa-user-check"}`} /></button></div></td>
          </tr>)}
          {!users.items.length && <tr><td colSpan="6"><div className="empty-state"><span className="empty-state-icon"><i className="fa-solid fa-users-slash" /></span><strong>{userLoading ? "Loading accounts…" : "No matching accounts"}</strong><p>Try another name or risk filter.</p></div></td></tr>}
        </tbody></table></div>
        {userLoading && <div className="table-loading"><i className="fa-solid fa-spinner fa-spin" /> Updating account list</div>}
        <Pagination pageData={users} onChange={setUserPage} />
        <div className="table-footnote"><i className="fa-solid fa-circle-info" /> Administrator accounts cannot be disabled here. Role changes are audited and the last active administrator is protected.</div>
      </section>
    </div>
  );

  const renderSecurity = () => (
    <div className="page-stack">
      <section className="security-summary-banner"><div><span className="panel-eyebrow">OVERALL VAULT SECURITY SCORE</span><h2>{(analytics?.securityScore ?? overview?.securityScore ?? 0) >= 80 ? "No high-impact risks are currently open." : "Review the latest security signals."}</h2><p>Score factors in open threat severity, available password-health findings, and monitoring coverage gaps.</p></div><div className="security-summary-score"><strong>{analytics?.securityScore ?? overview?.securityScore ?? "—"}<small>%</small></strong><span>SECURITY SCORE</span></div></section>
      <section className="panel threat-panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">SIGN-IN MONITORING</span><h2>Login and IP activity</h2><p>Successful and failed sign-ins over the last day, with source IP visibility.</p></div><span className="live-pill"><i /> LIVE DATA</span></div><div className="threat-metric-grid">
        <article><span className="mini-stat-icon green"><i className="fa-solid fa-right-to-bracket" /></span><div><small>Successful sign-ins · 24h</small><strong>{formatCount(analytics?.loginMonitoring?.successful24h)}</strong></div></article>
        <article><span className="mini-stat-icon amber"><i className="fa-solid fa-triangle-exclamation" /></span><div><small>Failed sign-ins · 24h</small><strong>{formatCount(analytics?.loginMonitoring?.failed24h)}</strong></div></article>
        <article><span className="mini-stat-icon blue"><i className="fa-solid fa-location-dot" /></span><div><small>Unique source IPs · 7d</small><strong>{formatCount(analytics?.loginMonitoring?.uniqueIps7d)}</strong></div></article>
        <article><span className="mini-stat-icon violet"><i className="fa-solid fa-laptop" /></span><div><small>First-seen devices · 30d</small><strong>{formatCount(analytics?.loginMonitoring?.newDevices30d)}</strong></div></article>
        <article><span className="mini-stat-icon cyan"><i className="fa-regular fa-clock" /></span><div><small>Unusual-hour alerts · 30d</small><strong>{formatCount(analytics?.loginMonitoring?.unusualHours30d)}</strong></div></article>
        <article><span className="mini-stat-icon red"><i className="fa-solid fa-user-lock" /></span><div><small>Repeated-failure alerts · 30d</small><strong>{formatCount(analytics?.loginMonitoring?.repeatedFailures30d)}</strong></div></article>
      </div><p className="threat-footnote">A repeated-failure alert starts at 3 rejected attempts from the same account and IP within 10 minutes, and rises to Critical at 5. First-seen devices use a pseudonymous browser-profile fingerprint. Unusual-hour detection uses UTC 00:00–04:59 after five prior successful sign-ins in the past 30 days, when no earlier sign-in falls in that window.</p></section>
      <section className="panel threat-panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">CREDENTIAL HEALTH</span><h2>Weak, reused, and compromised passwords</h2><p>Aggregate assessment only; the admin console never receives password contents.</p></div><span className={`coverage-pill ${analytics?.passwordHealth?.assessedUsers ? "covered" : "limited"}`}>{analytics?.passwordHealth?.assessedUsers ? `${formatCount(analytics.passwordHealth.assessedUsers)} / ${formatCount(analytics.passwordHealth.totalUsers)} assessed` : "Assessment data unavailable"}</span></div><div className="threat-metric-grid password-threat-grid">
        <article><span className="mini-stat-icon amber"><i className="fa-solid fa-key" /></span><div><small>Weak credentials · score &lt; 40</small><strong>{formatCount(analytics?.passwordHealth?.weakPasswords)}</strong></div></article>
        <article><span className="mini-stat-icon orange"><i className="fa-solid fa-clone" /></span><div><small>Reused passwords</small><strong>{formatCount(analytics?.passwordHealth?.reusedPasswords)}</strong></div></article>
        <article><span className="mini-stat-icon red"><i className="fa-solid fa-bug" /></span><div><small>Compromised passwords</small><strong>{formatCount(analytics?.passwordHealth?.compromisedPasswords)}</strong></div></article>
        <article><span className="mini-stat-icon blue"><i className="fa-solid fa-gauge-high" /></span><div><small>Average strength score</small><strong>{analytics?.passwordHealth?.averageStrength == null ? "—" : `${analytics.passwordHealth.averageStrength}%`}</strong></div></article>
      </div><p className="threat-footnote">Weak counts use stored strength metadata or health reports. Reuse and breach counts appear only when a password-health assessment has supplied them.</p></section>
      <section className="panel threat-panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">VAULT ACCESS MONITORING</span><h2>Suspicious vault activity</h2><p>Vault and credential audit events are checked for security alerts.</p></div><span className={`coverage-pill ${analytics?.vaultMonitoring?.trackingActive ? "covered" : "limited"}`}>{analytics?.vaultMonitoring?.trackingActive ? "Audit history available" : "No vault events recorded"}</span></div><div className="threat-metric-grid vault-threat-grid"><article><span className="mini-stat-icon violet"><i className="fa-solid fa-vault" /></span><div><small>Vault/credential audit events</small><strong>{formatCount(analytics?.vaultMonitoring?.trackedEvents)}</strong></div></article><article><span className="mini-stat-icon red"><i className="fa-solid fa-shield-halved" /></span><div><small>Open suspicious-access alerts</small><strong>{formatCount(analytics?.vaultMonitoring?.suspiciousAlerts)}</strong></div></article></div><p className="threat-footnote">A burst of 20 successful vault or credential audit actions from one account and IP within five minutes creates a High alert. Credential access operations are not yet emitting audit events in this backend, so zero means no source data is available to analyze.</p></section>
      <section className="mini-stat-grid severity-mini-grid">{Object.entries(unresolvedBySeverity).map(([severity, count]) => <article key={severity}><span className={`mini-stat-icon ${severity}`}><i className="fa-solid fa-bolt" /></span><div><small>{titleCase(severity)} alerts</small><strong>{formatCount(count)}</strong></div></article>)}</section>
      <section className="panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">SEVEN DAY TREND</span><h2>Events by severity</h2><p>Daily counts from the security event log.</p></div><span className="live-pill"><i /> LIVE DATA</span></div><RiskChart daily={analytics?.daily || []} /><div className="chart-legend"><span><i className="legend-dot critical" /> Critical</span><span><i className="legend-dot high" /> High</span><span><i className="legend-dot medium" /> Medium</span><span><i className="legend-dot low" /> Low</span></div></section>
      <section className="panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">INVESTIGATE</span><h2>Security alerts and threat status</h2><p>Change each item to open, investigating, or resolved.</p></div><span className="alert-total">{formatCount(analytics?.unresolved)}</span></div><div className="event-list">{analytics?.events?.map((event) => <EventCard key={event.id} event={event} onStatusChange={handleEventStatus} busy={busyAction === event.id} />)}{!analytics?.events?.length && <div className="empty-state"><span className="empty-state-icon"><i className="fa-solid fa-shield-check" /></span><strong>No security events recorded</strong><p>New signals will appear when the backend records them.</p></div>}</div></section>
      <section className="panel"><div className="panel-heading panel-heading-spaced"><div><span className="panel-eyebrow">AUTHENTICATION AUDIT</span><h2>Recent login records</h2><p>Source IP, account, result, and timestamp from the audit log.</p></div><button className="panel-link" onClick={() => navigate("activity")}>Full audit trail <i className="fa-solid fa-arrow-right" /></button></div><div className="audit-table-wrap"><table className="data-table audit-table"><thead><tr><th>Event</th><th>Account</th><th>Source IP</th><th>Time</th><th>Result</th></tr></thead><tbody>{(analytics?.recentAuthentication || []).map((item) => <tr key={item.id}><td><strong>{item.action}</strong></td><td><span className="audit-account">{item.name}</span><small className="table-subline">{item.email}</small></td><td><span className="mono-text">{item.device}</span></td><td>{formatDate(item.time)}</td><td><span className={`activity-status ${item.status === "Success" ? "good" : "review"}`}><i />{item.status}</span></td></tr>)}{!analytics?.recentAuthentication?.length && <tr><td colSpan="5"><div className="empty-state"><strong>No login records found</strong><p>New successful and failed sign-ins will appear here.</p></div></td></tr>}</tbody></table></div></section>
    </div>
  );

  const renderActivity = () => (
    <section className="panel activity-panel"><div className="table-toolbar"><div><span className="panel-eyebrow">AUDIT RECORDS</span><h2>Recent account and admin events</h2><p>Search by account name, email, or action type. Export up to 50,000 matches.</p></div><div className="activity-toolbar-actions"><label className="table-search"><i className="fa-solid fa-magnifying-glass" /><input value={activitySearch} onChange={(event) => { setActivitySearch(event.target.value); setActivityPage(0); }} placeholder="Search audit trail" /></label><div className="activity-export-buttons"><button type="button" className="activity-export-button" onClick={() => exportActivities("csv")} disabled={activityLoading || Boolean(activityExportFormat) || activities.total === 0}>{activityExportFormat === "csv" ? <><i className="fa-solid fa-spinner fa-spin" /> Preparing CSV…</> : <><i className="fa-solid fa-file-csv" /> CSV</>}</button><button type="button" className="activity-export-button excel" onClick={() => exportActivities("xlsx")} disabled={activityLoading || Boolean(activityExportFormat) || activities.total === 0}>{activityExportFormat === "xlsx" ? <><i className="fa-solid fa-spinner fa-spin" /> Preparing Excel…</> : <><i className="fa-solid fa-file-excel" /> Excel</>}</button></div>{activityExportProgress && <span className="activity-export-progress" role="status" aria-live="polite">{activityExportProgress}</span>}</div></div><div className="audit-table-wrap"><table className="data-table audit-table"><thead><tr><th>Event</th><th>Account</th><th>Source</th><th>Time</th><th>Result</th></tr></thead><tbody>{activities.items.map((item) => <tr key={item.id}><td><span className="audit-action-icon"><i className="fa-solid fa-arrow-right-arrow-left" /></span><strong>{item.action}</strong>{item.details && <small className="table-subline">{item.details}</small>}</td><td><span className="audit-account">{item.name}</span><small className="table-subline">{item.email}</small></td><td><span className="mono-text">{item.device}</span></td><td>{formatDate(item.time)}</td><td><span className={`activity-status ${item.status === "Success" ? "good" : "review"}`}><i />{item.status}</span></td></tr>)}{!activities.items.length && <tr><td colSpan="5"><div className="empty-state"><span className="empty-state-icon"><i className="fa-regular fa-rectangle-list" /></span><strong>{activityLoading ? "Loading audit records…" : "No audit records found"}</strong><p>Adjust your search or check back after activity is recorded.</p></div></td></tr>}</tbody></table></div>{activityLoading && <div className="table-loading"><i className="fa-solid fa-spinner fa-spin" /> Searching audit records</div>}<Pagination pageData={activities} onChange={setActivityPage} /></section>
  );

  const renderVaults = () => (
    <div className="page-stack"><section className="vault-intro-panel"><div className="vault-intro-icon"><i className="fa-solid fa-vault" /></div><div><span className="panel-eyebrow">PRIVACY FIRST</span><h2>Vault metadata, without secret exposure.</h2><p>Administrators can review usage totals. Credential values and decrypted contents are never returned to this console.</p></div><span className="vault-lock-chip"><i className="fa-solid fa-lock" /> CONTENTS PRIVATE</span></section><section className="mini-stat-grid vault-stat-grid"><article><span className="mini-stat-icon violet"><i className="fa-solid fa-vault" /></span><div><small>Protected vaults</small><strong>{formatCount(vaultOverview?.vaultCount)}</strong></div></article><article><span className="mini-stat-icon blue"><i className="fa-solid fa-key" /></span><div><small>Encrypted records</small><strong>{formatCount(vaultOverview?.storedCredentials)}</strong></div></article><article><span className="mini-stat-icon cyan"><i className="fa-solid fa-user-shield" /></span><div><small>Users with vaults</small><strong>{formatCount(vaultOverview?.usersWithVault)}</strong></div></article></section><section className="panel vault-health-panel"><div className="panel-heading"><div><span className="panel-eyebrow">DATA PROTECTION</span><h2>How administrator access works</h2><p>Metadata is available for operational insight while credential content stays private.</p></div></div><div className="vault-principles"><article><span><i className="fa-solid fa-fingerprint" /></span><div><strong>Database-backed totals</strong><p>Vault, credential, and owner counts are queried from the live database.</p></div></article><article><span><i className="fa-solid fa-lock" /></span><div><strong>No decrypted secrets</strong><p>The admin API returns aggregate counts and never exposes credential values.</p></div></article><article><span><i className="fa-solid fa-shield-halved" /></span><div><strong>Role-checked requests</strong><p>Every dashboard endpoint verifies the token, active session, account, and administrator role.</p></div></article></div></section></div>
  );

  const renderSystem = () => (
    <div className="page-stack"><section className="system-status-banner"><span className="system-status-icon"><i className="fa-solid fa-heart-pulse" /></span><div><span className="panel-eyebrow">CURRENT STATUS</span><h2>SecureVault platform</h2><p>Live service checks and operational counters from the backend.</p></div><span className="service-state"><i />{systemOverview?.serviceStatus || "Checking"}</span></section><section className="system-card-grid"><article className="panel system-card"><span className="system-item-icon green"><i className="fa-solid fa-server" /></span><div><small>Backend API</small><strong>{systemOverview?.serviceStatus || "Checking"}</strong><span>Administrator endpoints and auth service</span></div><span className={`system-indicator ${systemOverview?.serviceStatus === "Operational" ? "online" : ""}`} /></article><article className="panel system-card"><span className="system-item-icon blue"><i className="fa-solid fa-database" /></span><div><small>Database</small><strong>{systemOverview?.databaseStatus || "Checking"}</strong><span>PostgreSQL connection</span></div><span className={`system-indicator ${systemOverview?.databaseStatus === "Connected" ? "online" : ""}`} /></article></section><section className="panel"><div className="panel-heading"><div><span className="panel-eyebrow">OPERATIONS</span><h2>Runtime information</h2><p>Read-only configuration and activity totals.</p></div></div><div className="runtime-grid"><article><span>Session lifetime</span><strong>{systemOverview ? `${Math.round(systemOverview.sessionLifetimeSeconds / 60)} minutes` : "—"}</strong><small>Short-lived administrator access token</small></article><article><span>Active sessions</span><strong>{formatCount(systemOverview?.activeSessions)}</strong><small>Unrevoked and not expired</small></article><article><span>Registered devices</span><strong>{formatCount(systemOverview?.registeredDevices)}</strong><small>Devices seen during sign-in</small></article><article><span>Audit records</span><strong>{formatCount(systemOverview?.auditEntries)}</strong><small>Recorded access and admin events</small></article></div></section><div className="table-footnote"><i className="fa-solid fa-circle-info" /> Security controls are enforced by the backend. This screen reports configuration and service health; it does not change server policy.</div></div>
  );

  const content = activePage === "overview" ? renderOverview() : activePage === "users" ? renderUsers() : activePage === "security" ? renderSecurity() : activePage === "activity" ? renderActivity() : activePage === "vaults" ? renderVaults() : activePage === "account-security" ? <div className="page-stack"><MfaSettingsPanel getStatus={getMfaStatus} startSetup={startTotpSetup} confirmSetup={confirmTotpSetup} disable={disableTotp} /></div> : renderSystem();

  return (
    <div className="admin-shell">
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <aside className={`admin-sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <a className="sidebar-brand" href="#overview" onClick={(event) => { event.preventDefault(); navigate("overview"); }}><span className="admin-brand-mark"><i className="fa-solid fa-shield-halved" /></span><span><strong>SecureVault</strong><small>ADMIN CONSOLE</small></span></a>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Administrator navigation">{NAV_ITEMS.map((item) => <button key={item.id} className={`sidebar-nav-item ${activePage === item.id ? "selected" : ""}`} onClick={() => navigate(item.id)}><i className={item.icon} /><span>{item.label}</span>{item.id === "security" && overview?.securityAlerts > 0 && <b className="sidebar-alert-count">{overview.securityAlerts}</b>}</button>)}</nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-privacy-card"><div className="privacy-card-icon"><i className="fa-solid fa-lock" /></div><strong>Private by design</strong><p>Admin views show activity and totals. Vault secrets stay encrypted.</p><button onClick={() => navigate("vaults")}>Learn about privacy <i className="fa-solid fa-arrow-right" /></button></div>
        <div className="sidebar-user"><span className="sidebar-user-avatar">{initials(admin?.username)}</span><span className="sidebar-user-copy"><strong>{admin?.username || "Administrator"}</strong><small>{admin?.email || "ROLE_ADMIN"}</small></span><button onClick={handleSignOut} aria-label="Sign out" title="Sign out"><i className="fa-solid fa-arrow-right-from-bracket" /></button></div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar"><div className="topbar-leading"><button className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><i className="fa-solid fa-bars" /></button><div className="topbar-breadcrumb"><span>SecureVault</span><i className="fa-solid fa-chevron-right" /><strong>{NAV_ITEMS.find((item) => item.id === activePage)?.label}</strong></div></div><div className="topbar-actions"><form className="quick-search" onSubmit={jumpToUsers}><i className="fa-solid fa-magnifying-glass" /><input value={quickSearch} onChange={(event) => setQuickSearch(event.target.value)} placeholder="Find an account" aria-label="Search accounts" /><kbd>↵</kbd></form><span className="topbar-divider" /><span className="connection-indicator"><i /> API connected</span><button className="refresh-button" onClick={() => setRefreshKey((key) => key + 1)} aria-label="Refresh dashboard" title="Refresh dashboard"><i className={`fa-solid fa-rotate ${summaryLoading ? "fa-spin" : ""}`} /></button></div></header>
        <div className="admin-content"><PageTitle {...pageTitle}><div className="page-title-actions"><span className="date-chip"><i className="fa-regular fa-calendar" /> {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</span>{summaryLoading && <span className="updating-label"><i className="fa-solid fa-circle-notch fa-spin" /> Syncing</span>}</div></PageTitle>{content}</div>
      </main>

      {selectedUser && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedUser(null); }}><section className="user-drawer" role="dialog" aria-modal="true" aria-labelledby="user-drawer-title"><header className="drawer-header"><div><span className="panel-eyebrow">ACCOUNT PROFILE</span><h2 id="user-drawer-title">{selectedUser.name}</h2><p>{selectedUser.email}</p></div><button className="drawer-close" onClick={() => setSelectedUser(null)} aria-label="Close details"><i className="fa-solid fa-xmark" /></button></header>
        {selectedUser.loading ? <div className="drawer-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading account details</div> : <div className="drawer-content"><div className="drawer-identity-row"><span className="drawer-avatar">{initials(selectedUser.name)}</span><div><span className={`account-status ${selectedUser.active ? "active" : "disabled"}`}><i />{selectedUser.active ? "Active account" : "Disabled account"}</span><small>Joined {formatDate(selectedUser.joinDate, "date unavailable")}</small></div><span className={`risk-badge ${riskClass(selectedUser.riskLevel)}`}><i />{titleCase(selectedUser.riskLevel)} {selectedUser.riskScore}</span></div>
          <div className="drawer-quick-stats"><div><small>Active sessions</small><strong>{formatCount(selectedUser.activeSessions)}</strong></div><div><small>Devices</small><strong>{formatCount(selectedUser.registeredDevices)}</strong></div><div><small>MFA</small><strong>{selectedUser.mfaEnabled ? "Enabled" : "Off"}</strong></div></div>
          <section className="drawer-section"><div className="drawer-section-heading"><h3>Risk signals</h3><span>{selectedUser.riskFactors.length}</span></div><ul className="risk-factor-list">{selectedUser.riskFactors.map((factor, index) => <li key={`${index}-${factor}`}><i className="fa-solid fa-circle-exclamation" /><span>{factor}</span></li>)}</ul></section>
          <section className="drawer-section"><div className="drawer-section-heading"><h3>Registered devices</h3><span>{selectedUser.connectedDevices.length}</span></div>{selectedUser.connectedDevices.map((device) => <article className="drawer-device" key={device.id}><span className="device-icon"><i className={device.icon || "fa-solid fa-laptop"} /></span><div><strong>{device.name}</strong><small>{device.ip} · Last active {formatDate(device.lastActive)}</small><span>{device.activeSessions} active session(s){device.trusted ? " · Trusted" : ""}</span></div><button disabled={device.isCurrent || device.activeSessions === 0 || busyAction === device.id} onClick={() => handleRevokeDevice(device)} title={device.isCurrent ? "Current administrator device" : "Revoke this device's sessions"}><i className="fa-solid fa-ban" /></button></article>)}{!selectedUser.connectedDevices.length && <p className="drawer-muted">No device records found.</p>}</section>
          <section className="drawer-section"><div className="drawer-section-heading"><h3>Recent sessions</h3><span>{selectedUser.sessions.length}</span></div><div className="drawer-session-list">{selectedUser.sessions.map((session) => <article key={session.id}><span className={`session-dot ${session.active ? "online" : ""}`} /><div><strong>{session.device}</strong><small>{session.ip} · {formatDate(session.loginTime)}</small></div><span className={`session-state ${session.active ? "active" : ""}`}>{session.status}</span></article>)}{!selectedUser.sessions.length && <p className="drawer-muted">No session history found.</p>}</div></section>
        </div>}</section></div>}

      {userToChange && <div className="dialog-backdrop confirmation-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><span className={`confirm-icon ${userToChange.active ? "danger" : "good"}`}><i className={`fa-solid ${userToChange.active ? "fa-user-slash" : "fa-user-check"}`} /></span><h2 id="confirm-title">{userToChange.active ? "Disable this account?" : "Enable this account?"}</h2><p>{userToChange.active ? `This will block ${userToChange.name} from signing in and revoke all active sessions.` : `This will restore sign-in access for ${userToChange.name}.`}</p><div className="confirm-actions"><button className="button-secondary" onClick={() => setUserToChange(null)}>Cancel</button><button className={userToChange.active ? "button-danger" : "button-primary"} onClick={changeUserStatus} disabled={busyAction === userToChange.id}>{busyAction === userToChange.id ? "Saving…" : userToChange.active ? "Disable account" : "Enable account"}</button></div></section></div>}

      {roleChange && <div className="dialog-backdrop confirmation-backdrop"><form className="confirm-dialog role-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="role-confirm-title" onSubmit={changeUserRole}><span className="confirm-icon good"><i className="fa-solid fa-user-shield" /></span><h2 id="role-confirm-title">Confirm role change</h2><p>Change {roleChange.user.name} from {titleCase(roleValue(roleChange.user).replace("ROLE_", "").replaceAll("_", " "))} to {titleCase(roleChange.role.replace("ROLE_", "").replaceAll("_", " "))}. Enter your administrator password to authorize this action.</p><label className="role-password-field" htmlFor="role-admin-password">Administrator password</label><input id="role-admin-password" type="password" autoComplete="current-password" value={roleChange.currentPassword} onChange={(event) => setRoleChange((current) => ({ ...current, currentPassword: event.target.value }))} required maxLength={72} /><div className="confirm-actions"><button type="button" className="button-secondary" onClick={() => setRoleChange(null)}>Cancel</button><button type="submit" className="button-primary" disabled={busyAction === roleChange.user.id || !roleChange.currentPassword}>{busyAction === roleChange.user.id ? "Verifying…" : "Verify and update role"}</button></div></form></div>}

      {toast && <div className={`admin-toast ${toast.tone}`} role="status"><span><i className={`fa-solid ${toast.tone === "error" ? "fa-circle-exclamation" : toast.tone === "info" ? "fa-circle-info" : "fa-circle-check"}`} /></span><p>{toast.message}</p><button onClick={() => setToast(null)} aria-label="Dismiss"><i className="fa-solid fa-xmark" /></button></div>}
    </div>
  );
}

export default App;
