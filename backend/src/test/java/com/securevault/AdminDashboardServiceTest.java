package com.securevault;

import com.securevault.admin.AdminDashboardService;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminDashboardServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final AdminDashboardService service = new AdminDashboardService(jdbc);

    @Test
    void statisticsUseDatabaseCounts() {
        when(jdbc.queryForObject("SELECT COUNT(*) FROM users", Long.class)).thenReturn(3L);
        when(jdbc.queryForObject("SELECT COUNT(*) FROM credentials", Long.class)).thenReturn(0L);
        when(jdbc.queryForObject(contains("FROM sessions"), eq(Long.class))).thenReturn(2L);
        when(jdbc.queryForObject(contains("FROM security_events"), eq(Long.class))).thenReturn(1L);

        assertEquals(Map.of("totalUsers", 3L, "storedCredentials", 0L,
                "activeSessions", 2L, "securityAlerts", 1L), service.getStatistics());
    }

    @Test
    void vaultStatisticsUseAggregateDatabaseCountsOnly() {
        when(jdbc.queryForObject("SELECT COUNT(*) FROM credentials", Long.class)).thenReturn(7L);
        when(jdbc.queryForObject("SELECT COUNT(*) FROM vaults", Long.class)).thenReturn(4L);

        assertEquals(Map.of("storedCredentials", 7L, "protectedVaults", 4L), service.getVaultStatistics());
        verify(jdbc, never()).query(contains("encrypted_data"), any(RowMapper.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void securityAnalyticsReturnsSevenDaysAndFillsMissingDaysWithZero() {
        doAnswer(invocation -> {
            org.springframework.jdbc.core.RowCallbackHandler callback = invocation.getArgument(1);
            ResultSet row = mock(ResultSet.class);
            when(row.getObject("event_date", java.time.LocalDate.class)).thenReturn(java.time.LocalDate.now(java.time.ZoneOffset.UTC));
            when(row.getLong("event_count")).thenReturn(2L);
            callback.processRow(row);
            return null;
        }).when(jdbc).query(contains("FROM security_events"), any(org.springframework.jdbc.core.RowCallbackHandler.class),
                any(), any());

        var points = service.getSecurityAnalytics();

        assertEquals(7, points.size());
        assertEquals(2L, points.get(6).count());
        assertEquals(0L, points.get(0).count());
        verify(jdbc, never()).query(contains("password"), any(org.springframework.jdbc.core.RowCallbackHandler.class), any(), any());
    }

    @Test
    void securityAnalyticsReturnsSevenZeroDaysWhenDatabaseHasNoEvents() {
        doNothing().when(jdbc).query(contains("FROM security_events"), any(org.springframework.jdbc.core.RowCallbackHandler.class),
                any(), any());

        var points = service.getSecurityAnalytics();

        assertEquals(7, points.size());
        assertTrue(points.stream().allMatch(point -> point.count() == 0L));
        verify(jdbc).query(contains("CAST(timestamp AT TIME ZONE 'UTC' AS DATE)"),
                any(org.springframework.jdbc.core.RowCallbackHandler.class),
                any(java.sql.Timestamp.class), any(java.sql.Timestamp.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void activityLogsExposeOnlySafeSuccessfulSessionFields() throws Exception {
        OffsetDateTime created = OffsetDateTime.parse("2026-10-19T12:00:00Z");
        ResultSet row = mock(ResultSet.class);
        when(row.getString("username")).thenReturn("alice");
        when(row.getString("user_agent")).thenReturn("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36");
        when(row.getObject("created_at", OffsetDateTime.class)).thenReturn(created);
        when(jdbc.query(contains("FROM sessions s JOIN users u"), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(row, 0));
        });

        var entries = service.getActivityLogs();

        assertEquals(1, entries.size());
        assertEquals("alice", entries.get(0).username());
        assertEquals("Logged in", entries.get(0).activity());
        assertEquals("Windows · Chrome", entries.get(0).device());
        assertEquals(created, entries.get(0).timestamp());
        assertEquals("Success", entries.get(0).status());
        verify(jdbc, never()).query(contains("session_token"), any(RowMapper.class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void activityLogsReturnEmptyListWhenThereAreNoSessions() {
        when(jdbc.query(contains("FROM sessions s JOIN users u"), any(RowMapper.class))).thenReturn(List.of());

        assertTrue(service.getActivityLogs().isEmpty());
    }

    @Test
    void adminSettingsLoadPersistedValuesAndUpdateBothKeys() {
        doAnswer(invocation -> {
            org.springframework.jdbc.core.RowCallbackHandler callback = invocation.getArgument(1);
            ResultSet security = mock(ResultSet.class);
            when(security.getString("setting_key")).thenReturn("securityMonitoringEnabled");
            when(security.getBoolean("setting_value")).thenReturn(false);
            callback.processRow(security);
            ResultSet activity = mock(ResultSet.class);
            when(activity.getString("setting_key")).thenReturn("activityMonitoringEnabled");
            when(activity.getBoolean("setting_value")).thenReturn(true);
            callback.processRow(activity);
            return null;
        }).when(jdbc).query(eq("SELECT setting_key, setting_value FROM admin_settings"),
                any(org.springframework.jdbc.core.RowCallbackHandler.class));

        assertEquals(new AdminDashboardService.AdminSettings(false, true), service.getAdminSettings());

        var updated = new AdminDashboardService.AdminSettings(true, false);
        assertEquals(updated, service.updateAdminSettings(updated));
        verify(jdbc).update(contains("ON CONFLICT (setting_key) DO UPDATE"), eq("securityMonitoringEnabled"), eq(true));
        verify(jdbc).update(contains("ON CONFLICT (setting_key) DO UPDATE"), eq("activityMonitoringEnabled"), eq(false));
    }

    @Test
    void assignmentOnlyAcceptsElevatedRolesAndAddsExistingRole() {
        UUID userId = UUID.randomUUID();
        when(jdbc.queryForObject(contains("FROM users"), eq(Boolean.class), eq(userId))).thenReturn(true);
        when(jdbc.queryForObject(contains("FROM roles"), eq(Boolean.class), eq("ROLE_ADMIN"))).thenReturn(true);

        service.assignRole(userId, "ROLE_ADMIN");

        verify(jdbc).update(contains("INSERT INTO user_roles"), eq(userId), eq("ROLE_ADMIN"));
        assertThrows(IllegalArgumentException.class, () -> service.assignRole(userId, "ROLE_USER"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void userListComesFromDatabaseAndCombinesAssignedRoles() throws Exception {
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        OffsetDateTime created = OffsetDateTime.parse("2026-10-01T12:00:00Z");
        ResultSet firstAdminRole = userRow(firstId, "alice", "alice@example.com", true, created, "ROLE_ADMIN");
        ResultSet firstUserRole = userRow(firstId, "alice", "alice@example.com", true, created, "ROLE_USER");
        ResultSet secondUserRole = userRow(secondId, "bob", "bob@example.com", false, created, "ROLE_USER");
        when(jdbc.query(contains("FROM users u"), any(RowMapper.class))).thenAnswer(invocation -> {
            RowMapper<Object> mapper = invocation.getArgument(1);
            return List.of(
                    mapper.mapRow(firstAdminRole, 0),
                    mapper.mapRow(firstUserRole, 1),
                    mapper.mapRow(secondUserRole, 2));
        });

        List<AdminDashboardService.UserSummary> users = service.getUsers();

        assertEquals(2, users.size());
        assertEquals(firstId, users.get(0).id());
        assertEquals(List.of("ROLE_ADMIN", "ROLE_USER"), users.get(0).roles());
        assertFalse(users.get(1).active());
        assertEquals(List.of("ROLE_USER"), users.get(1).roles());
        verify(jdbc, never()).queryForList(contains("password_hash"), eq(String.class));
    }

    @Test
    void availableRolesComeFromConfiguredDatabaseRolesAndExcludeUserRole() {
        when(jdbc.queryForList("SELECT role_name FROM roles ORDER BY role_name", String.class))
                .thenReturn(List.of("ROLE_ADMIN", "ROLE_TEAM_MEMBER", "ROLE_USER"));

        assertEquals(List.of("ROLE_ADMIN", "ROLE_TEAM_MEMBER"), service.getAssignableRoles());
    }

    private ResultSet userRow(
            UUID id, String username, String email, boolean active, OffsetDateTime created, String role) throws Exception {
        ResultSet row = mock(ResultSet.class);
        when(row.getObject("id", UUID.class)).thenReturn(id);
        when(row.getString("username")).thenReturn(username);
        when(row.getString("email")).thenReturn(email);
        when(row.getBoolean("is_active")).thenReturn(active);
        when(row.getObject("created_at", OffsetDateTime.class)).thenReturn(created);
        when(row.getString("role_name")).thenReturn(role);
        return row;
    }
}
