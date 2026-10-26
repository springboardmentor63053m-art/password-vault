package com.securevault.auth;

import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AccountMfaServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final EmailChallengeSender emailSender = mock(EmailChallengeSender.class);
    private final ResultSetRow rows = new ResultSetRow();
    private final UUID userId = UUID.randomUUID();
    private MfaCryptoService crypto;
    private AccountMfaService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() throws Exception {
        byte[] key = new byte[48];
        new java.security.SecureRandom().nextBytes(key);
        crypto = new MfaCryptoService(Base64.getEncoder().encodeToString(key));
        service = new AccountMfaService(jdbc, crypto, emailSender);
        when(rows.result.getBoolean("mfa_enabled")).thenReturn(false);
        when(rows.result.getString("password_hash"))
                .thenReturn(new BCryptPasswordEncoder().encode("account-password"));
        when(jdbc.queryForObject(contains("SELECT mfa_enabled, password_hash"),
                any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    return mapper.mapRow(rows.result, 0);
                });
        when(jdbc.queryForObject(contains("SELECT username, email"),
                any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
                    RowMapper<?> mapper = invocation.getArgument(1);
                    when(rows.result.getString("username")).thenReturn("alice");
                    when(rows.result.getString("email")).thenReturn("alice@example.com");
                    return mapper.mapRow(rows.result, 0);
                });
    }

    @Test
    void refusesToStartEnrollmentWithoutTheCurrentAccountPassword() {
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.startTotpSetup(userId, "wrong-password", "192.0.2.7"));

        assertEquals(401, error.getStatusCode().value());
        verify(jdbc, never()).update(contains("mfa_pending_secret"), any(Object[].class));
    }

    @Test
    void storesTheNewAuthenticatorSeedEncryptedAndConfirmsAValidCode() throws Exception {
        var setup = service.startTotpSetup(userId, "account-password", "192.0.2.7");
        ArgumentCaptor<Object[]> pendingArgs = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("mfa_pending_secret"), pendingArgs.capture());
        String storedSecret = (String) pendingArgs.getValue()[0];
        assertTrue(crypto.isEncrypted(storedSecret));
        assertEquals(setup.secret(), crypto.decryptSecret(storedSecret));
        assertTrue(setup.otpauthUri().contains("alice%40example.com"));

        when(jdbc.queryForObject(contains("SELECT mfa_pending_secret"),
                any(RowMapper.class), any(Object[].class))).thenAnswer(invocation -> {
                    when(rows.result.getString("mfa_pending_secret")).thenReturn(storedSecret);
                    RowMapper<?> mapper = invocation.getArgument(1);
                    return mapper.mapRow(rows.result, 0);
                });
        long currentStep = Instant.now().getEpochSecond() / 30;
        String code = MfaCryptoService.codeForStep(setup.secret(), currentStep);

        service.confirmTotp(userId, code, "192.0.2.7");

        verify(jdbc).update(contains("SET mfa_enabled = TRUE"), eq(currentStep), eq(userId));
    }

    private static class ResultSetRow {
        private final java.sql.ResultSet result = mock(java.sql.ResultSet.class);
    }
}
