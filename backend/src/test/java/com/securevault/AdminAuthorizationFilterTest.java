package com.securevault;

import com.securevault.common.AdminAuthorizationFilter;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminAuthorizationFilterTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID userId = UUID.randomUUID();
    private final SecretKey key = Keys.hmacShaKeyFor(new byte[32]);
    private AdminAuthorizationFilter filter;

    @BeforeEach
    void setup() {
        filter = new AdminAuthorizationFilter(jdbc, Encoders.BASE64.encode(key.getEncoded()));
    }

    @Test
    void missingTokenIsUnauthorized() throws Exception {
        MockHttpServletResponse response = invoke(null);
        assertEquals(401, response.getStatus());
        verifyNoInteractions(jdbc);
    }

    @Test
    void activeDatabaseRoleControlsAdminAccess() throws Exception {
        when(jdbc.queryForObject(contains("ROLE_ADMIN"), eq(Boolean.class), eq(userId))).thenReturn(false);
        MockHttpServletResponse nonAdminResponse = invoke(token(false));
        assertEquals(403, nonAdminResponse.getStatus());

        MockHttpServletResponse nonAdminRoleAssignment = invoke(
                token(false), "POST", "/api/admin/users/" + UUID.randomUUID() + "/role");
        assertEquals(403, nonAdminRoleAssignment.getStatus());

        MockHttpServletResponse nonAdminSettingsUpdate = invoke(token(false), "PUT", "/api/admin/settings");
        assertEquals(403, nonAdminSettingsUpdate.getStatus());

        MockHttpServletResponse nonAdminSecurityAnalytics = invoke(
                token(false), "GET", "/api/admin/analytics/security-events");
        assertEquals(403, nonAdminSecurityAnalytics.getStatus());

        when(jdbc.queryForObject(contains("ROLE_ADMIN"), eq(Boolean.class), eq(userId))).thenReturn(true);
        MockHttpServletResponse adminResponse = invoke(token(false));
        assertEquals(200, adminResponse.getStatus());
    }

    @Test
    void expiredTokenIsUnauthorized() throws Exception {
        MockHttpServletResponse response = invoke(token(true));
        assertEquals(401, response.getStatus());
        verifyNoInteractions(jdbc);
    }

    private MockHttpServletResponse invoke(String token) throws Exception {
        return invoke(token, "GET", "/api/admin/dashboard/statistics");
    }

    private MockHttpServletResponse invoke(String token, String method, String path) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> ((MockHttpServletResponse) res).setStatus(200));
        return response;
    }

    private String token(boolean expired) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId.toString())
                .issuedAt(Date.from(now.minusSeconds(120)))
                .expiration(Date.from(expired ? now.minusSeconds(60) : now.plusSeconds(60)))
                .signWith(key).compact();
    }
}
