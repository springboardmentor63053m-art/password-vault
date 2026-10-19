
package com.securevault.admin;

import java.util.Map;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
public class AdminDashboardController {

    private final AdminDashboardService dashboardService;

    public AdminDashboardController(AdminDashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/dashboard/statistics")
    public ResponseEntity<Map<String, Long>> getStatistics() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dashboardService.getStatistics());
    }

    @GetMapping("/vault/statistics")
    public ResponseEntity<Map<String, Long>> getVaultStatistics() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dashboardService.getVaultStatistics());
    }

    @GetMapping("/analytics/security-events")
    public ResponseEntity<List<AdminDashboardService.DailySecurityEventCount>> getSecurityAnalytics() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(dashboardService.getSecurityAnalytics());
    }

    @GetMapping("/activity-logs")
    public ResponseEntity<List<AdminDashboardService.ActivityLogEntry>> getActivityLogs() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(dashboardService.getActivityLogs());
    }

    @GetMapping("/settings")
    public ResponseEntity<AdminDashboardService.AdminSettings> getAdminSettings() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(dashboardService.getAdminSettings());
    }

    @PutMapping("/settings")
    public ResponseEntity<AdminDashboardService.AdminSettings> updateAdminSettings(
            @Valid @RequestBody AdminSettingsRequest request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(dashboardService.updateAdminSettings(
                new AdminDashboardService.AdminSettings(
                        request.securityMonitoringEnabled(), request.activityMonitoringEnabled())));
    }

    @GetMapping("/users")
    public ResponseEntity<List<AdminDashboardService.UserSummary>> getUsers() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dashboardService.getUsers());
    }

    @GetMapping("/roles")
    public ResponseEntity<List<String>> getAssignableRoles() {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(dashboardService.getAssignableRoles());
    }

    @PostMapping("/users/{userId}/role")
    public ResponseEntity<Void> assignRole(
            @PathVariable UUID userId,
            @Valid @RequestBody RoleAssignmentRequest request) {
        dashboardService.assignRole(userId, request.role().name());
        return ResponseEntity.noContent().build();
    }

    public enum AssignableRole {
        ROLE_ADMIN,
        ROLE_TEAM_MEMBER
    }

    public record RoleAssignmentRequest(@NotNull AssignableRole role) {}

    public record AdminSettingsRequest(@NotNull Boolean securityMonitoringEnabled,
            @NotNull Boolean activityMonitoringEnabled) {}
}
