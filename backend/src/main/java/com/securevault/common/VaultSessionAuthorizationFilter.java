package com.securevault.common;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticates vault requests against both the signed JWT and its active database session. */
@Component
public class VaultSessionAuthorizationFilter extends OncePerRequestFilter {
    public static final String USER_ID_ATTRIBUTE = VaultSessionAuthorizationFilter.class.getName() + ".userId";

    private final JdbcTemplate jdbcTemplate;
    private final SecretKey signingKey;

    public VaultSessionAuthorizationFilter(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64) {
        this.jdbcTemplate = jdbcTemplate;
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !path.startsWith("/api/vault/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }

        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Authentication required");
            return;
        }

        try {
            String token = header.substring(7).trim();
            Claims claims = Jwts.parser().verifyWith(signingKey).build()
                    .parseSignedClaims(token).getPayload();
            UUID userId = UUID.fromString(claims.getSubject());
            Boolean activeSession = jdbcTemplate.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM sessions s JOIN users u ON u.id = s.user_id "
                    + "WHERE s.user_id = ? AND s.session_token = ? AND s.is_revoked = FALSE "
                    + "AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE)",
                    Boolean.class, userId, fingerprint(token));
            if (!Boolean.TRUE.equals(activeSession)) {
                writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired session");
                return;
            }
            request.setAttribute(USER_ID_ATTRIBUTE, userId);
            filterChain.doFilter(request, response);
        } catch (JwtException | IllegalArgumentException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED, "Invalid or expired token");
        }
    }

    private String fingerprint(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private void writeError(HttpServletResponse response, int status, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }
}
