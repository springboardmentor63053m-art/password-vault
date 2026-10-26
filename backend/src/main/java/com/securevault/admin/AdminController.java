package com.securevault.admin;

import jakarta.servlet.http.HttpServletRequest;
import com.securevault.common.ClientIpResolver;
import com.securevault.common.BcryptPasswordLength;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {"http://localhost:3001", "http://127.0.0.1:3001"})
@Validated
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService adminService;
    private final ClientIpResolver clientIpResolver;

    public AdminController(AdminService adminService) {
        this(adminService, ClientIpResolver.withoutTrustedProxies());
    }

    @Autowired
    public AdminController(AdminService adminService, ClientIpResolver clientIpResolver) {
        this.adminService = adminService;
        this.clientIpResolver = clientIpResolver;
    }

    @GetMapping("/me")
    public AdminService.AdminIdentity identity(HttpServletRequest request) {
        return adminService.identity(AdminAuthenticationInterceptor.principal(request));
    }

    @GetMapping("/dashboard")
    public AdminService.DashboardOverview dashboard() {
        return adminService.dashboard();
    }

    @GetMapping("/users")
    public AdminService.PageData<AdminService.UserSummary> users(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "ALL") String risk,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return adminService.users(search, risk, page, size);
    }

    @GetMapping("/users/stats")
    public AdminService.UserStats userStats() {
        return adminService.userStats();
    }

    @GetMapping("/users/{userId}")
    public AdminService.UserDetails user(@PathVariable UUID userId, HttpServletRequest request) {
        return adminService.user(userId, AdminAuthenticationInterceptor.principal(request));
    }

    @PatchMapping("/users/{userId}/status")
    public ResponseEntity<Void> setUserActive(
            @PathVariable UUID userId,
            @Valid @RequestBody UserStatusRequest body,
            HttpServletRequest request) {
        adminService.setUserActive(userId, body.active(),
                AdminAuthenticationInterceptor.principal(request), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/users/{userId}/role")
    public AdminService.UserSummary setUserRole(
            @PathVariable UUID userId,
            @Valid @RequestBody UserRoleRequest body,
            HttpServletRequest request) {
        return adminService.setUserRole(userId, body.role(),
                body.currentPassword(),
                AdminAuthenticationInterceptor.principal(request), clientIpResolver.resolve(request));
    }

    @PostMapping("/users/{userId}/devices/{deviceId}/revoke")
    public ResponseEntity<Void> revokeDevice(
            @PathVariable UUID userId,
            @PathVariable UUID deviceId,
            HttpServletRequest request) {
        adminService.revokeDevice(userId, deviceId,
                AdminAuthenticationInterceptor.principal(request), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/activities")
    public AdminService.PageData<AdminService.ActivityRow> activities(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return adminService.activities(search, page, size);
    }

    @GetMapping("/vaults/overview")
    public AdminService.VaultOverview vaultOverview() {
        return adminService.vaultOverview();
    }

    @GetMapping("/analytics")
    public AdminService.AnalyticsOverview analytics() {
        return adminService.analytics();
    }

    @PatchMapping("/analytics/events/{eventId}/resolve")
    public ResponseEntity<Void> resolveEvent(@PathVariable UUID eventId, HttpServletRequest request) {
        adminService.resolveSecurityEvent(eventId,
                AdminAuthenticationInterceptor.principal(request), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/analytics/events/{eventId}/status")
    public ResponseEntity<Void> updateEventStatus(
            @PathVariable UUID eventId,
            @Valid @RequestBody SecurityEventStatusRequest body,
            HttpServletRequest request) {
        adminService.updateSecurityEventStatus(eventId, body.status(),
                AdminAuthenticationInterceptor.principal(request), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/settings")
    public AdminService.SystemOverview settings() {
        return adminService.settings();
    }

    public record UserStatusRequest(@NotNull Boolean active) {}
    public record SecurityEventStatusRequest(
            @NotBlank @Pattern(regexp = "OPEN|INVESTIGATING|RESOLVED") String status) {}
    public record UserRoleRequest(
            @NotBlank @Pattern(regexp = "ROLE_USER|ROLE_TEAM_MEMBER|ROLE_ADMIN") String role,
            @NotBlank @Size(max = 72) @BcryptPasswordLength String currentPassword) {
        @Override public String toString() { return "UserRoleRequest[redacted]"; }
    }
}
