package com.securevault.admin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AdminService {
    private static final String USER_CTES = "WITH role_list AS ("
            + "SELECT ur.user_id, string_agg(r.role_name, ',' ORDER BY r.role_name) AS roles "
            + "FROM user_roles ur JOIN roles r ON r.id = ur.role_id GROUP BY ur.user_id), "
            + "risk_summary AS (SELECT user_id, MAX(risk_score) AS risk_score, "
            + "(ARRAY_AGG(UPPER(severity) ORDER BY CASE UPPER(severity) "
            + "WHEN 'CRITICAL' THEN 4 WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC, "
            + "risk_score DESC, timestamp DESC))[1] AS risk_level "
            + "FROM security_events WHERE is_resolved = FALSE GROUP BY user_id) ";

    private static final String USER_SELECT = "SELECT u.id, u.username, u.email, u.is_active, u.created_at, "
            + "u.mfa_enabled, COALESCE(role_list.roles, 'ROLE_USER') AS roles, "
            + "COALESCE(risk_summary.risk_score, 0) AS risk_score, "
            + "COALESCE(risk_summary.risk_level, 'LOW') AS risk_level, "
            + "(SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.is_revoked = FALSE "
            + "AND s.expires_at > CURRENT_TIMESTAMP) AS active_sessions, "
            + "(SELECT COUNT(*) FROM devices d WHERE d.user_id = u.id) AS registered_devices, "
            + "(SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_activity, "
            + "(SELECT d.device_name FROM sessions s LEFT JOIN devices d ON d.id = s.device_id "
            + "WHERE s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1) AS last_device "
            + "FROM users u LEFT JOIN role_list ON role_list.user_id = u.id "
            + "LEFT JOIN risk_summary ON risk_summary.user_id = u.id ";

    private static final String RELATED_EVENT_COUNT = "(CASE "
            + "WHEN e.event_type = 'MULTIPLE_FAILED_LOGINS' THEN (SELECT COUNT(*) FROM security_events r "
            + "WHERE r.event_type = 'FAILED_LOGIN' AND r.user_id IS NOT DISTINCT FROM e.user_id "
            + "AND r.ip_address IS NOT DISTINCT FROM e.ip_address AND r.timestamp BETWEEN e.timestamp - INTERVAL '10 minutes' AND e.timestamp) "
            + "WHEN e.event_type = 'REPEATED_ACCESS_DENIED' THEN (SELECT COUNT(*) FROM security_events r "
            + "WHERE r.event_type = 'ACCESS_DENIED' AND r.ip_address = e.ip_address "
            + "AND r.timestamp BETWEEN e.timestamp - INTERVAL '5 minutes' AND e.timestamp) "
            + "WHEN e.event_type = 'SUSPICIOUS_VAULT_ACCESS' THEN (SELECT COUNT(*) FROM audit_logs l "
            + "WHERE l.user_id IS NOT DISTINCT FROM e.user_id AND l.ip_address = e.ip_address "
            + "AND l.status = 'SUCCESS' AND (l.action_type ILIKE 'VAULT_%' OR l.action_type ILIKE 'CREDENTIAL_%') "
            + "AND l.timestamp BETWEEN e.timestamp - INTERVAL '5 minutes' AND e.timestamp) "
            + "WHEN e.event_type IN ('NEW_DEVICE_LOGIN','NEW_IP_LOGIN','UNUSUAL_LOGIN_TIME') THEN (SELECT COUNT(*) FROM audit_logs l "
            + "WHERE l.user_id = e.user_id AND l.ip_address = e.ip_address AND l.action_type = 'LOGIN' "
            + "AND l.status = 'SUCCESS' AND l.timestamp BETWEEN e.timestamp - INTERVAL '10 minutes' AND e.timestamp) "
            + "WHEN e.event_type = 'CREDENTIAL_SHARED' THEN (SELECT COUNT(*) FROM audit_logs l "
            + "WHERE l.user_id IS NOT DISTINCT FROM e.user_id AND l.ip_address IS NOT DISTINCT FROM e.ip_address "
            + "AND l.action_type ILIKE 'CREDENTIAL_SHARE%' AND l.status = 'SUCCESS' "
            + "AND l.timestamp BETWEEN e.timestamp - INTERVAL '1 minute' AND e.timestamp + INTERVAL '1 minute') "
            + "ELSE (SELECT COUNT(*) FROM security_events r WHERE r.id <> e.id "
            + "AND r.user_id IS NOT DISTINCT FROM e.user_id AND r.ip_address IS NOT DISTINCT FROM e.ip_address "
            + "AND r.event_type = e.event_type AND r.timestamp BETWEEN e.timestamp - INTERVAL '10 minutes' AND e.timestamp + INTERVAL '10 minutes') "
            + "END) AS related_event_count ";

    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final int sessionLifetimeSeconds;
    private final int failedLoginAlertThreshold;
    private final int failedLoginWindowMinutes;

    public AdminService(JdbcTemplate jdbcTemplate,
                        @Value("${security.jwt.expiration-seconds:900}") int sessionLifetimeSeconds) {
        this(jdbcTemplate, sessionLifetimeSeconds, 4, 5);
    }

    @Autowired
    public AdminService(JdbcTemplate jdbcTemplate,
                        @Value("${security.jwt.expiration-seconds:900}") int sessionLifetimeSeconds,
                        @Value("${security.threat.failed-login.threshold:4}") int failedLoginAlertThreshold,
                        @Value("${security.threat.failed-login.window-minutes:5}") int failedLoginWindowMinutes) {
        this.jdbcTemplate = jdbcTemplate;
        this.sessionLifetimeSeconds = sessionLifetimeSeconds;
        this.failedLoginAlertThreshold = failedLoginAlertThreshold;
        this.failedLoginWindowMinutes = failedLoginWindowMinutes;
    }

    public AdminIdentity identity(AdminPrincipal principal) {
        return new AdminIdentity(principal.userId(), principal.username(), principal.email(),
                "ROLE_ADMIN", principal.sessionId());
    }

    public DashboardOverview dashboard() {
        long totalUsers = count("SELECT COUNT(*) FROM users");
        long credentials = count("SELECT COUNT(*) FROM credentials");
        long activeSessions = count("SELECT COUNT(*) FROM sessions WHERE is_revoked = FALSE "
                + "AND expires_at > CURRENT_TIMESTAMP");
        long openAlerts = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE");
        int securityScore = securityScore();
        PageData<ActivityRow> recent = activities("", 0, 5);
        return new DashboardOverview(totalUsers, credentials, activeSessions, openAlerts,
                count("SELECT COUNT(*) FROM vaults"), count("SELECT COUNT(*) FROM devices"),
                securityScore, recent.items());
    }

    public UserStats userStats() {
        return new UserStats(
                count("SELECT COUNT(*) FROM users"),
                count("SELECT COUNT(*) FROM user_roles ur JOIN roles r ON r.id = ur.role_id "
                        + "WHERE r.role_name = 'ROLE_ADMIN'"),
                count("SELECT COUNT(DISTINCT user_id) FROM security_events WHERE is_resolved = FALSE "
                        + "AND UPPER(severity) = 'CRITICAL' AND user_id IS NOT NULL"),
                count("SELECT COUNT(DISTINCT user_id) FROM security_events WHERE is_resolved = FALSE "
                        + "AND UPPER(severity) = 'HIGH' AND user_id IS NOT NULL"),
                count("SELECT COUNT(*) FROM devices"),
                count("SELECT COUNT(*) FROM sessions WHERE is_revoked = FALSE "
                        + "AND expires_at > CURRENT_TIMESTAMP"));
    }

    public PageData<UserSummary> users(String requestedSearch, String requestedRisk, int page, int size) {
        String search = safeSearch(requestedSearch);
        String risk = requestedRisk == null ? "ALL" : requestedRisk.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL").contains(risk)) {
            risk = "ALL";
        }
        int safePage = Math.min(Math.max(page, 0), 100_000);
        int safeSize = Math.max(1, Math.min(size, 100));
        int offset = safePage * safeSize;
        String like = "%" + search + "%";
        String sql = USER_CTES + USER_SELECT
                + "WHERE (? = '' OR u.username ILIKE ? OR u.email ILIKE ? OR COALESCE(role_list.roles, '') ILIKE ?) "
                + "AND (? = 'ALL' OR COALESCE(risk_summary.risk_level, 'LOW') = ?) "
                + "ORDER BY u.created_at DESC, u.id LIMIT ? OFFSET ?";
        List<UserSummary> items = jdbcTemplate.query(sql, this::mapUserSummary,
                search, like, like, like, risk, risk, safeSize, offset);
        long total = countFilteredUsers(search, like, risk);
        return new PageData<>(items, safePage, safeSize, total);
    }

    public UserDetails user(UUID userId, AdminPrincipal principal) {
        UserSummary summary;
        try {
            summary = jdbcTemplate.queryForObject(USER_CTES + USER_SELECT + "WHERE u.id = ?",
                    this::mapUserSummary, userId);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
        }

        List<String> riskFactors = jdbcTemplate.query(
                "SELECT event_type, severity, risk_score, ip_address, timestamp FROM security_events "
                        + "WHERE user_id = ? ORDER BY is_resolved ASC, timestamp DESC LIMIT 8",
                (result, row) -> {
                    String ip = result.getString("ip_address");
                    return result.getString("event_type").replace('_', ' ')
                            + " · " + result.getString("severity") + " (risk " + result.getInt("risk_score") + ")"
                            + (ip == null ? "" : " · IP " + ip)
                            + " · " + instant(result, "timestamp");
                }, userId);
        if (riskFactors.isEmpty()) {
            riskFactors = List.of("No security events have been recorded for this account.");
        }

        List<DeviceView> devices = jdbcTemplate.query(
                "SELECT d.id, d.device_name, d.is_trusted, d.last_active, d.created_at, "
                        + "(SELECT COUNT(*) FROM sessions s WHERE s.device_id = d.id AND s.is_revoked = FALSE "
                        + "AND s.expires_at > CURRENT_TIMESTAMP) AS active_sessions, "
                        + "(SELECT s.ip_address FROM sessions s WHERE s.device_id = d.id "
                        + "ORDER BY s.created_at DESC LIMIT 1) AS last_ip, "
                        + "EXISTS (SELECT 1 FROM sessions s WHERE s.id = ? AND s.device_id = d.id) AS is_current "
                        + "FROM devices d WHERE d.user_id = ? ORDER BY d.last_active DESC",
                (result, row) -> new DeviceView(
                        result.getObject("id", UUID.class),
                        result.getString("device_name"),
                        "Not captured", "Not captured",
                        result.getString("last_ip") == null ? "Not recorded" : result.getString("last_ip"),
                        "Not captured", "Browser", "fa-solid fa-laptop",
                        result.getBoolean("is_current"), instant(result, "last_active"),
                        instant(result, "created_at"),
                        summary.riskLevel().equals("HIGH") || summary.riskLevel().equals("CRITICAL"),
                        result.getInt("active_sessions"), result.getBoolean("is_trusted")),
                principal.sessionId(), userId);

        List<SessionView> sessions = jdbcTemplate.query(
                "SELECT id, ip_address, user_agent, is_revoked, expires_at, created_at, "
                        + "(is_revoked = FALSE AND expires_at > CURRENT_TIMESTAMP) AS is_active "
                        + "FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
                (result, row) -> {
                    Instant createdAt = instant(result, "created_at");
                    Instant expiresAt = instant(result, "expires_at");
                    boolean active = result.getBoolean("is_active");
                    boolean revoked = result.getBoolean("is_revoked");
                    String status = active ? "Active" : revoked ? "Revoked" : "Expired";
                    String logout = active ? "Active Session" : status;
                    return new SessionView(
                            result.getObject("id", UUID.class),
                            deviceLabel(result.getString("user_agent")),
                            result.getString("ip_address"), createdAt, expiresAt,
                            logout, status, active);
                }, userId);

        return new UserDetails(summary, riskFactors, devices, sessions);
    }

    @Transactional
    public void setUserActive(UUID targetId, boolean active, AdminPrincipal actor, String ipAddress) {
        UserSummary target;
        try {
            target = jdbcTemplate.queryForObject(USER_CTES + USER_SELECT + "WHERE u.id = ?",
                    this::mapUserSummary, targetId);
        } catch (EmptyResultDataAccessException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
        }
        if (target.roles().contains("ROLE_ADMIN")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Administrator accounts are protected from status changes.");
        }
        if (!active && actor.userId().equals(targetId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You cannot disable the administrator account used by this session.");
        }
        if (target.active() == active) {
            return;
        }

        jdbcTemplate.update("UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                active, targetId);
        if (!active) {
            jdbcTemplate.update("UPDATE sessions SET is_revoked = TRUE WHERE user_id = ? AND is_revoked = FALSE",
                    targetId);
        }
        writeAudit(actor.userId(), active ? "USER_ENABLED" : "USER_DISABLED", ipAddress,
                "Target account " + targetId);
    }

    @Transactional
    public UserSummary setUserRole(UUID targetId, String requestedRole, String adminPassword,
                                   AdminPrincipal actor, String ipAddress) {
        String role = requestedRole == null ? "" : requestedRole.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ROLE_USER", "ROLE_TEAM_MEMBER", "ROLE_ADMIN").contains(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a supported account role.");
        }

        List<String> currentRoles = jdbcTemplate.query(
                "SELECT r.role_name FROM user_roles ur JOIN roles r ON r.id = ur.role_id "
                        + "WHERE ur.user_id = ? ORDER BY r.role_name",
                (result, row) -> result.getString("role_name"), targetId);
        if (currentRoles.isEmpty()) {
            Integer exists = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM users WHERE id = ?", Integer.class, targetId);
            if (exists == null || exists == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User was not found.");
            }
        }
        String[] targetIdentity = jdbcTemplate.queryForObject(
                "SELECT username, email FROM users WHERE id = ?",
                (result, row) -> new String[] { result.getString("username"), result.getString("email") }, targetId);

        if (actor.userId().equals(targetId) && !"ROLE_ADMIN".equals(role)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You cannot remove administrator access from your own account.");
        }
        if (currentRoles.contains("ROLE_ADMIN") && !"ROLE_ADMIN".equals(role)) {
            Integer otherActiveAdmins = jdbcTemplate.queryForObject(
                    "SELECT COUNT(DISTINCT u.id) FROM users u JOIN user_roles ur ON ur.user_id = u.id "
                            + "JOIN roles r ON r.id = ur.role_id WHERE r.role_name = 'ROLE_ADMIN' "
                            + "AND u.is_active = TRUE AND u.id <> ?",
                    Integer.class, targetId);
            if (otherActiveAdmins == null || otherActiveAdmins == 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "At least one other active administrator must remain.");
            }
        }

        if (currentRoles.size() == 1 && currentRoles.contains(role)) {
            return jdbcTemplate.queryForObject(USER_CTES + USER_SELECT + "WHERE u.id = ?",
                    this::mapUserSummary, targetId);
        }

        String actorPasswordHash = jdbcTemplate.queryForObject(
                "SELECT password_hash FROM users WHERE id = ? AND is_active = TRUE FOR UPDATE",
                String.class, actor.userId());
        if (adminPassword == null || adminPassword.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72
                || !passwordEncoder.matches(adminPassword, actorPasswordHash)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Administrator password could not be verified. The role was not changed.");
        }

        if (currentRoles.size() != 1 || !currentRoles.contains(role)) {
            Integer roleId = jdbcTemplate.queryForObject(
                    "SELECT id FROM roles WHERE role_name = ?", Integer.class, role);
            if (roleId == null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "The selected role is not available in the database.");
            }
            jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", targetId);
            jdbcTemplate.update("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", targetId, roleId);
            writeAudit(actor.userId(), "USER_ROLE_CHANGED", ipAddress,
                    "Admin " + actor.username() + " (" + actor.email() + ") changed account "
                            + targetId + " (" + targetIdentity[0] + ", " + targetIdentity[1] + ") from "
                            + String.join(",", currentRoles)
                            + " to " + role);
        }

        return jdbcTemplate.queryForObject(USER_CTES + USER_SELECT + "WHERE u.id = ?",
                this::mapUserSummary, targetId);
    }

    @Transactional
    public void revokeDevice(UUID targetUserId, UUID deviceId, AdminPrincipal actor, String ipAddress) {
        Integer ownerMatches = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM devices WHERE id = ? AND user_id = ?", Integer.class, deviceId, targetUserId);
        if (ownerMatches == null || ownerMatches == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Device was not found for this user.");
        }
        if (targetUserId.equals(actor.userId()) && deviceId.equals(actor.deviceId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "The device used by your current administrator session cannot be revoked here.");
        }
        jdbcTemplate.update("UPDATE sessions SET is_revoked = TRUE WHERE user_id = ? AND device_id = ? "
                        + "AND is_revoked = FALSE",
                targetUserId, deviceId);
        jdbcTemplate.update("UPDATE devices SET is_trusted = FALSE WHERE id = ? AND user_id = ?",
                deviceId, targetUserId);
        writeAudit(actor.userId(), "DEVICE_REVOKED", ipAddress,
                "Device " + deviceId + " for account " + targetUserId);
    }

    public PageData<ActivityRow> activities(String requestedSearch, int page, int size) {
        String search = safeSearch(requestedSearch);
        String like = "%" + search + "%";
        int safePage = Math.min(Math.max(page, 0), 100_000);
        int safeSize = Math.max(1, Math.min(size, 100));
        int offset = safePage * safeSize;
        String from = " FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id "
                + "WHERE (? = '' OR COALESCE(u.username, 'system') ILIKE ? "
                + "OR COALESCE(u.email, '') ILIKE ? OR l.action_type ILIKE ?) ";
        long total = jdbcTemplate.queryForObject("SELECT COUNT(*)" + from,
                Long.class, search, like, like, like);
        List<ActivityRow> items = jdbcTemplate.query(
                "SELECT l.id, COALESCE(u.username, 'System') AS username, COALESCE(u.email, '') AS email, "
                        + "l.action_type, l.status, l.ip_address, l.details, l.timestamp " + from
                        + "ORDER BY l.timestamp DESC LIMIT ? OFFSET ?",
                (result, row) -> new ActivityRow(
                        result.getObject("id", UUID.class),
                        result.getString("username"),
                        result.getString("email"),
                        displayAction(result.getString("action_type")),
                        "IP " + result.getString("ip_address"),
                        instant(result, "timestamp"),
                        "SUCCESS".equalsIgnoreCase(result.getString("status")) ? "Success" : "Review",
                        initials(result.getString("username")), result.getString("details")),
                search, like, like, like, safeSize, offset);
        return new PageData<>(items, safePage, safeSize, total);
    }

    public VaultOverview vaultOverview() {
        return new VaultOverview(
                count("SELECT COUNT(*) FROM vaults"),
                count("SELECT COUNT(*) FROM credentials"),
                count("SELECT COUNT(DISTINCT owner_id) FROM vaults"));
    }

    public AnalyticsOverview analytics() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        return analytics(today.minusDays(6), today, "", "ALL", "ALL", 0, 10, "NEWEST");
    }

    public AnalyticsOverview analytics(LocalDate fromDate, LocalDate toDate, String requestedSearch,
            String requestedSeverity, String requestedStatus, int page, int size, String requestedSort) {
        if (fromDate == null || toDate == null || fromDate.isAfter(toDate)
                || fromDate.isBefore(toDate.minusDays(365))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Choose a valid date range of no more than 366 days.");
        }
        String search = safeSearch(requestedSearch);
        String severity = normalizedFilter(requestedSeverity, List.of("ALL", "LOW", "MEDIUM", "HIGH", "CRITICAL"));
        String status = normalizedFilter(requestedStatus,
                List.of("ALL", "OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE"));
        String sort = "OLDEST".equalsIgnoreCase(requestedSort) ? "ASC" : "DESC";
        int safePage = Math.min(Math.max(page, 0), 100_000);
        int safeSize = Math.max(1, Math.min(size, 100));
        int offset = safePage * safeSize;
        String like = "%" + search + "%";

        Map<LocalDate, DailyMetric> grouped = new HashMap<>();
        jdbcTemplate.query(
                "SELECT (timestamp AT TIME ZONE 'UTC')::date AS event_date, COUNT(*) AS total, "
                        + "COUNT(*) FILTER (WHERE UPPER(severity) = 'CRITICAL') AS critical, "
                        + "COUNT(*) FILTER (WHERE UPPER(severity) = 'HIGH') AS high, "
                        + "COUNT(*) FILTER (WHERE UPPER(severity) = 'MEDIUM') AS medium, "
                        + "COUNT(*) FILTER (WHERE UPPER(severity) = 'LOW') AS low "
                        + "FROM security_events WHERE timestamp >= ?::date AND timestamp < (?::date + INTERVAL '1 day') "
                        + "GROUP BY event_date ORDER BY event_date",
                result -> {
                    LocalDate date = result.getObject("event_date", LocalDate.class);
                    grouped.put(date, new DailyMetric(date, result.getLong("total"),
                            result.getLong("critical"), result.getLong("high"),
                            result.getLong("medium"), result.getLong("low")));
                }, java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        List<DailyMetric> days = new ArrayList<>();
        for (LocalDate date = fromDate; !date.isAfter(toDate); date = date.plusDays(1)) {
            days.add(grouped.getOrDefault(date, new DailyMetric(date, 0, 0, 0, 0, 0)));
        }
        String eventFilters = " FROM security_events e LEFT JOIN users u ON u.id = e.user_id "
                + "WHERE e.timestamp >= ?::date AND e.timestamp < (?::date + INTERVAL '1 day') "
                + "AND (? = '' OR e.event_type ILIKE ? OR COALESCE(e.alert_title, '') ILIKE ? "
                + "OR COALESCE(e.detection_reason, '') ILIKE ? OR COALESCE(u.username, '') ILIKE ? "
                + "OR COALESCE(u.email, '') ILIKE ? OR COALESCE(e.ip_address, '') ILIKE ?) "
                + "AND (? = 'ALL' OR UPPER(e.severity) = ?) AND (? = 'ALL' OR UPPER(e.status) = ?) ";
        List<SecurityEventRow> events = jdbcTemplate.query(
                "SELECT e.id, e.event_type, COALESCE(e.alert_title, INITCAP(REPLACE(e.event_type, '_', ' '))) AS alert_title, "
                        + "COALESCE(e.detection_reason, 'Detected by rule ' || e.event_type) AS detection_reason, "
                        + "e.severity, e.risk_score, e.anomaly_detected, e.is_resolved, e.status, e.ip_address, e.timestamp, "
                        + "COALESCE(u.username, 'Unknown account') AS username, COALESCE(u.email, '') AS email, "
                        + RELATED_EVENT_COUNT + eventFilters
                        + "ORDER BY e.timestamp " + sort + ", e.id " + sort + " LIMIT ? OFFSET ?",
                (result, row) -> new SecurityEventRow(
                        result.getObject("id", UUID.class), result.getString("username"), result.getString("email"),
                        result.getString("event_type"), result.getString("alert_title"), result.getString("detection_reason"),
                        result.getString("severity"), result.getInt("risk_score"), result.getBoolean("anomaly_detected"),
                        result.getBoolean("is_resolved"), result.getString("status"), result.getString("ip_address"),
                        instant(result, "timestamp"), result.getLong("related_event_count")),
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate), search, like, like, like, like, like, like,
                severity, severity, status, status, safeSize, offset);
        long eventTotal = queryCount("SELECT COUNT(*)" + eventFilters,
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate), search, like, like, like, like, like,
                like, severity, severity, status, status);
        long totalAlerts = queryCount("SELECT COUNT(*) FROM security_events WHERE timestamp >= ?::date "
                        + "AND timestamp < (?::date + INTERVAL '1 day')", java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        long highSeverity = queryCount("SELECT COUNT(*) FROM security_events WHERE timestamp >= ?::date "
                        + "AND timestamp < (?::date + INTERVAL '1 day') AND UPPER(severity) IN ('HIGH','CRITICAL')",
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        long failedLogins = queryCount("SELECT COUNT(*) FROM audit_logs WHERE action_type = 'LOGIN_FAILURE' "
                        + "AND status = 'FAILURE' AND timestamp >= ?::date AND timestamp < (?::date + INTERVAL '1 day')",
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        long openInvestigations = queryCount("SELECT COUNT(*) FROM security_events WHERE timestamp >= ?::date "
                        + "AND timestamp < (?::date + INTERVAL '1 day') AND UPPER(status) IN ('OPEN','INVESTIGATING')",
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        long suspiciousActivities = queryCount("SELECT COUNT(*) FROM security_events WHERE timestamp >= ?::date "
                        + "AND timestamp < (?::date + INTERVAL '1 day') AND anomaly_detected = TRUE",
                java.sql.Date.valueOf(fromDate), java.sql.Date.valueOf(toDate));
        long unresolved = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE");
        long critical = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE AND UPPER(severity) = 'CRITICAL'");
        long high = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE AND UPPER(severity) = 'HIGH'");
        long medium = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE AND UPPER(severity) = 'MEDIUM'");
        long low = count("SELECT COUNT(*) FROM security_events WHERE is_resolved = FALSE AND UPPER(severity) = 'LOW'");
        LoginMonitoring loginMonitoring = loginMonitoring();
        PasswordHealthSummary passwordHealth = passwordHealthSummary();
        VaultMonitoring vaultMonitoring = vaultMonitoring();
        List<ActivityRow> recentAuthentication = recentAuthenticationEvents(12);
        SecuritySummary summary = new SecuritySummary(totalAlerts, highSeverity, failedLogins,
                openInvestigations, suspiciousActivities);
        return new AnalyticsOverview(days, events, eventTotal, safePage, safeSize, summary,
                unresolved, critical, high, medium, low, securityScore(), loginMonitoring,
                passwordHealth, vaultMonitoring, recentAuthentication,
                new ThreatRuleConfiguration(failedLoginAlertThreshold, failedLoginWindowMinutes,
                        failedLoginAlertThreshold + 2));
    }

    public SecurityEventDetails securityEvent(UUID eventId) {
        SecurityEventRow event = jdbcTemplate.queryForObject(
                "SELECT e.id, e.event_type, COALESCE(e.alert_title, INITCAP(REPLACE(e.event_type, '_', ' '))) AS alert_title, "
                        + "COALESCE(e.detection_reason, 'Detected by rule ' || e.event_type) AS detection_reason, "
                        + "e.severity, e.risk_score, e.anomaly_detected, e.is_resolved, e.status, e.ip_address, e.timestamp, "
                        + "COALESCE(u.username, 'Unknown account') AS username, COALESCE(u.email, '') AS email, "
                        + RELATED_EVENT_COUNT
                        + "FROM security_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.id = ?",
                (result, row) -> new SecurityEventRow(result.getObject("id", UUID.class),
                        result.getString("username"), result.getString("email"), result.getString("event_type"),
                        result.getString("alert_title"), result.getString("detection_reason"), result.getString("severity"),
                        result.getInt("risk_score"), result.getBoolean("anomaly_detected"), result.getBoolean("is_resolved"),
                        result.getString("status"), result.getString("ip_address"), instant(result, "timestamp"),
                        result.getLong("related_event_count")), eventId);
        List<RelatedSecurityActivity> related = jdbcTemplate.query(
                "SELECT id, action_type, status, ip_address, details, timestamp FROM audit_logs "
                        + "WHERE (user_id = (SELECT user_id FROM security_events WHERE id = ?) OR "
                        + "(user_id IS NULL AND ip_address = (SELECT ip_address FROM security_events WHERE id = ?))) "
                        + "AND timestamp BETWEEN (SELECT timestamp - INTERVAL '10 minutes' FROM security_events WHERE id = ?) "
                        + "AND (SELECT timestamp + INTERVAL '10 minutes' FROM security_events WHERE id = ?) "
                        + "UNION ALL SELECT r.id, r.event_type AS action_type, UPPER(r.severity) AS status, r.ip_address, "
                        + "COALESCE(r.detection_reason, r.alert_title, r.event_type) AS details, r.timestamp "
                        + "FROM security_events r WHERE r.id <> ? AND (r.user_id = (SELECT user_id FROM security_events WHERE id = ?) "
                        + "OR (r.user_id IS NULL AND r.ip_address = (SELECT ip_address FROM security_events WHERE id = ?))) "
                        + "AND r.timestamp BETWEEN (SELECT timestamp - INTERVAL '10 minutes' FROM security_events WHERE id = ?) "
                        + "AND (SELECT timestamp + INTERVAL '10 minutes' FROM security_events WHERE id = ?) "
                        + "ORDER BY timestamp DESC LIMIT 100",
                (result, row) -> new RelatedSecurityActivity(result.getObject("id", UUID.class),
                        result.getString("action_type"), result.getString("status"), result.getString("ip_address"),
                        result.getString("details"), instant(result, "timestamp")),
                eventId, eventId, eventId, eventId, eventId, eventId, eventId, eventId, eventId);
        List<InvestigationAction> history = jdbcTemplate.query(
                "SELECT h.previous_status, h.new_status, h.notes, h.created_at, COALESCE(u.username, 'System') AS reviewer "
                        + "FROM security_event_history h LEFT JOIN users u ON u.id = h.reviewer_id "
                        + "WHERE h.event_id = ? ORDER BY h.created_at DESC LIMIT 100",
                (result, row) -> new InvestigationAction(result.getString("previous_status"),
                        result.getString("new_status"), result.getString("notes"), result.getString("reviewer"),
                        instant(result, "created_at")), eventId);
        return new SecurityEventDetails(event, related, history);
    }

    @Transactional
    public void resolveSecurityEvent(UUID eventId, AdminPrincipal actor, String ipAddress) {
        updateSecurityEventStatus(eventId, "RESOLVED", "", actor, ipAddress);
    }

    @Transactional
    public void updateSecurityEventStatus(UUID eventId, String requestedStatus,
                                          String requestedNotes, AdminPrincipal actor, String ipAddress) {
        String status = requestedStatus == null ? "" : requestedStatus.trim().toUpperCase(Locale.ROOT);
        if (!List.of("OPEN", "INVESTIGATING", "RESOLVED", "FALSE_POSITIVE").contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported threat status.");
        }
        String notes = requestedNotes == null ? "" : requestedNotes.trim();
        if (notes.length() > 1000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Notes must be 1000 characters or fewer.");
        String previous = jdbcTemplate.query("SELECT status FROM security_events WHERE id = ?",
                rs -> rs.next() ? rs.getString(1) : null, eventId);
        if (previous == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Security event was not found.");
        jdbcTemplate.update("UPDATE security_events SET status = ?, is_resolved = ?, resolution_notes = NULLIF(?, ''), "
                        + "reviewed_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                status, List.of("RESOLVED", "FALSE_POSITIVE").contains(status), notes, actor.userId(), eventId);
        jdbcTemplate.update("INSERT INTO security_event_history (event_id, reviewer_id, previous_status, new_status, notes) "
                        + "VALUES (?, ?, ?, ?, NULLIF(?, ''))", eventId, actor.userId(), previous, status, notes);
        writeAudit(actor.userId(), "SECURITY_EVENT_STATUS_CHANGED", ipAddress,
                "Security event " + eventId + " set to " + status + (notes.isEmpty() ? "" : " with investigation note"));
    }

    public SystemOverview settings() {
        jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        return new SystemOverview("Operational", "Connected",
                count("SELECT COUNT(*) FROM audit_logs"),
                count("SELECT COUNT(*) FROM devices"),
                count("SELECT COUNT(*) FROM sessions WHERE is_revoked = FALSE "
                        + "AND expires_at > CURRENT_TIMESTAMP"),
                sessionLifetimeSeconds);
    }

    private LoginMonitoring loginMonitoring() {
        long successful24h = count("SELECT COUNT(*) FROM audit_logs WHERE action_type = 'LOGIN' "
                + "AND status = 'SUCCESS' AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'");
        long failed24h = count("SELECT COUNT(*) FROM audit_logs WHERE action_type = 'LOGIN_FAILURE' "
                + "AND status = 'FAILURE' AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours'");
        long uniqueIps7d = count("SELECT COUNT(DISTINCT ip_address) FROM audit_logs "
                + "WHERE action_type IN ('LOGIN', 'LOGIN_FAILURE') AND ip_address <> 'unknown' "
                + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'");
        long newDevices30d = count("SELECT COUNT(*) FROM security_events WHERE event_type = 'NEW_DEVICE_LOGIN' "
                + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        long unusualHours30d = count("SELECT COUNT(*) FROM security_events WHERE event_type = 'UNUSUAL_LOGIN_TIME' "
                + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        long repeatedFailures30d = count("SELECT COUNT(*) FROM security_events WHERE event_type = 'MULTIPLE_FAILED_LOGINS' "
                + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        return new LoginMonitoring(successful24h, failed24h, uniqueIps7d,
                newDevices30d, unusualHours30d, repeatedFailures30d);
    }

    private PasswordHealthSummary passwordHealthSummary() {
        long totalUsers = count("SELECT COUNT(*) FROM users");
        long assessedUsers = count("SELECT COUNT(*) FROM password_health "
                + "WHERE last_calculated >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        long weakFromHealth = count("SELECT COALESCE(SUM(weak_passwords_count), 0) FROM password_health "
                + "WHERE last_calculated >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        long weakFromCredentialScores = count("SELECT COUNT(*) FROM credentials "
                + "WHERE strength_score IS NOT NULL AND strength_score < 40 "
                + "AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'");
        long reused = count("SELECT COALESCE(SUM(reused_passwords_count), 0) FROM password_health "
                + "WHERE last_calculated >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        long compromised = count("SELECT COALESCE(SUM(compromised_count), 0) FROM password_health "
                + "WHERE last_calculated >= CURRENT_TIMESTAMP - INTERVAL '30 days'");
        Double average = jdbcTemplate.queryForObject(
                "SELECT AVG(strength_score)::double precision FROM credentials WHERE strength_score IS NOT NULL "
                        + "AND updated_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'",
                Double.class);
        return new PasswordHealthSummary(assessedUsers, totalUsers,
                Math.max(weakFromHealth, weakFromCredentialScores), reused, compromised,
                average == null ? null : Math.round(average));
    }

    private VaultMonitoring vaultMonitoring() {
        long trackedEvents = count("SELECT COUNT(*) FROM audit_logs WHERE action_type ILIKE 'VAULT_%' "
                + "OR action_type ILIKE 'CREDENTIAL_%'");
        long suspiciousAlerts = count("SELECT COUNT(*) FROM security_events WHERE event_type = 'SUSPICIOUS_VAULT_ACCESS' "
                + "AND is_resolved = FALSE");
        return new VaultMonitoring(trackedEvents, suspiciousAlerts, trackedEvents > 0);
    }

    private List<ActivityRow> recentAuthenticationEvents(int limit) {
        return jdbcTemplate.query(
                "SELECT l.id, COALESCE(u.username, 'Unknown account') AS username, "
                        + "COALESCE(u.email, '') AS email, l.action_type, l.status, l.ip_address, l.details, l.timestamp "
                        + "FROM audit_logs l LEFT JOIN users u ON u.id = l.user_id "
                        + "WHERE l.action_type IN ('LOGIN', 'LOGIN_FAILURE') "
                        + "ORDER BY l.timestamp DESC LIMIT ?",
                (result, row) -> new ActivityRow(
                        result.getObject("id", UUID.class), result.getString("username"),
                        result.getString("email"), displayAction(result.getString("action_type")),
                        "IP " + result.getString("ip_address"), instant(result, "timestamp"),
                        "SUCCESS".equalsIgnoreCase(result.getString("status")) ? "Success" : "Failure",
                        initials(result.getString("username")), result.getString("details")), limit);
    }

    private int securityScore() {
        long weightedEvents = count("SELECT COALESCE(SUM(CASE UPPER(severity) "
                + "WHEN 'CRITICAL' THEN 30 WHEN 'HIGH' THEN 18 WHEN 'MEDIUM' THEN 8 ELSE 2 END), 0) "
                + "FROM security_events WHERE is_resolved = FALSE");
        PasswordHealthSummary health = passwordHealthSummary();
        long passwordPenalty = Math.min(25, health.weakPasswords() * 2)
                + Math.min(20, health.reusedPasswords() * 5)
                + Math.min(30, health.compromisedPasswords() * 10);
        long coveragePenalty = health.totalUsers() == 0 ? 0
                : 10 * Math.max(0, health.totalUsers() - health.assessedUsers()) / health.totalUsers();
        long totalVaults = count("SELECT COUNT(*) FROM vaults");
        if (totalVaults > 0 && count("SELECT COUNT(*) FROM audit_logs WHERE action_type ILIKE 'VAULT_%' "
                + "OR action_type ILIKE 'CREDENTIAL_%'") == 0) {
            coveragePenalty += 10;
        }
        return (int) Math.max(0,
                100 - Math.min(100, weightedEvents + passwordPenalty + coveragePenalty));
    }

    private long count(String sql) {
        Long count = jdbcTemplate.queryForObject(sql, Long.class);
        return count == null ? 0 : count;
    }

    private long queryCount(String sql, Object... parameters) {
        Long result = jdbcTemplate.queryForObject(sql, Long.class, parameters);
        return result == null ? 0 : result;
    }

    private String normalizedFilter(String requested, List<String> allowed) {
        String value = requested == null ? "ALL" : requested.trim().toUpperCase(Locale.ROOT);
        return allowed.contains(value) ? value : "ALL";
    }

    private long countFilteredUsers(String search, String like, String risk) {
        String sql = USER_CTES + "SELECT COUNT(*) FROM users u LEFT JOIN role_list ON role_list.user_id = u.id "
                + "LEFT JOIN risk_summary ON risk_summary.user_id = u.id "
                + "WHERE (? = '' OR u.username ILIKE ? OR u.email ILIKE ? OR COALESCE(role_list.roles, '') ILIKE ?) "
                + "AND (? = 'ALL' OR COALESCE(risk_summary.risk_level, 'LOW') = ?)";
        Long total = jdbcTemplate.queryForObject(sql, Long.class,
                search, like, like, like, risk, risk);
        return total == null ? 0 : total;
    }

    private UserSummary mapUserSummary(ResultSet result, int row) throws SQLException {
        String[] roleArray = result.getString("roles").split(",");
        List<String> roles = Arrays.stream(roleArray).filter(value -> !value.isBlank()).toList();
        if (roles.isEmpty()) {
            roles = List.of("ROLE_USER");
        }
        return new UserSummary(
                result.getObject("id", UUID.class), result.getString("username"), result.getString("email"),
                roles, roleLabel(roles), result.getBoolean("is_active"),
                result.getBoolean("is_active") ? "Active" : "Disabled",
                instant(result, "created_at"), result.getString("risk_level"),
                result.getInt("risk_score"), result.getInt("active_sessions"),
                result.getInt("registered_devices"), instant(result, "last_activity"),
                result.getString("last_device"), result.getBoolean("mfa_enabled")
                );
    }

    private Instant instant(ResultSet result, String column) throws SQLException {
        Timestamp timestamp = result.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private String roleLabel(List<String> roles) {
        if (roles.contains("ROLE_ADMIN")) {
            return "Administrator";
        }
        if (roles.contains("ROLE_TEAM_MEMBER")) {
            return "Team Member";
        }
        if (roles.contains("ROLE_USER")) {
            return "Standard User";
        }
        return roles.get(0).replace("ROLE_", "").replace('_', ' ');
    }

    private String safeSearch(String search) {
        if (search == null) {
            return "";
        }
        String normalized = search.trim();
        return normalized.length() > 120 ? normalized.substring(0, 120) : normalized;
    }

    private String initials(String username) {
        if (username == null || username.isBlank()) {
            return "SY";
        }
        String[] parts = username.trim().split("[\\s._-]+");
        if (parts.length > 1) {
            return (parts[0].substring(0, 1) + parts[1].substring(0, 1)).toUpperCase(Locale.ROOT);
        }
        return username.substring(0, Math.min(2, username.length())).toUpperCase(Locale.ROOT);
    }

    private String displayAction(String action) {
        String normalized = action == null ? "Activity" : action.replace('_', ' ').toLowerCase(Locale.ROOT);
        StringBuilder display = new StringBuilder();
        for (String word : normalized.split("\\s+")) {
            if (word.isEmpty()) continue;
            if (!display.isEmpty()) display.append(' ');
            display.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return display.toString();
    }

    private String deviceLabel(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "Unknown device";
        }
        String agent = userAgent.toLowerCase(Locale.ROOT);
        String browser = agent.contains("edg/") ? "Edge"
                : agent.contains("firefox/") ? "Firefox"
                : agent.contains("chrome/") ? "Chrome"
                : agent.contains("safari/") ? "Safari" : "Browser";
        String platform = agent.contains("android") ? "Android"
                : agent.contains("iphone") || agent.contains("ipad") ? "iOS"
                : agent.contains("windows") ? "Windows"
                : agent.contains("mac os") || agent.contains("macintosh") ? "macOS"
                : agent.contains("linux") ? "Linux" : "device";
        return browser + " on " + platform;
    }

    private void writeAudit(UUID actorId, String action, String ipAddress, String details) {
        String ip = ipAddress == null || ipAddress.isBlank() ? "unknown"
                : ipAddress.length() <= 45 ? ipAddress : ipAddress.substring(0, 45);
        jdbcTemplate.update("INSERT INTO audit_logs (user_id, action_type, status, ip_address, details) "
                        + "VALUES (?, ?, 'SUCCESS', ?, ?)",
                actorId, action, ip, details);
    }

    public record AdminIdentity(UUID id, String username, String email, String role, UUID currentSessionId) {}
    public record DashboardOverview(long totalUsers, long storedCredentials, long activeSessions,
                                    long securityAlerts, long vaultCount, long registeredDevices,
                                    int securityScore, List<ActivityRow> recentActivities) {}
    public record PageData<T>(List<T> items, int page, int size, long total) {}
    public record UserStats(long totalUsers, long adminAccounts, long criticalUsers,
                            long highRiskUsers, long registeredDevices, long activeSessions) {}
    public record UserSummary(UUID id, String name, String email, List<String> roles, String role,
                              boolean active, String status, Instant joinDate, String riskLevel,
                              int riskScore, int activeSessions, int registeredDevices,
                              Instant lastActivity, String lastDevice, boolean mfaEnabled) {}
    public record UserDetails(UserSummary user, List<String> riskFactors,
                              List<DeviceView> connectedDevices, List<SessionView> sessions) {}
    public record DeviceView(UUID id, String name, String os, String browser, String ip, String location,
                             String type, String icon, boolean isCurrent, Instant lastActive,
                             Instant firstSeen, boolean flagged, int activeSessions, boolean trusted) {}
    public record SessionView(UUID id, String device, String ip, Instant loginTime, Instant expiresAt,
                              String logoutTime, String status, boolean active) {}
    public record ActivityRow(UUID id, String name, String email, String action,
                              String device, Instant time, String status, String initials, String details) {}
    public record VaultOverview(long vaultCount, long storedCredentials, long usersWithVault) {}
    public record DailyMetric(LocalDate date, long total, long critical, long high, long medium, long low) {}
    public record SecurityEventRow(UUID id, String username, String email, String eventType,
                                   String alertTitle, String detectionReason, String severity,
                                   int riskScore, boolean anomalyDetected, boolean resolved,
                                   String status, String ipAddress, Instant timestamp,
                                   long relatedEventCount) {}
    public record AnalyticsOverview(List<DailyMetric> daily, List<SecurityEventRow> events,
                                    long eventsTotal, int eventsPage, int eventsSize, SecuritySummary summary,
                                    long unresolved, long critical, long high, long medium, long low,
                                    int securityScore, LoginMonitoring loginMonitoring,
                                    PasswordHealthSummary passwordHealth, VaultMonitoring vaultMonitoring,
                                    List<ActivityRow> recentAuthentication, ThreatRuleConfiguration threatRules) {}
    public record ThreatRuleConfiguration(int failedLoginThreshold, int failedLoginWindowMinutes,
                                         int criticalEscalationThreshold) {}
    public record SecuritySummary(long totalAlerts, long highSeverityAlerts, long failedLoginAttempts,
                                  long openInvestigations, long suspiciousActivities) {}
    public record SecurityEventDetails(SecurityEventRow event, List<RelatedSecurityActivity> relatedEvents,
                                       List<InvestigationAction> history) {}
    public record RelatedSecurityActivity(UUID id, String action, String result, String ipAddress,
                                          String details, Instant timestamp) {}
    public record InvestigationAction(String previousStatus, String status, String notes,
                                      String reviewer, Instant timestamp) {}
    public record LoginMonitoring(long successful24h, long failed24h, long uniqueIps7d,
                                  long newDevices30d, long unusualHours30d, long repeatedFailures30d) {}
    public record PasswordHealthSummary(long assessedUsers, long totalUsers, long weakPasswords,
                                        long reusedPasswords, long compromisedPasswords, Long averageStrength) {}
    public record VaultMonitoring(long trackedEvents, long suspiciousAlerts, boolean trackingActive) {}
    public record SystemOverview(String serviceStatus, String databaseStatus, long auditEntries,
                                 long registeredDevices, long activeSessions, int sessionLifetimeSeconds) {}
}
