package com.securevault.auth;

import com.securevault.common.AccountAuthenticationInterceptor;
import com.securevault.common.AccountPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/account")
public class AccountIdentityController {
    private final JdbcTemplate db;

    public AccountIdentityController(JdbcTemplate db) {
        this.db = db;
    }

    public record AccountIdentityResponse(UUID id, String username, String email, List<String> roles) {}

    @GetMapping("/me")
    public ResponseEntity<AccountIdentityResponse> me(HttpServletRequest request) {
        AccountPrincipal principal = AccountAuthenticationInterceptor.principal(request);
        if (principal == null) {
            return ResponseEntity.status(401).build();
        }
        List<String> roles = db.query(
                "SELECT r.role_name FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = ?",
                (rs, rowNum) -> rs.getString("role_name"),
                principal.userId()
        );
        return ResponseEntity.ok(new AccountIdentityResponse(principal.userId(), principal.username(), principal.email(), roles));
    }
}

