package com.securevault.login;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.SecretKey;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCKOUT_MINUTES = 15;

    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final String dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    private final SecretKey signingKey;
    private final long expirationSeconds;

    public LoginService(
            JdbcTemplate jdbcTemplate,
            @Value("${security.jwt.secret-base64}") String secretBase64,
            @Value("${security.jwt.expiration-seconds}") long expirationSeconds) {
        this.jdbcTemplate = jdbcTemplate;
        byte[] keyBytes = Decoders.BASE64.decode(secretBase64);
        if (new String(keyBytes, StandardCharsets.UTF_8).equals(
                "securevault-team3-development-key-change-me-32-bytes!")) {
            throw new IllegalArgumentException("The public development JWT key must be replaced.");
        }
        this.signingKey = Keys.hmacShaKeyFor(keyBytes);
        if (expirationSeconds <= 0 || expirationSeconds > 3600) {
            throw new IllegalArgumentException("JWT expiration must be between 1 and 3600 seconds.");
        }
        this.expirationSeconds = expirationSeconds;
    }

    @Transactional
    public AuthenticationResult authenticate(String requestedIdentifier, String password, String ipAddress, String userAgent) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            passwordEncoder.matches("invalid-password", dummyHash);
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }
        String identifier = requestedIdentifier.trim().toLowerCase(Locale.ROOT);
        List<UserRecord> matches = jdbcTemplate.query(
                "SELECT id, username, email, password_hash, failed_login_attempts, locked_until, is_active, mfa_enabled "
                        + "FROM users WHERE lower(username) = ? OR lower(email) = ? LIMIT 2 FOR UPDATE",
                (resultSet, rowNumber) -> new UserRecord(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("username"),
                        resultSet.getString("email"),
                        resultSet.getString("password_hash"),
                        resultSet.getInt("failed_login_attempts"),
                        resultSet.getObject("locked_until", OffsetDateTime.class),
                        resultSet.getBoolean("is_active"),
                        resultSet.getBoolean("mfa_enabled")),
                identifier,
                identifier);

        if (matches.size() != 1) {
            passwordEncoder.matches(password, dummyHash);
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        UserRecord user = matches.get(0);
        if (!user.active()) {
            passwordEncoder.matches(password, dummyHash);
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        if (user.lockedUntil() != null && user.lockedUntil().isAfter(now)) {
            passwordEncoder.matches(password, dummyHash);
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        if (!passwordEncoder.matches(password, user.passwordHash())) {
            int failedAttempts = user.lockedUntil() != null ? 1 : user.failedLoginAttempts() + 1;
            OffsetDateTime lockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS ? now.plusMinutes(LOCKOUT_MINUTES) : null;
            if (lockedUntil == null) {
                jdbcTemplate.update(
                        "UPDATE users SET failed_login_attempts = ?, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        failedAttempts,
                        user.id());
            } else {
                jdbcTemplate.update(
                        "UPDATE users SET failed_login_attempts = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        failedAttempts,
                        lockedUntil,
                        user.id());
            }
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        // Fail closed until a second-factor challenge and verification flow exists.
        if (user.mfaEnabled()) {
            return failure(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", "Username/email or password is incorrect.");
        }

        jdbcTemplate.update(
                "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                user.id());

        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);
        UUID sessionId = UUID.randomUUID();
        String token = Jwts.builder()
                .id(sessionId.toString())
                .subject(user.id().toString())
                .claim("username", user.username())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();

        String normalizedIp = ipAddress == null || ipAddress.isBlank() ? "0.0.0.0" : ipAddress.substring(0, Math.min(ipAddress.length(), 45));
        jdbcTemplate.update(
                "INSERT INTO sessions (id, user_id, session_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                sessionId,
                user.id(),
                hashToken(token),
                normalizedIp,
                userAgent,
                OffsetDateTime.ofInstant(expiresAt, ZoneOffset.UTC));

        LoginController.LoginResponse response = new LoginController.LoginResponse(
                token,
                "Bearer",
                expiresAt,
                new LoginController.UserResponse(user.id(), user.username(), user.email()));
        return new AuthenticationResult(true, response, null, null, HttpStatus.OK.value());
    }

    private AuthenticationResult failure(HttpStatus status, String code, String message) {
        return new AuthenticationResult(false, null, code, message, status.value());
    }

    private String hashToken(String token) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(hash);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    public record AuthenticationResult(boolean authenticated,
                                        LoginController.LoginResponse response,
                                        String errorCode,
                                        String message,
                                        int status) {}

    private record UserRecord(UUID id,
                              String username,
                              String email,
                              String passwordHash,
                              int failedLoginAttempts,
                              OffsetDateTime lockedUntil,
                              boolean active,
                              boolean mfaEnabled) {}
}
