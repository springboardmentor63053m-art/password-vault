package com.securevault.admin;

import com.securevault.common.SecurityEventRecorder;
import com.securevault.common.SessionTokenUtils;
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
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/** Authenticates administrator routes in the Spring Security chain using SecureVault sessions. */
public class AdminSessionAuthenticationFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbcTemplate;
    private final SecretKey signingKey;
    private final SecurityEventRecorder eventRecorder;

    public AdminSessionAuthenticationFilter(JdbcTemplate jdbcTemplate, String secretBase64,
                                            SecurityEventRecorder eventRecorder) {
        this.jdbcTemplate = jdbcTemplate;
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretBase64.trim()));
        this.eventRecorder = eventRecorder;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith(request.getContextPath() + "/api/admin/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        String token = authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)
                ? authorization.substring(7).trim() : "";
        try {
            if (!token.isBlank() && token.length() <= 4096) {
                Claims claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token).getPayload();
                UUID userId = UUID.fromString(claims.getSubject());
                Integer activeAdminSession = jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM sessions s JOIN users u ON u.id = s.user_id "
                                + "WHERE s.session_token = ? AND s.user_id = ? AND s.is_revoked = FALSE "
                                + "AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE "
                                + "AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id "
                                + "WHERE ur.user_id = u.id AND r.role_name = 'ROLE_ADMIN')",
                        Integer.class, SessionTokenUtils.fingerprint(token), userId);
                if (activeAdminSession != null && activeAdminSession > 0) {
                    UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                            userId, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                } else {
                    eventRecorder.recordAccessDenied(request);
                }
            } else {
                eventRecorder.recordAccessDenied(request);
            }
        } catch (JwtException | IllegalArgumentException exception) {
            eventRecorder.recordAccessDenied(request);
        }
        chain.doFilter(request, response);
    }
}
