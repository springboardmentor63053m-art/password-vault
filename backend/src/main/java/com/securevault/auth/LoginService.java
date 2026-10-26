package com.securevault.auth;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import com.securevault.common.SessionTokenUtils;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import java.security.SecureRandom;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;
    private static final int MAX_MFA_ATTEMPTS = 5;
    private static final int MFA_CHALLENGE_MINUTES = 5;
    private static final int MAX_EMAIL_CHALLENGES_PER_10_MINUTES = 3;

    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final BCryptPasswordEncoder challengeCodeEncoder = new BCryptPasswordEncoder(10);
    private final SecureRandom secureRandom = new SecureRandom();
    private final String dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    private final SecretKey signingKey;
    private final long expirationSeconds;
    private final EmailChallengeSender emailChallengeSender;
    private final MfaCryptoService mfaCrypto;

    public LoginService(JdbcTemplate jdbcTemplate, String secretBase64, long expirationSeconds) {
        this(jdbcTemplate, secretBase64, expirationSeconds, null, new MfaCryptoService(secretBase64));
    }

    @Autowired
    public LoginService(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64,
            @Value("${security.jwt.expiration-seconds}") long expirationSeconds,
            EmailChallengeSender emailChallengeSender,
            MfaCryptoService mfaCrypto) {
        this.jdbcTemplate = jdbcTemplate;
        if (secretBase64 == null || secretBase64.isBlank()) {
            throw new IllegalArgumentException("JWT_SECRET_BASE64 must be set to a random secret key.");
        }
        byte[] keyBytes = Decoders.BASE64.decode(secretBase64.trim());
        String decodedKey = new String(keyBytes, StandardCharsets.UTF_8);
        if (decodedKey.equals("securevault-team3-development-key-change-me-48-bytes-secret!")
                || decodedKey.equals("securevault-team3-development-key-change-me-32-bytes!")) {
            throw new IllegalArgumentException("The public development JWT key must be replaced.");
        }
        if (keyBytes.length < 48) {
            throw new IllegalArgumentException("JWT_SECRET_BASE64 must decode to at least 48 random bytes.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        if (expirationSeconds <= 0 || expirationSeconds > 3600) {
            throw new IllegalArgumentException("JWT expiration must be between 1 and 3600 seconds.");
        }
        this.expirationSeconds = expirationSeconds;
        this.emailChallengeSender = emailChallengeSender;
        this.mfaCrypto = mfaCrypto;
    }

    @Transactional
    public AuthenticationResult authenticate(String requestedIdentifier, String password, String ipAddress, String userAgent) {
        return authenticate(requestedIdentifier, password, ipAddress, userAgent, null);
    }

    @Transactional
    public AuthenticationResult authenticate(String requestedIdentifier, String password, String ipAddress,
                                             String userAgent, String clientDeviceId) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            passwordEncoder.matches("invalid-password", dummyHash);
            recordLoginFailure(null, ipAddress, 25, "MEDIUM");
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }
        String identifier = requestedIdentifier.trim().toLowerCase(Locale.ROOT);
        List<UserRecord> matches = jdbcTemplate.query(
                "SELECT id, username, email, password_hash, failed_login_attempts, locked_until, is_active, "
                        + "mfa_enabled, mfa_secret "
                        + "FROM users WHERE lower(username) = ? OR lower(email) = ? LIMIT 2 FOR UPDATE",
                (resultSet, rowNumber) -> new UserRecord(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("username"),
                        resultSet.getString("email"),
                        resultSet.getString("password_hash"),
                        resultSet.getInt("failed_login_attempts"),
                        resultSet.getObject("locked_until", OffsetDateTime.class),
                        resultSet.getBoolean("is_active"),
                        resultSet.getBoolean("mfa_enabled"),
                        resultSet.getString("mfa_secret")),
                identifier,
                identifier);

        if (matches.size() != 1) {
            passwordEncoder.matches(password, dummyHash);
            recordLoginFailure(null, ipAddress, 25, "MEDIUM");
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        UserRecord user = matches.get(0);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (user.lockedUntil() != null && user.lockedUntil().isAfter(now)) {
            passwordEncoder.matches(password, dummyHash);
            recordLoginFailure(user.id(), ipAddress, 100, "CRITICAL");
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        if (!user.isActive()) {
            passwordEncoder.matches(password, dummyHash);
            recordLoginFailure(user.id(), ipAddress, 50, "HIGH");
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        boolean matchesPassword = passwordEncoder.matches(password, user.passwordHash());
        if (!matchesPassword) {
            int newAttempts = user.lockedUntil() != null && user.lockedUntil().isBefore(now)
                    ? 1
                    : user.failedLoginAttempts() + 1;
            OffsetDateTime lockUntil = newAttempts >= MAX_FAILED_ATTEMPTS
                    ? now.plusMinutes(LOCKOUT_MINUTES)
                    : null;
            jdbcTemplate.update(
                    "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                    newAttempts, lockUntil, user.id());
            String severity = newAttempts >= MAX_FAILED_ATTEMPTS ? "CRITICAL"
                    : newAttempts >= 3 ? "HIGH" : "MEDIUM";
            recordLoginFailure(user.id(), ipAddress, Math.min(100, newAttempts * 20), severity);
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        jdbcTemplate.update(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                user.id());
        boolean newDevice = !knownDevice(user.id(), userAgent, clientDeviceId);
        boolean newIp = isNewIp(user.id(), ipAddress);
        boolean unusualLogin = isUnusualLoginTime(user.id(), now);

        if (user.mfaEnabled()) {
            if (user.mfaSecret() == null || user.mfaSecret().isBlank()) {
                return failure(HttpStatus.SERVICE_UNAVAILABLE, "MFA_SETUP_REQUIRED",
                        "Authenticator setup needs to be restored before this account can sign in.");
            }
            return issueChallenge(user, "TOTP", ipAddress, userAgent, clientDeviceId);
        }
        if (newDevice || newIp || unusualLogin) {
            if (emailChallengeSender == null || !emailChallengeSender.isConfigured()) {
                return failure(HttpStatus.SERVICE_UNAVAILABLE, "MFA_EMAIL_UNAVAILABLE",
                        "This sign-in needs an email verification code, but email delivery is not configured.");
            }
            return issueChallenge(user, "EMAIL", ipAddress, userAgent, clientDeviceId);
        }
        return completeLogin(user.id(), user.username(), user.email(), ipAddress, userAgent, clientDeviceId,
                "PASSWORD", newDevice, newIp, unusualLogin);
    }

    private AuthenticationResult failure(HttpStatus status, String code, String message) {
        return new AuthenticationResult(false, status, code, message, null);
    }

    private AuthenticationResult issueChallenge(UserRecord user, String method, String ipAddress,
                                                String userAgent, String clientDeviceId) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if ("EMAIL".equals(method)) {
            Long recentChallenges = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM login_mfa_challenges WHERE user_id = ? AND method = 'EMAIL' "
                            + "AND issued_at >= CURRENT_TIMESTAMP - INTERVAL '10 minutes'",
                    Long.class, user.id());
            if (recentChallenges != null && recentChallenges >= MAX_EMAIL_CHALLENGES_PER_10_MINUTES) {
                return failure(HttpStatus.TOO_MANY_REQUESTS, "MFA_RATE_LIMITED",
                        "Too many email codes were requested. Wait a few minutes and try again.");
            }
        }

        jdbcTemplate.update("DELETE FROM login_mfa_challenges WHERE issued_at < CURRENT_TIMESTAMP - INTERVAL '1 day'");
        UUID challengeId = UUID.randomUUID();
        String code = "EMAIL".equals(method)
                ? String.format(Locale.ROOT, "%06d", secureRandom.nextInt(1_000_000)) : null;
        String codeHash = code == null ? null : challengeCodeEncoder.encode(code);
        String ip = safeIp(ipAddress);
        jdbcTemplate.update(
                "INSERT INTO login_mfa_challenges "
                        + "(id, user_id, method, code_hash, expires_at, ip_address, device_fingerprint) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?)",
                challengeId, user.id(), method, codeHash, now.plusMinutes(MFA_CHALLENGE_MINUTES), ip,
                deviceFingerprint(userAgent, clientDeviceId));

        if (code != null) {
            try {
                emailChallengeSender.sendLoginCode(user.email(), code);
            } catch (RuntimeException exception) {
                jdbcTemplate.update("DELETE FROM login_mfa_challenges WHERE id = ?", challengeId);
                writeLoginAudit(user.id(), "LOGIN_MFA_EMAIL_FAILURE", "FAILURE", ip,
                        "Email verification could not be delivered");
                return failure(HttpStatus.SERVICE_UNAVAILABLE, "MFA_EMAIL_UNAVAILABLE",
                        "The email verification code could not be sent. Check email settings or use an authenticator app.");
            }
        }

        writeLoginAudit(user.id(), "LOGIN_MFA_CHALLENGE", "SUCCESS", ip,
                "Sign-in verification requested using " + method);
        MfaChallengeResponse challenge = new MfaChallengeResponse(
                true, challengeId, method, "EMAIL".equals(method) ? maskEmail(user.email()) : null,
                now.plusMinutes(MFA_CHALLENGE_MINUTES).toInstant());
        return new AuthenticationResult(false, HttpStatus.ACCEPTED, null, null, null, challenge);
    }

    @Transactional
    public AuthenticationResult verifyMfaChallenge(UUID challengeId, String code, String ipAddress,
                                                   String userAgent, String clientDeviceId) {
        List<MfaChallengeRecord> rows;
        try {
            rows = jdbcTemplate.query(
                    "SELECT c.id, c.user_id, c.method, c.code_hash, c.expires_at, c.attempt_count, "
                            + "c.completed_at, c.ip_address, c.device_fingerprint, u.username, u.email, "
                            + "u.is_active, u.mfa_enabled, u.mfa_secret, u.mfa_last_totp_step "
                            + "FROM login_mfa_challenges c JOIN users u ON u.id = c.user_id "
                            + "WHERE c.id = ? FOR UPDATE OF c, u",
                    (result, row) -> new MfaChallengeRecord(
                            result.getObject("id", UUID.class), result.getObject("user_id", UUID.class),
                            result.getString("method"), result.getString("code_hash"),
                            result.getObject("expires_at", OffsetDateTime.class),
                            result.getInt("attempt_count"), result.getObject("completed_at") != null,
                            result.getString("ip_address"), result.getString("device_fingerprint"),
                            result.getString("username"), result.getString("email"),
                            result.getBoolean("is_active"), result.getBoolean("mfa_enabled"),
                            result.getString("mfa_secret"), result.getObject("mfa_last_totp_step", Long.class)),
                    challengeId);
        } catch (EmptyResultDataAccessException exception) {
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }
        if (rows.isEmpty()) {
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }
        MfaChallengeRecord challenge = rows.get(0);
        if (!challenge.active() || challenge.completed() || challenge.attemptCount() >= MAX_MFA_ATTEMPTS
                || challenge.expiresAt().isBefore(OffsetDateTime.now(ZoneOffset.UTC))) {
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }
        String ip = safeIp(ipAddress);
        String fingerprint = deviceFingerprint(userAgent, clientDeviceId);
        if (!Objects.equals(challenge.ipAddress(), ip)
                || !constantTimeEquals(challenge.deviceFingerprint(), fingerprint)) {
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }

        boolean valid;
        long matchedStep = -1;
        String method = challenge.method();
        if ("EMAIL".equals(method)) {
            valid = !challenge.mfaEnabled() && challenge.codeHash() != null
                    && challengeCodeEncoder.matches(code, challenge.codeHash());
        } else if ("TOTP".equals(method) && challenge.mfaEnabled() && challenge.mfaSecret() != null) {
            try {
                String secret = mfaCrypto.decryptSecret(challenge.mfaSecret());
                long lastStep = challenge.lastTotpStep() == null ? -1 : challenge.lastTotpStep();
                matchedStep = mfaCrypto.matchingTotpStep(secret, code, Instant.now(), lastStep);
                valid = matchedStep >= 0;
                if (valid && !mfaCrypto.isEncrypted(challenge.mfaSecret())) {
                    jdbcTemplate.update("UPDATE users SET mfa_secret = ? WHERE id = ?",
                            mfaCrypto.encryptSecret(secret), challenge.userId());
                }
            } catch (RuntimeException exception) {
                return failure(HttpStatus.SERVICE_UNAVAILABLE, "MFA_UNAVAILABLE",
                        "Authenticator verification is temporarily unavailable.");
            }
        } else {
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }

        if (!valid) {
            int failures = challenge.attemptCount() + 1;
            jdbcTemplate.update("UPDATE login_mfa_challenges SET attempt_count = ? WHERE id = ?",
                    failures, challenge.id());
            writeLoginAudit(challenge.userId(), "LOGIN_MFA_FAILURE", "FAILURE", ip,
                    "Sign-in verification code rejected");
            if (failures >= 3) {
                recordSecurityEvent(challenge.userId(), "MFA_FAILURE", failures >= MAX_MFA_ATTEMPTS
                        ? "CRITICAL" : "HIGH", failures >= MAX_MFA_ATTEMPTS ? 95 : 75, true, ip);
            }
            return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
        }

        if (matchedStep >= 0) {
            int advanced = jdbcTemplate.update("UPDATE users SET mfa_last_totp_step = ? WHERE id = ? "
                            + "AND (mfa_last_totp_step IS NULL OR mfa_last_totp_step < ?)",
                    matchedStep, challenge.userId(), matchedStep);
            if (advanced != 1) {
                return failure(HttpStatus.UNAUTHORIZED, "MFA_INVALID", "The verification code is invalid or expired.");
            }
        }
        jdbcTemplate.update("UPDATE login_mfa_challenges SET completed_at = CURRENT_TIMESTAMP WHERE id = ?",
                challenge.id());
        boolean newDevice = !knownDevice(challenge.userId(), userAgent, clientDeviceId);
        boolean newIp = isNewIp(challenge.userId(), ip);
        boolean unusualLogin = isUnusualLoginTime(challenge.userId(), OffsetDateTime.now(ZoneOffset.UTC));
        return completeLogin(challenge.userId(), challenge.username(), challenge.email(), ipAddress,
                userAgent, clientDeviceId, method, newDevice, newIp, unusualLogin);
    }

    private AuthenticationResult completeLogin(UUID userId, String username, String email,
                                               String ipAddress, String userAgent, String clientDeviceId,
                                               String factor, boolean newDevice, boolean newIp,
                                               boolean unusualLogin) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);
        String token = Jwts.builder()
                .subject(userId.toString())
                .claim("username", username)
                .claim("email", email)
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();

        DeviceRegistration device = registerDevice(userId, userAgent, clientDeviceId);
        String sessionFingerprint = SessionTokenUtils.fingerprint(token);
        jdbcTemplate.update(
                "INSERT INTO sessions (user_id, device_id, session_token, ip_address, user_agent, expires_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                userId, device.id(), sessionFingerprint, safeIp(ipAddress), userAgent,
                expiresAt.atOffset(ZoneOffset.UTC));
        writeLoginAudit(userId, "LOGIN", "SUCCESS", safeIp(ipAddress),
                "Successful sign in with " + factor + " verification");
        if (device.created() || newDevice) {
            recordSecurityEvent(userId, "NEW_DEVICE_LOGIN", "MEDIUM", 55, true, ipAddress);
        }
        if (newIp) {
            recordSecurityEvent(userId, "NEW_IP_LOGIN", "MEDIUM", 50, true, ipAddress);
        }
        if (unusualLogin) {
            recordSecurityEvent(userId, "UNUSUAL_LOGIN_TIME", "MEDIUM", 50, true, ipAddress);
        }
        return new AuthenticationResult(true, HttpStatus.OK, null, null,
                new AuthController.LoginResponse(token, "Bearer", expiresAt,
                        new AuthController.UserResponse(userId, username, email)));
    }

    private boolean knownDevice(UUID userId, String userAgent, String clientDeviceId) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM devices WHERE user_id = ? AND device_fingerprint = ?",
                Long.class, userId, deviceFingerprint(userAgent, clientDeviceId));
        return count != null && count > 0;
    }

    private boolean isNewIp(UUID userId, String ipAddress) {
        String ip = safeIp(ipAddress);
        if ("unknown".equals(ip)) return false;
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM audit_logs WHERE user_id = ? AND action_type = 'LOGIN' "
                        + "AND status = 'SUCCESS' AND ip_address = ?", Long.class, userId, ip);
        return count == null || count == 0;
    }

    private AuthenticationResult failure(HttpStatus status, String code, String message,
                                         MfaChallengeResponse challenge) {
        return new AuthenticationResult(false, status, code, message, null, challenge);
    }

    private String deviceFingerprint(String userAgent, String clientDeviceId) {
        String normalizedAgent = userAgent == null || userAgent.isBlank()
                ? "unknown-user-agent" : userAgent.trim().toLowerCase(Locale.ROOT);
        String normalizedClientId = clientDeviceId == null ? "" : clientDeviceId.trim();
        boolean validClientId = normalizedClientId.matches("[A-Za-z0-9._:-]{16,128}");
        return SessionTokenUtils.fingerprint(normalizedAgent + (validClientId ? "::" + normalizedClientId : ""));
    }

    private String maskEmail(String email) {
        if (email == null) return "unavailable";
        int separator = email.lastIndexOf('@');
        if (separator <= 0) return "unavailable";
        String local = email.substring(0, separator);
        return (local.length() <= 2 ? local.substring(0, 1) : local.substring(0, 2))
                + "***" + email.substring(separator);
    }

    private void writeLoginAudit(UUID userId, String action, String status, String ip, String details) {
        jdbcTemplate.update("INSERT INTO audit_logs (user_id, action_type, status, ip_address, details) "
                        + "VALUES (?, ?, ?, ?, ?)", userId, action, status, safeIp(ip), details);
    }

    public void revokeSession(String token, String ipAddress) {
        if (token == null || token.isBlank()) {
            return;
        }
        String fingerprint = SessionTokenUtils.fingerprint(token);
        int revoked = jdbcTemplate.update(
                "UPDATE sessions SET is_revoked = TRUE WHERE session_token = ? AND is_revoked = FALSE",
                fingerprint);
        if (revoked > 0) {
            jdbcTemplate.update(
                    "INSERT INTO audit_logs (action_type, status, ip_address, details) "
                            + "VALUES ('LOGOUT', 'SUCCESS', ?, 'Session signed out')",
                    safeIp(ipAddress));
        }
    }

    private DeviceRegistration registerDevice(UUID userId, String userAgent, String clientDeviceId) {
        String fingerprint = deviceFingerprint(userAgent, clientDeviceId);
        String deviceName = deviceName(userAgent);
        int inserted = jdbcTemplate.update(
                "INSERT INTO devices (user_id, device_name, device_fingerprint, is_trusted, last_active) "
                        + "VALUES (?, ?, ?, FALSE, CURRENT_TIMESTAMP) "
                        + "ON CONFLICT (user_id, device_fingerprint) DO NOTHING",
                userId, deviceName, fingerprint);
        UUID deviceId = jdbcTemplate.queryForObject(
                "SELECT id FROM devices WHERE user_id = ? AND device_fingerprint = ?",
                UUID.class, userId, fingerprint);
        jdbcTemplate.update("UPDATE devices SET last_active = CURRENT_TIMESTAMP WHERE id = ?", deviceId);
        return new DeviceRegistration(deviceId, inserted == 1);
    }

    private String deviceName(String userAgent) {
        String agent = userAgent == null ? "" : userAgent.toLowerCase(Locale.ROOT);
        String browser = agent.contains("edg/") ? "Edge"
                : agent.contains("firefox/") ? "Firefox"
                : agent.contains("chrome/") ? "Chrome"
                : agent.contains("safari/") ? "Safari"
                : "Unknown browser";
        String platform = agent.contains("android") ? "Android"
                : agent.contains("iphone") || agent.contains("ipad") ? "iOS"
                : agent.contains("windows") ? "Windows"
                : agent.contains("mac os") || agent.contains("macintosh") ? "macOS"
                : agent.contains("linux") ? "Linux"
                : "device";
        String name = browser + " on " + platform;
        return name.substring(0, Math.min(100, name.length()));
    }

    private void recordLoginFailure(UUID userId, String ipAddress, int riskScore, String severity) {
        String ip = safeIp(ipAddress);
        jdbcTemplate.update(
                "INSERT INTO audit_logs (user_id, action_type, status, ip_address, details) "
                        + "VALUES (?, 'LOGIN_FAILURE', 'FAILURE', ?, 'Sign in rejected')",
                userId, ip);
        jdbcTemplate.update(
                "INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected, ip_address) "
                        + "VALUES (?, 'FAILED_LOGIN', ?, ?, ?, ?)",
                userId, severity, riskScore, riskScore >= 80, ip);
        long recentFailures = countRecentFailures(userId, ip);
        if (recentFailures >= 5) {
            int escalated = jdbcTemplate.update(
                    "UPDATE security_events SET severity = 'CRITICAL', risk_score = 100, anomaly_detected = TRUE "
                            + "WHERE id = (SELECT id FROM security_events WHERE event_type = 'MULTIPLE_FAILED_LOGINS' "
                            + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '10 minutes' "
                            + "AND ip_address = ? AND user_id IS NOT DISTINCT FROM ? "
                            + "ORDER BY timestamp DESC LIMIT 1)", ip, userId);
            if (escalated == 0) {
                recordSecurityEvent(userId, "MULTIPLE_FAILED_LOGINS", "CRITICAL", 100, true, ip);
            }
        } else if (recentFailures >= 3 && !hasRecentAlert(userId, ip, "MULTIPLE_FAILED_LOGINS")) {
            recordSecurityEvent(userId, "MULTIPLE_FAILED_LOGINS", "HIGH",
                    (int) Math.min(100, recentFailures * 20), true, ip);
        }
    }

    private long countRecentFailures(UUID userId, String ip) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM security_events WHERE event_type = 'FAILED_LOGIN' "
                        + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '10 minutes' "
                        + "AND ip_address = ? AND user_id IS NOT DISTINCT FROM ?",
                Long.class, ip, userId);
        return count == null ? 0 : count;
    }

    private boolean hasRecentAlert(UUID userId, String ip, String eventType) {
        Long count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM security_events WHERE event_type = ? "
                        + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '10 minutes' "
                        + "AND ip_address = ? AND user_id IS NOT DISTINCT FROM ?",
                Long.class, eventType, ip, userId);
        return count != null && count > 0;
    }

    private boolean isUnusualLoginTime(UUID userId, OffsetDateTime now) {
        int hourUtc = now.withOffsetSameInstant(ZoneOffset.UTC).getHour();
        if (hourUtc < 0 || hourUtc >= 5) {
            return false;
        }
        long[] history = jdbcTemplate.queryForObject(
                "SELECT COUNT(*), COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM timestamp AT TIME ZONE 'UTC') < 5) "
                        + "FROM audit_logs WHERE user_id = ? AND action_type = 'LOGIN' AND status = 'SUCCESS' "
                        + "AND timestamp >= ?",
                (result, row) -> new long[] { result.getLong(1), result.getLong(2) },
                userId, now.minusDays(30));
        if (history == null || history[0] < 5 || history[1] > 0) {
            return false;
        }
        Long recentAlerts = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM security_events WHERE event_type = 'UNUSUAL_LOGIN_TIME' "
                        + "AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '24 hours' AND user_id = ?",
                Long.class, userId);
        return recentAlerts == null || recentAlerts == 0;
    }

    private void recordSecurityEvent(UUID userId, String eventType, String severity,
                                     int riskScore, boolean anomaly, String ipAddress) {
        jdbcTemplate.update(
                "INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected, ip_address) "
                        + "VALUES (?, ?, ?, ?, ?, ?)",
                userId, eventType, severity, riskScore, anomaly, safeIp(ipAddress));
    }

    private String safeIp(String ipAddress) {
        if (ipAddress == null || ipAddress.isBlank()) {
            return "unknown";
        }
        return ipAddress.length() <= 45 ? ipAddress : ipAddress.substring(0, 45);
    }

    private boolean constantTimeEquals(String first, String second) {
        if (first == null || second == null) return false;
        return java.security.MessageDigest.isEqual(
                first.getBytes(StandardCharsets.US_ASCII), second.getBytes(StandardCharsets.US_ASCII));
    }

    public record UserRecord(UUID id, String username, String email, String passwordHash,
                             int failedLoginAttempts, OffsetDateTime lockedUntil, boolean isActive,
                             boolean mfaEnabled, String mfaSecret) {}

    private record MfaChallengeRecord(UUID id, UUID userId, String method, String codeHash,
                                     OffsetDateTime expiresAt, int attemptCount, boolean completed,
                                     String ipAddress, String deviceFingerprint, String username, String email,
                                     boolean active, boolean mfaEnabled, String mfaSecret, Long lastTotpStep) {}

    private record DeviceRegistration(UUID id, boolean created) {}

    public record MfaChallengeResponse(boolean mfaRequired, UUID challengeId, String method,
                                       String maskedEmail, Instant expiresAt) {}

    public record AuthenticationResult(boolean authenticated, HttpStatus status, String errorCode,
                                      String message, AuthController.LoginResponse response,
                                      MfaChallengeResponse challenge) {
        public AuthenticationResult(boolean authenticated, HttpStatus status, String errorCode,
                                    String message, AuthController.LoginResponse response) {
            this(authenticated, status, errorCode, message, response, null);
        }
    }
}
