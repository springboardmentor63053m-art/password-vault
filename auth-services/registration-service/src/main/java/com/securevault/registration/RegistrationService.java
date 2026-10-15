package com.securevault.registration;

import java.security.SecureRandom;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RegistrationService {
    private final JdbcTemplate jdbcTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final SecureRandom secureRandom = new SecureRandom();

    public RegistrationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public RegistrationController.RegistrationResponse register(String requestedUsername, String requestedEmail, String password) {
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalArgumentException("Password exceeds BCrypt's 72-byte limit.");
        }
        String username = requestedUsername.trim().toLowerCase(Locale.ROOT);
        String email = requestedEmail.trim().toLowerCase(Locale.ROOT);
        byte[] salt = new byte[32];
        secureRandom.nextBytes(salt);

        UUID userId = jdbcTemplate.queryForObject(
                "INSERT INTO users (username, email, password_hash, vault_key_salt) VALUES (?, ?, ?, ?) RETURNING id",
                UUID.class,
                username,
                email,
                passwordEncoder.encode(password),
                Base64.getUrlEncoder().withoutPadding().encodeToString(salt));

        int assignedRoles = jdbcTemplate.update(
                "INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE role_name = ?",
                userId,
                "ROLE_USER");
        if (assignedRoles != 1) {
            throw new IllegalStateException("The default ROLE_USER role is missing from the database.");
        }

        return new RegistrationController.RegistrationResponse(userId, username, email, Instant.now());
    }
}
