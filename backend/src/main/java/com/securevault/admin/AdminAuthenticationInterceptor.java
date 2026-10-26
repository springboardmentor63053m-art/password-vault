package com.securevault.admin;

import com.securevault.common.SessionTokenUtils;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AdminAuthenticationInterceptor implements HandlerInterceptor {
    private static final String PRINCIPAL_ATTRIBUTE = "secureVaultAdmin";

    private final JdbcTemplate jdbcTemplate;
    private final SecretKey signingKey;

    public AdminAuthenticationInterceptor(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64) {
        this.jdbcTemplate = jdbcTemplate;
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64.trim()));
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }

        String token = bearerToken(request.getHeader("Authorization"));
        if (token == null) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED",
                    "Sign in with an administrator account to continue.");
            return false;
        }

        final Claims claims;
        try {
            claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
        } catch (JwtException | IllegalArgumentException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED",
                    "Your session is invalid or has expired. Sign in again.");
            return false;
        }

        final UUID userId;
        try {
            userId = UUID.fromString(claims.getSubject());
        } catch (RuntimeException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED",
                    "Your session is invalid or has expired. Sign in again.");
            return false;
        }

        List<AdminPrincipal> activeSessions = jdbcTemplate.query(
                "SELECT u.id AS user_id, s.id AS session_id, s.device_id, u.username, u.email, "
                        + "EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id "
                        + "WHERE ur.user_id = u.id AND r.role_name = 'ROLE_ADMIN') AS is_admin "
                        + "FROM sessions s JOIN users u ON u.id = s.user_id "
                        + "WHERE s.session_token = ? AND s.user_id = ? AND s.is_revoked = FALSE "
                        + "AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE",
                (result, row) -> {
                    if (!result.getBoolean("is_admin")) {
                        return null;
                    }
                    return new AdminPrincipal(
                            result.getObject("user_id", UUID.class),
                            result.getObject("session_id", UUID.class),
                            result.getObject("device_id", UUID.class),
                            result.getString("username"),
                            result.getString("email"));
                },
                SessionTokenUtils.fingerprint(token), userId);

        if (activeSessions.isEmpty()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "SESSION_REVOKED",
                    "Your session is no longer active. Sign in again.");
            return false;
        }
        AdminPrincipal principal = activeSessions.get(0);
        if (principal == null) {
            writeError(response, HttpServletResponse.SC_FORBIDDEN, "ADMIN_REQUIRED",
                    "This dashboard is available only to administrator accounts.");
            return false;
        }
        request.setAttribute(PRINCIPAL_ATTRIBUTE, principal);
        response.setHeader("Cache-Control", "no-store");
        return true;
    }

    static AdminPrincipal principal(HttpServletRequest request) {
        return (AdminPrincipal) request.getAttribute(PRINCIPAL_ATTRIBUTE);
    }

    private String bearerToken(String authorization) {
        if (authorization == null || !authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return null;
        }
        String token = authorization.substring(7).trim();
        return token.isEmpty() || token.length() > 4096 ? null : token;
    }

    private void writeError(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
