
package com.securevault.admin;

import java.util.Map;
import java.util.UUID;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.time.LocalDate;
import java.sql.Timestamp;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminDashboardService {

    private static final Set<String> ASSIGNABLE_ROLES = Set.of("ROLE_ADMIN", "ROLE_TEAM_MEMBER");

    private final JdbcTemplate jdbcTemplate;

    public AdminDashboardService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Long> getStatistics() {
        long totalUsers = count(
                "SELECT COUNT(*) FROM users");

        long storedCredentials = count(
                "SELECT COUNT(*) FROM credentials");

        long activeSessions = count(
                "SELECT COUNT(*) FROM sessions "
                + "WHERE is_revoked = FALSE "
                + "AND expires_at > CURRENT_TIMESTAMP");

        long securityAlerts = count(
                "SELECT COUNT(*) FROM security_events "
                + "WHERE is_resolved = FALSE");

        return Map.of(
                "totalUsers", totalUsers,
                "storedCredentials", storedCredentials,
                "activeSessions", activeSessions,
                "securityAlerts", securityAlerts
        );
    }

    /** Aggregate-only vault overview; never selects credential content. */
    public Map<String, Long> getVaultStatistics() {
        long storedCredentials = count("SELECT COUNT(*) FROM credentials");
        long protectedVaults = count("SELECT COUNT(*) FROM vaults");
        return Map.of("storedCredentials", storedCredentials, "protectedVaults", protectedVaults);
    }

    /** Returns the last seven calendar days, including days with no events. */
    public List<DailySecurityEventCount> getSecurityAnalytics() {
        LocalDate today = LocalDate.now(java.time.ZoneOffset.UTC);
        LocalDate start = today.minusDays(6);
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        for (int day = 0; day < 7; day++) counts.put(start.plusDays(day), 0L);

        jdbcTemplate.query(
                "SELECT CAST(timestamp AT TIME ZONE 'UTC' AS DATE) AS event_date, COUNT(*) AS event_count "
                + "FROM security_events WHERE timestamp >= ? AND timestamp < ? "
                + "GROUP BY CAST(timestamp AT TIME ZONE 'UTC' AS DATE) ORDER BY event_date",
                (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                        counts.put(rs.getObject("event_date", LocalDate.class), rs.getLong("event_count")),
                Timestamp.from(start.atStartOfDay(java.time.ZoneOffset.UTC).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(java.time.ZoneOffset.UTC).toInstant()));

        return counts.entrySet().stream()
                .map(entry -> new DailySecurityEventCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    public record DailySecurityEventCount(LocalDate date, long count) {}

    /** Recent successful sign-ins, selected without token or request secrets. */
    public List<ActivityLogEntry> getActivityLogs() {
        String sql = "SELECT u.username, s.user_agent, s.created_at "
                + "FROM sessions s JOIN users u ON u.id = s.user_id "
                + "ORDER BY s.created_at DESC LIMIT 100";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new ActivityLogEntry(
                rs.getString("username"), "Logged in", safeDeviceName(rs.getString("user_agent")),
                rs.getObject("created_at", OffsetDateTime.class), "Success"));
    }

    private String safeDeviceName(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return null;
        String agent = userAgent.toLowerCase(java.util.Locale.ROOT);
        String os = agent.contains("windows") ? "Windows"
                : agent.contains("android") ? "Android"
                : agent.contains("iphone") || agent.contains("ipad") ? "iOS"
                : agent.contains("mac os") || agent.contains("macintosh") ? "macOS"
                : agent.contains("linux") ? "Linux" : null;
        String browser = agent.contains("edg/") ? "Edge"
                : agent.contains("firefox/") ? "Firefox"
                : agent.contains("chrome/") && !agent.contains("chromium") ? "Chrome"
                : agent.contains("safari/") && !agent.contains("chrome/") ? "Safari" : null;
        return os == null && browser == null ? "Unknown device"
                : os == null ? browser : browser == null ? os : os + " · " + browser;
    }

    public record ActivityLogEntry(String username, String activity, String device,
            OffsetDateTime timestamp, String status) {}

    public AdminSettings getAdminSettings() {
        Map<String, Boolean> values = new LinkedHashMap<>();
        jdbcTemplate.query("SELECT setting_key, setting_value FROM admin_settings",
                (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                        values.put(rs.getString("setting_key"), rs.getBoolean("setting_value")));
        return new AdminSettings(
                values.getOrDefault("securityMonitoringEnabled", true),
                values.getOrDefault("activityMonitoringEnabled", true));
    }

    @Transactional
    public AdminSettings updateAdminSettings(AdminSettings settings) {
        jdbcTemplate.update(
                "INSERT INTO admin_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                + "ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP",
                "securityMonitoringEnabled", settings.securityMonitoringEnabled());
        jdbcTemplate.update(
                "INSERT INTO admin_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
                + "ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, updated_at = CURRENT_TIMESTAMP",
                "activityMonitoringEnabled", settings.activityMonitoringEnabled());
        return settings;
    }

    public record AdminSettings(boolean securityMonitoringEnabled, boolean activityMonitoringEnabled) {}

    public List<UserSummary> getUsers() {
        String sql = "SELECT u.id, u.username, u.email, u.is_active, u.created_at, r.role_name "
                + "FROM users u "
                + "LEFT JOIN user_roles ur ON ur.user_id = u.id "
                + "LEFT JOIN roles r ON r.id = ur.role_id "
                + "ORDER BY u.created_at DESC, u.username, r.role_name";
        List<UserRoleRow> rows = jdbcTemplate.query(sql, (rs, rowNum) -> new UserRoleRow(
                rs.getObject("id", UUID.class),
                rs.getString("username"),
                rs.getString("email"),
                rs.getBoolean("is_active"),
                rs.getObject("created_at", OffsetDateTime.class),
                rs.getString("role_name")));

        Map<UUID, UserSummaryBuilder> users = new LinkedHashMap<>();
        for (UserRoleRow row : rows) {
            UserSummaryBuilder user = users.computeIfAbsent(row.id(), ignored ->
                    new UserSummaryBuilder(row.id(), row.username(), row.email(), row.active(), row.createdAt()));
            if (row.roleName() != null && !user.roles.contains(row.roleName())) {
                user.roles.add(row.roleName());
            }
        }
        return users.values().stream().map(UserSummaryBuilder::build).toList();
    }

    public List<String> getAssignableRoles() {
        return jdbcTemplate.queryForList("SELECT role_name FROM roles ORDER BY role_name", String.class)
                .stream()
                .filter(ASSIGNABLE_ROLES::contains)
                .toList();
    }

    @Transactional
    public void assignRole(UUID userId, String roleName) {
        if (!ASSIGNABLE_ROLES.contains(roleName)) {
            throw new IllegalArgumentException("Only elevated application roles can be assigned here.");
        }

        Boolean userExists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM users WHERE id = ?)",
                Boolean.class,
                userId);
        if (!Boolean.TRUE.equals(userExists)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND,
                    "User not found.");
        }

        Boolean roleExists = jdbcTemplate.queryForObject(
                "SELECT EXISTS (SELECT 1 FROM roles WHERE role_name = ?)",
                Boolean.class,
                roleName);
        if (!Boolean.TRUE.equals(roleExists)) {
            throw new IllegalStateException("Requested application role is not configured.");
        }

        jdbcTemplate.update(
                "INSERT INTO user_roles (user_id, role_id) "
                        + "SELECT ?, id FROM roles WHERE role_name = ? "
                        + "ON CONFLICT (user_id, role_id) DO NOTHING",
                userId,
                roleName);
    }

    private long count(String sql) {
        Long result = jdbcTemplate.queryForObject(sql, Long.class);
        return result == null ? 0L : result;
    }

    public record UserSummary(
            UUID id,
            String username,
            String email,
            boolean active,
            OffsetDateTime createdAt,
            List<String> roles) {}

    private record UserRoleRow(
            UUID id,
            String username,
            String email,
            boolean active,
            OffsetDateTime createdAt,
            String roleName) {}

    private static final class UserSummaryBuilder {
        private final UUID id;
        private final String username;
        private final String email;
        private final boolean active;
        private final OffsetDateTime createdAt;
        private final List<String> roles = new ArrayList<>();

        private UserSummaryBuilder(UUID id, String username, String email, boolean active, OffsetDateTime createdAt) {
            this.id = id;
            this.username = username;
            this.email = email;
            this.active = active;
            this.createdAt = createdAt;
        }

        private UserSummary build() {
            return new UserSummary(id, username, email, active, createdAt, List.copyOf(roles));
        }
    }
}
