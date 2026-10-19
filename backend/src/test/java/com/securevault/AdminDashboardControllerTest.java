package com.securevault;

import com.securevault.admin.AdminDashboardController;
import com.securevault.admin.AdminDashboardService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminDashboardControllerTest {
    private final AdminDashboardService service = mock(AdminDashboardService.class);
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new AdminDashboardController(service)).build();
    }

    @Test
    void listsDatabaseUserSummariesWithoutSensitiveFields() throws Exception {
        UUID id = UUID.randomUUID();
        when(service.getUsers()).thenReturn(List.of(new AdminDashboardService.UserSummary(
                id, "alice", "alice@example.com", true,
                OffsetDateTime.parse("2026-10-01T12:00:00Z"), List.of("ROLE_USER"))));

        mvc.perform(get("/api/admin/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()))
                .andExpect(jsonPath("$[0].username").value("alice"))
                .andExpect(jsonPath("$[0].email").value("alice@example.com"))
                .andExpect(jsonPath("$[0].active").value(true))
                .andExpect(jsonPath("$[0].roles[0]").value("ROLE_USER"))
                .andExpect(jsonPath("$[0].password").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void onlyReturnsConfiguredAssignableRoles() throws Exception {
        when(service.getAssignableRoles()).thenReturn(List.of("ROLE_ADMIN", "ROLE_TEAM_MEMBER"));

        mvc.perform(get("/api/admin/roles"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("ROLE_ADMIN"))
                .andExpect(jsonPath("$[1]").value("ROLE_TEAM_MEMBER"));
    }

    @Test
    void vaultOverviewReturnsOnlyAggregateCountsWithoutCaching() throws Exception {
        when(service.getVaultStatistics()).thenReturn(java.util.Map.of("storedCredentials", 7L, "protectedVaults", 4L));

        mvc.perform(get("/api/admin/vault/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.storedCredentials").value(7))
                .andExpect(jsonPath("$.protectedVaults").value(4))
                .andExpect(jsonPath("$.encrypted_data").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void securityAnalyticsEndpointReturnsDailyAggregatesWithoutCaching() throws Exception {
        when(service.getSecurityAnalytics()).thenReturn(List.of(new AdminDashboardService.DailySecurityEventCount(
                java.time.LocalDate.parse("2026-10-19"), 0L)));

        mvc.perform(get("/api/admin/analytics/security-events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].count").value(0))
                .andExpect(jsonPath("$[0].date").value("2026-10-19"))
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void activityLogsEndpointReturnsSafeTableFieldsAndNoStore() throws Exception {
        when(service.getActivityLogs()).thenReturn(List.of(new AdminDashboardService.ActivityLogEntry(
                "alice", "Logged in", "Windows · Chrome", OffsetDateTime.parse("2026-10-19T12:00:00Z"), "Success")));

        mvc.perform(get("/api/admin/activity-logs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("alice"))
                .andExpect(jsonPath("$[0].activity").value("Logged in"))
                .andExpect(jsonPath("$[0].device").value("Windows · Chrome"))
                .andExpect(jsonPath("$[0].status").value("Success"))
                .andExpect(jsonPath("$[0].sessionToken").doesNotExist())
                .andExpect(header().string("Cache-Control", "no-store"));
    }

    @Test
    void adminSettingsCanBeReadAndUpdatedThroughSettingsEndpoints() throws Exception {
        when(service.getAdminSettings()).thenReturn(new AdminDashboardService.AdminSettings(true, false));
        mvc.perform(get("/api/admin/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.securityMonitoringEnabled").value(true))
                .andExpect(jsonPath("$.activityMonitoringEnabled").value(false))
                .andExpect(header().string("Cache-Control", "no-store"));

        when(service.updateAdminSettings(new AdminDashboardService.AdminSettings(false, true)))
                .thenReturn(new AdminDashboardService.AdminSettings(false, true));
        mvc.perform(put("/api/admin/settings").contentType("application/json")
                        .content("{\"securityMonitoringEnabled\":false,\"activityMonitoringEnabled\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.securityMonitoringEnabled").value(false))
                .andExpect(jsonPath("$.activityMonitoringEnabled").value(true));
        verify(service).updateAdminSettings(new AdminDashboardService.AdminSettings(false, true));
    }

    @Test
    void roleAssignmentEndpointUsesExistingRestrictedWorkflow() throws Exception {
        UUID userId = UUID.randomUUID();

        mvc.perform(post("/api/admin/users/{userId}/role", userId)
                        .contentType("application/json")
                        .content("{\"role\":\"ROLE_TEAM_MEMBER\"}"))
                .andExpect(status().isNoContent());

        verify(service).assignRole(userId, "ROLE_TEAM_MEMBER");
    }
}
