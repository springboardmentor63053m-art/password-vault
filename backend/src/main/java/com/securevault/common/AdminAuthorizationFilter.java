
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
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class AdminAuthorizationFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;
    private final SecretKey signingKey;

    public AdminAuthorizationFilter(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64) {

        this.jdbcTemplate = jdbcTemplate;
        this.signingKey = Keys.hmacShaKeyFor(
                Decoders.BASE64.decode(secretBase64));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI()
                .substring(request.getContextPath().length());

        return !path.startsWith("/api/admin/");
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String header = request.getHeader("Authorization");

        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }

        if (header == null || !header.startsWith("Bearer ")) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Authentication required");
            return;
        }

        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(header.substring(7).trim())
                    .getPayload();

            UUID userId = UUID.fromString(claims.getSubject());

            Boolean isAdmin = jdbcTemplate.queryForObject(
                    "SELECT EXISTS ("
                    + "SELECT 1 FROM user_roles ur "
                    + "JOIN roles r ON r.id = ur.role_id "
                    + "JOIN users u ON u.id = ur.user_id "
                    + "WHERE ur.user_id = ? "
                    + "AND r.role_name = 'ROLE_ADMIN' "
                    + "AND u.is_active = TRUE)",
                    Boolean.class,
                    userId);

            if (!Boolean.TRUE.equals(isAdmin)) {
                writeError(response, HttpServletResponse.SC_FORBIDDEN,
                        "Administrator access required");
                return;
            }

            filterChain.doFilter(request, response);

        } catch (JwtException | IllegalArgumentException exception) {
            writeError(response, HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid or expired token");
        }
    }

    private void writeError(
            HttpServletResponse response,
            int status,
            String message) throws IOException {

        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");

        response.getWriter().write(
                "{\"message\":\"" + message + "\"}");
    }
}
