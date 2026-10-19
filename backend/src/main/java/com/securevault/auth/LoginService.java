
package com.securevault.auth;

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
    private final BCryptPasswordEncoder passwordEncoder =
            new BCryptPasswordEncoder();
    private final String dummyHash =
            passwordEncoder.encode(UUID.randomUUID().toString());
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
            throw new IllegalArgumentException(
                    "The public development JWT key must be replaced.");
        }

        this.signingKey = Keys.hmacShaKeyFor(keyBytes);

        if (expirationSeconds <= 0 || expirationSeconds > 3600) {
            throw new IllegalArgumentException(
                    "JWT expiration must be between 1 and 3600 seconds.");
        }

        this.expirationSeconds = expirationSeconds;
    }

    @Transactional
    public AuthenticationResult authenticate(
            String requestedIdentifier,
            String password,
            String ipAddress,
            String userAgent) {

        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            passwordEncoder.matches("invalid-password", dummyHash);
            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Username/email or password is incorrect.");
        }

        String identifier =
                requestedIdentifier.trim().toLowerCase(Locale.ROOT);

        List<UserRecord> matches = jdbcTemplate.query(
                "SELECT id, username, email, password_hash, "
                        + "failed_login_attempts, locked_until, "
                        + "is_active, mfa_enabled "
                        + "FROM users "
                        + "WHERE lower(username) = ? "
                        + "OR lower(email) = ? "
                        + "LIMIT 2 FOR UPDATE",
                (resultSet, rowNumber) -> new UserRecord(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getString("username"),
                        resultSet.getString("email"),
                        resultSet.getString("password_hash"),
                        resultSet.getInt("failed_login_attempts"),
                        resultSet.getObject(
                                "locked_until", OffsetDateTime.class),
                        resultSet.getBoolean("is_active"),
                        resultSet.getBoolean("mfa_enabled")),
                identifier,
                identifier);

        if (matches.size() != 1) {
            passwordEncoder.matches(password, dummyHash);
            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Username/email or password is incorrect.");
        }

        UserRecord user = matches.get(0);

        // Retrieve the user's existing role from the database.
        List<String> roles = jdbcTemplate.queryForList(
                "SELECT r.role_name "
                        + "FROM user_roles ur "
                        + "JOIN roles r ON r.id = ur.role_id "
                        + "WHERE ur.user_id = ? "
                        + "ORDER BY CASE r.role_name "
                        + "WHEN 'ROLE_ADMIN' THEN 1 "
                        + "WHEN 'ROLE_TEAM_MEMBER' THEN 2 "
                        + "ELSE 3 END",
                String.class,
                user.id());

        if (roles.isEmpty()) {
            throw new IllegalStateException(
                    "No role is assigned to this user.");
        }

        String role = roles.get(0);

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        if (user.lockedUntil() != null
                && user.lockedUntil().isAfter(now)) {
            passwordEncoder.matches(password, dummyHash);
            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Username/email or password is incorrect.");
        }

        if (!user.isActive()) {
            passwordEncoder.matches(password, dummyHash);
            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Username/email or password is incorrect.");
        }

        if (roles.stream().noneMatch("ROLE_ADMIN"::equals)
                && roles.stream().noneMatch("ROLE_USER"::equals)
                && roles.stream().noneMatch("ROLE_TEAM_MEMBER"::equals)) {
            throw new IllegalStateException("User has no recognized application role.");
        }

        boolean matchesPassword =
                passwordEncoder.matches(password, user.passwordHash());

        if (!matchesPassword) {
            int newAttempts =
                    user.lockedUntil() != null
                            && user.lockedUntil().isBefore(now)
                            ? 1
                            : user.failedLoginAttempts() + 1;

            OffsetDateTime lockUntil =
                    newAttempts >= MAX_FAILED_ATTEMPTS
                            ? now.plusMinutes(LOCKOUT_MINUTES)
                            : null;

            jdbcTemplate.update(
                    "UPDATE users SET failed_login_attempts = ?, "
                            + "locked_until = ?, "
                            + "updated_at = CURRENT_TIMESTAMP "
                            + "WHERE id = ?",
                    newAttempts,
                    lockUntil,
                    user.id());

            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "INVALID_CREDENTIALS",
                    "Username/email or password is incorrect.");
        }

        if (user.mfaEnabled()) {
            return failure(
                    HttpStatus.UNAUTHORIZED,
                    "MFA_REQUIRED",
                    "Multi-factor authentication is required for this account. "
                            + "MFA flow is under development.");
        }

        jdbcTemplate.update(
                "UPDATE users SET failed_login_attempts = 0, "
                        + "locked_until = NULL, "
                        + "updated_at = CURRENT_TIMESTAMP "
                        + "WHERE id = ?",
                user.id());

        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plusSeconds(expirationSeconds);

        String token = Jwts.builder()
                .subject(user.id().toString())
                .claim("username", user.username())
                .claim("email", user.email())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey)
                .compact();

        String sessionFingerprint = hashToken(token);

        jdbcTemplate.update(
                "INSERT INTO sessions "
                        + "(user_id, session_token, ip_address, "
                        + "user_agent, expires_at) "
                        + "VALUES (?, ?, ?, ?, ?)",
                user.id(),
                sessionFingerprint,
                ipAddress,
                userAgent,
                expiresAt.atOffset(ZoneOffset.UTC));

        return new AuthenticationResult(
                true,
                HttpStatus.OK,
                null,
                null,
                new AuthController.LoginResponse(
                        token,
                        "Bearer",
                        expiresAt,
                        new AuthController.UserResponse(
                                user.id(),
                                user.username(),
                                user.email(),
                                role)));
    }

    private AuthenticationResult failure(
            HttpStatus status,
            String code,
            String message) {

        return new AuthenticationResult(
                false, status, code, message, null);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance("SHA-256");

            byte[] hash = digest.digest(
                    token.getBytes(StandardCharsets.UTF_8));

            return Base64.getUrlEncoder()
                    .withoutPadding()
                    .encodeToString(hash);

        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(
                    "SHA-256 algorithm missing from Java runtime.", e);
        }
    }

    public record UserRecord(
            UUID id,
            String username,
            String email,
            String passwordHash,
            int failedLoginAttempts,
            OffsetDateTime lockedUntil,
            boolean isActive,
            boolean mfaEnabled) {
    }

    public record AuthenticationResult(
            boolean authenticated,
            HttpStatus status,
            String errorCode,
            String message,
            AuthController.LoginResponse response) {
    }
}
