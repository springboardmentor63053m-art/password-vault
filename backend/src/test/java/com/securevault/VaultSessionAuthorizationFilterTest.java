package com.securevault;

import com.securevault.common.VaultSessionAuthorizationFilter;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Encoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
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

class VaultSessionAuthorizationFilterTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID userId = UUID.randomUUID();
    private final SecretKey key = Keys.hmacShaKeyFor(new byte[32]);
    private VaultSessionAuthorizationFilter filter;

    @BeforeEach
    void setup() {
        filter = new VaultSessionAuthorizationFilter(jdbc, Encoders.BASE64.encode(key.getEncoded()));
    }

    @Test
    void missingTokenIsUnauthorized() throws Exception {
        var response = invoke(null);
        assertEquals(401, response.getStatus());
        verifyNoInteractions(jdbc);
    }

    @Test
    void expiredJwtIsUnauthorizedWithoutSessionLookup() throws Exception {
        var response = invoke(token(true));
        assertEquals(401, response.getStatus());
        verifyNoInteractions(jdbc);
    }

    @Test
    void identityComesFromJwtAndRequiresActiveDatabaseSession() throws Exception {
        String token = token(false);
        when(jdbc.queryForObject(contains("FROM sessions"), eq(Boolean.class),
                eq(userId), eq(fingerprint(token)))).thenReturn(true);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/vault/credentials");
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, (req, res) -> ((MockHttpServletResponse) res).setStatus(200));

        assertEquals(200, response.getStatus());
        assertEquals(userId, request.getAttribute(VaultSessionAuthorizationFilter.USER_ID_ATTRIBUTE));
        verify(jdbc).queryForObject(contains("s.is_revoked = FALSE"), eq(Boolean.class),
                eq(userId), eq(fingerprint(token)));
    }

    @Test
    void revokedOrMissingDatabaseSessionIsUnauthorized() throws Exception {
        String token = token(false);
        when(jdbc.queryForObject(contains("FROM sessions"), eq(Boolean.class),
                eq(userId), eq(fingerprint(token)))).thenReturn(false);
        var response = invoke(token);
        assertEquals(401, response.getStatus());
    }

    private MockHttpServletResponse invoke(String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/vault/credentials");
        if (token != null) request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> ((MockHttpServletResponse) res).setStatus(200));
        return response;
    }

    private String token(boolean expired) {
        Instant now = Instant.now();
        return Jwts.builder().subject(userId.toString())
                .issuedAt(Date.from(now.minusSeconds(30)))
                .expiration(Date.from(expired ? now.minusSeconds(5) : now.plusSeconds(60)))
                .signWith(key).compact();
    }

    private String fingerprint(String token) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}
