package com.securevault;

import com.securevault.auth.LoginService;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LoginServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ResultSet row = mock(ResultSet.class);
    private final UUID userId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private LoginService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() throws Exception {
        byte[] key = new byte[48];
        new java.security.SecureRandom().nextBytes(key);
        service = new LoginService(jdbc, Base64.getEncoder().encodeToString(key), 900);
        when(row.getObject("id", UUID.class)).thenReturn(userId);
        when(row.getString("username")).thenReturn("alice");
        when(row.getString("email")).thenReturn("alice@example.com");
        when(row.getString("password_hash")).thenReturn(new BCryptPasswordEncoder().encode("correct-password"));
        when(row.getBoolean("is_active")).thenReturn(true);
        when(row.getBoolean("mfa_enabled")).thenReturn(false);
        when(row.getInt("failed_login_attempts")).thenReturn(0);
        when(row.getObject("locked_until", OffsetDateTime.class)).thenReturn(null);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(row, 0));
        });
        when(jdbc.queryForObject(contains("FROM devices"), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
        when(jdbc.queryForObject(contains("FROM audit_logs"), eq(Long.class), any(Object[].class)))
                .thenReturn(1L);
        when(jdbc.queryForObject(contains("SELECT id FROM devices"), eq(UUID.class), any(Object[].class)))
                .thenReturn(deviceId);
    }

    @Test
    void rejectsThePublicDevelopmentJwtKey() {
        String publicKey = Base64.getEncoder().encodeToString(
                "securevault-team3-development-key-change-me-48-bytes-secret!"
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThrows(IllegalArgumentException.class, () -> new LoginService(jdbc, publicKey, 900));
    }

    @Test
    void mfaAccountsNeverReceivePasswordOnlyTokens() throws Exception {
        when(row.getBoolean("mfa_enabled")).thenReturn(true);
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertFalse(result.authenticated());
        assertNull(result.response());
        assertEquals("MFA_SETUP_REQUIRED", result.errorCode());
        verify(jdbc, never()).update(contains("INSERT INTO sessions"), any(Object[].class));
    }

    @Test
    void expiredLockoutStartsANewFailureCount() throws Exception {
        when(row.getInt("failed_login_attempts")).thenReturn(5);
        when(row.getObject("locked_until", OffsetDateTime.class)).thenReturn(OffsetDateTime.now().minusMinutes(1));
        assertEquals(401, service.authenticate("alice", "wrong-password", "127.0.0.1", "test").status().value());
        verify(jdbc).update(
                "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                1, null, userId);
    }

    @Test
    void activeLockoutUsesGenericFailure() throws Exception {
        when(row.getObject("locked_until", OffsetDateTime.class)).thenReturn(OffsetDateTime.now().plusMinutes(1));
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertFalse(result.authenticated());
        assertEquals(401, result.status().value());
    }

    @Test
    void successfulAuthenticationIssuesTokenAndResetsFailureCount() throws Exception {
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertTrue(result.authenticated());
        assertNotNull(result.response());
        assertEquals("Bearer", result.response().tokenType());
        verify(jdbc).update(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                userId);
    }

    @Test
    void firstLoginFromAnUnrecognizedDeviceRequiresEmailWhenTOTPIsNotEnabled() {
        when(jdbc.queryForObject(contains("FROM devices"), eq(Long.class), any(Object[].class)))
                .thenReturn(0L);
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertFalse(result.authenticated());
        assertEquals(503, result.status().value());
        assertEquals("MFA_EMAIL_UNAVAILABLE", result.errorCode());
        verify(jdbc, never()).update(contains("INSERT INTO sessions"), any(Object[].class));
    }
}
