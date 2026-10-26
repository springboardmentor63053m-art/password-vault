package com.securevault.common;

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

/** Validates a live user session without restricting the account's role. */
@Component
public class AccountAuthenticationInterceptor implements HandlerInterceptor {
    private static final String ATTRIBUTE = "secureVaultAccount";
    private final JdbcTemplate jdbcTemplate;
    private final SecretKey signingKey;

    public AccountAuthenticationInterceptor(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64) {
        this.jdbcTemplate = jdbcTemplate;
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64.trim()));
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                ? authorization.substring(7).trim() : "";
        if (token.isBlank() || token.length() > 4096) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED", "Sign in to continue.");
            return false;
        }

        final UUID userId;
        try {
            Claims claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
            userId = UUID.fromString(claims.getSubject());
        } catch (JwtException | IllegalArgumentException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "UNAUTHENTICATED",
                    "Your session is invalid or has expired. Sign in again.");
            return false;
        }

        List<AccountPrincipal> sessions = jdbcTemplate.query(
                "SELECT u.id AS user_id, s.id AS session_id, s.device_id, u.username, u.email "
                        + "FROM sessions s JOIN users u ON u.id = s.user_id "
                        + "WHERE s.session_token = ? AND s.user_id = ? AND s.is_revoked = FALSE "
                        + "AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE",
                (result, row) -> new AccountPrincipal(
                        result.getObject("user_id", UUID.class), result.getObject("session_id", UUID.class),
                        result.getObject("device_id", UUID.class), result.getString("username"),
                        result.getString("email")),
                SessionTokenUtils.fingerprint(token), userId);
        if (sessions.isEmpty()) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "SESSION_REVOKED",
                    "Your session is no longer active. Sign in again.");
            return false;
        }
        request.setAttribute(ATTRIBUTE, sessions.get(0));
        response.setHeader("Cache-Control", "no-store");
        return true;
    }

    public static AccountPrincipal principal(HttpServletRequest request) {
        return (AccountPrincipal) request.getAttribute(ATTRIBUTE);
    }

    private void writeError(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }
}
