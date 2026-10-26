package com.securevault.auth;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AccountMfaService {
    private final JdbcTemplate jdbcTemplate;
    private final MfaCryptoService mfaCrypto;
    private final EmailChallengeSender emailSender;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    public AccountMfaService(JdbcTemplate jdbcTemplate, MfaCryptoService mfaCrypto,
                             EmailChallengeSender emailSender) {
        this.jdbcTemplate = jdbcTemplate;
        this.mfaCrypto = mfaCrypto;
        this.emailSender = emailSender;
    }

    public MfaStatus status(UUID userId) {
        return jdbcTemplate.queryForObject(
                "SELECT mfa_enabled, email FROM users WHERE id = ? AND is_active = TRUE",
                (result, row) -> new MfaStatus(result.getBoolean("mfa_enabled"),
                        emailSender.isConfigured(), maskEmail(result.getString("email"))), userId);
    }

    @Transactional
    public TotpSetup startTotpSetup(UUID userId, String currentPassword, String ipAddress) {
        MfaSetupAccount account = jdbcTemplate.queryForObject(
                "SELECT mfa_enabled, password_hash FROM users WHERE id = ? AND is_active = TRUE FOR UPDATE",
                (result, row) -> new MfaSetupAccount(result.getBoolean("mfa_enabled"),
                        result.getString("password_hash")), userId);
        if (account == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Account was not found.");
        if (account.mfaEnabled()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Authenticator MFA is already enabled.");
        if (currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwordEncoder.matches(currentPassword, account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Password could not be verified.");
        }
        String[] identity = jdbcTemplate.queryForObject(
                "SELECT username, email FROM users WHERE id = ?",
                (result, row) -> new String[] { result.getString("username"), result.getString("email") }, userId);
        String secret = mfaCrypto.newSecret();
        jdbcTemplate.update("UPDATE users SET mfa_pending_secret = ? WHERE id = ?",
                mfaCrypto.encryptSecret(secret), userId);
        writeAudit(userId, "MFA_TOTP_SETUP_STARTED", ipAddress, "Authenticator enrollment started");
        return new TotpSetup(secret, mfaCrypto.otpauthUri(identity[1] == null ? identity[0] : identity[1], secret));
    }

    @Transactional
    public void confirmTotp(UUID userId, String code, String ipAddress) {
        PendingSetup pending = jdbcTemplate.queryForObject(
                "SELECT mfa_pending_secret FROM users WHERE id = ? AND is_active = TRUE FOR UPDATE",
                (result, row) -> new PendingSetup(result.getString("mfa_pending_secret")), userId);
        if (pending == null || pending.encryptedSecret() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Start authenticator setup before confirming it.");
        }
        String secret = mfaCrypto.decryptSecret(pending.encryptedSecret());
        long step = mfaCrypto.matchingTotpStep(secret, code, Instant.now(), -1);
        if (step < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The authenticator code is invalid or expired.");
        }
        jdbcTemplate.update("UPDATE users SET mfa_enabled = TRUE, mfa_secret = mfa_pending_secret, "
                        + "mfa_pending_secret = NULL, mfa_last_totp_step = ? WHERE id = ?",
                step, userId);
        writeAudit(userId, "MFA_TOTP_ENABLED", ipAddress, "Authenticator MFA enabled");
    }

    @Transactional
    public void disableTotp(UUID userId, String currentPassword, String code, String ipAddress) {
        MfaAccount account = jdbcTemplate.queryForObject(
                "SELECT password_hash, mfa_enabled, mfa_secret, mfa_last_totp_step "
                        + "FROM users WHERE id = ? AND is_active = TRUE FOR UPDATE",
                (result, row) -> new MfaAccount(result.getString("password_hash"),
                        result.getBoolean("mfa_enabled"), result.getString("mfa_secret"),
                        result.getObject("mfa_last_totp_step", Long.class)), userId);
        if (!account.mfaEnabled()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Authenticator MFA is not enabled.");
        }
        if (currentPassword == null || currentPassword.getBytes(StandardCharsets.UTF_8).length > 72
                || !passwordEncoder.matches(currentPassword, account.passwordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Password could not be verified.");
        }
        String secret = mfaCrypto.decryptSecret(account.mfaSecret());
        long lastStep = account.lastTotpStep() == null ? -1 : account.lastTotpStep();
        long step = mfaCrypto.matchingTotpStep(secret, code, Instant.now(), lastStep);
        if (step < 0) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authenticator code could not be verified.");
        }
        jdbcTemplate.update("UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, "
                        + "mfa_pending_secret = NULL, mfa_last_totp_step = NULL WHERE id = ?",
                userId);
        writeAudit(userId, "MFA_TOTP_DISABLED", ipAddress, "Authenticator MFA disabled after re-verification");
    }

    private String maskEmail(String email) {
        if (email == null) return "unavailable";
        int separator = email.lastIndexOf('@');
        if (separator <= 0) return "unavailable";
        String name = email.substring(0, separator);
        String visible = name.length() <= 2 ? name.substring(0, 1) : name.substring(0, 2);
        return visible + "***" + email.substring(separator);
    }

    private void writeAudit(UUID userId, String action, String ipAddress, String details) {
        String ip = ipAddress == null || ipAddress.isBlank() ? "unknown"
                : ipAddress.length() <= 45 ? ipAddress : ipAddress.substring(0, 45);
        jdbcTemplate.update("INSERT INTO audit_logs (user_id, action_type, status, ip_address, details) "
                        + "VALUES (?, ?, 'SUCCESS', ?, ?)", userId, action, ip, details);
    }

    public record MfaStatus(boolean totpEnabled, boolean emailChallengeAvailable, String maskedEmail) {}
    public record TotpSetup(String secret, String otpauthUri) {}
    private record PendingSetup(String encryptedSecret) {}
    private record MfaSetupAccount(boolean mfaEnabled, String passwordHash) {}
    private record MfaAccount(String passwordHash, boolean mfaEnabled, String mfaSecret, Long lastTotpStep) {}
}
