package com.securevault.login;

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
    private LoginService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setup() throws Exception {
        byte[] key = new byte[48];
        new java.security.SecureRandom().nextBytes(key);
        service = new LoginService(jdbc, Base64.getEncoder().encodeToString(key), 900);
        when(row.getObject("id", UUID.class)).thenReturn(userId);
        when(row.getString("password_hash")).thenReturn(new BCryptPasswordEncoder().encode("correct-password"));
        when(row.getBoolean("is_active")).thenReturn(true);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
            RowMapper<?> mapper = invocation.getArgument(1);
            return List.of(mapper.mapRow(row, 0));
        });
    }

    @Test
    void mfaAccountsNeverReceivePasswordOnlyTokens() throws Exception {
        when(row.getBoolean("mfa_enabled")).thenReturn(true);
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertFalse(result.authenticated());
        assertNull(result.response());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void expiredLockoutStartsANewFailureCount() throws Exception {
        when(row.getInt("failed_login_attempts")).thenReturn(5);
        when(row.getObject("locked_until", OffsetDateTime.class)).thenReturn(OffsetDateTime.now().minusMinutes(1));
        assertEquals(401, service.authenticate("alice", "wrong-password", "127.0.0.1", "test").status());
        verify(jdbc).update(
                "UPDATE users SET failed_login_attempts = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                1, userId);
    }

    @Test
    void activeLockoutUsesGenericFailure() throws Exception {
        when(row.getObject("locked_until", OffsetDateTime.class)).thenReturn(OffsetDateTime.now().plusMinutes(1));
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertEquals(401, result.status());
        assertEquals("INVALID_CREDENTIALS", result.errorCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void passwordOnlyAccountsStillReceiveTokensAndPersistSessions() {
        var result = service.authenticate("alice", "correct-password", "127.0.0.1", "test");
        assertTrue(result.authenticated());
        assertNotNull(result.response().accessToken());
        assertEquals(200, result.status());
        verify(jdbc).update(startsWith("INSERT INTO sessions"), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void unknownAccountsUseGenericFailureAndNeverCreateSessions() {
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());
        var result = service.authenticate("unknown", "wrong-password", "127.0.0.1", "test");
        assertEquals(401, result.status());
        assertEquals("INVALID_CREDENTIALS", result.errorCode());
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void rejectsOverlongUtf8PasswordsBeforeDatabaseAccess() {
        var result = service.authenticate("alice", "\u00e9".repeat(37), "127.0.0.1", "test");
        assertFalse(result.authenticated());
        assertEquals(401, result.status());
        verifyNoInteractions(jdbc);
    }

    @Test
    void rejectsUnsafeTokenLifetimes() {
        byte[] key = new byte[48];
        new java.security.SecureRandom().nextBytes(key);
        String secret = Base64.getEncoder().encodeToString(key);
        assertThrows(IllegalArgumentException.class, () -> new LoginService(jdbc, secret, 0));
        assertThrows(IllegalArgumentException.class, () -> new LoginService(jdbc, secret, 3601));
    }

    @Test
    void rejectsPublishedDevelopmentKey() {
        String publishedKey = Base64.getEncoder().encodeToString(
                "securevault-team3-development-key-change-me-32-bytes!".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        assertThrows(IllegalArgumentException.class, () -> new LoginService(jdbc, publishedKey, 900));
    }
}
