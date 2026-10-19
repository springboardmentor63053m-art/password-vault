package com.securevault.vault;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class VaultCredentialService {
    private static final Set<String> CATEGORIES = Set.of(
            "Website Login", "Email Accounts", "Banking Credentials", "API Keys",
            "Application Accounts", "Secure Notes");

    private final JdbcTemplate jdbcTemplate;
    private final VaultEncryptionService encryptionService;

    public VaultCredentialService(JdbcTemplate jdbcTemplate, VaultEncryptionService encryptionService) {
        this.jdbcTemplate = jdbcTemplate;
        this.encryptionService = encryptionService;
    }

    public List<CredentialSummary> list(UUID ownerId) {
        String sql = "SELECT c.id, c.title, cat.category_name, c.website_url, c.encrypted_data, "
                + "c.encryption_iv, c.strength_score, c.updated_at "
                + "FROM credentials c JOIN vaults v ON v.id = c.vault_id "
                + "JOIN categories cat ON cat.id = c.category_id "
                + "WHERE v.owner_id = ? ORDER BY c.updated_at DESC";
        return jdbcTemplate.query(sql, (rs, rowNum) -> {
            UUID id = rs.getObject("id", UUID.class);
            var secrets = encryptionService.decrypt(id, rs.getString("encrypted_data"), rs.getString("encryption_iv"));
            return new CredentialSummary(id, rs.getString("title"), rs.getString("category_name"),
                    secrets.username(), rs.getString("website_url"), strengthLabel(rs.getObject("strength_score", Integer.class)),
                    rs.getObject("updated_at", OffsetDateTime.class));
        }, ownerId);
    }

    public CredentialDetail get(UUID ownerId, UUID credentialId) {
        String sql = "SELECT c.id, c.title, cat.category_name, c.website_url, c.encrypted_data, "
                + "c.encryption_iv, c.strength_score, c.updated_at "
                + "FROM credentials c JOIN vaults v ON v.id = c.vault_id "
                + "JOIN categories cat ON cat.id = c.category_id "
                + "WHERE c.id = ? AND v.owner_id = ?";
        List<CredentialDetail> found = jdbcTemplate.query(sql, (rs, rowNum) -> {
            UUID id = rs.getObject("id", UUID.class);
            var secrets = encryptionService.decrypt(id, rs.getString("encrypted_data"), rs.getString("encryption_iv"));
            return new CredentialDetail(id, rs.getString("title"), rs.getString("category_name"),
                    secrets.username(), rs.getString("website_url"), secrets.secret(),
                    strengthLabel(rs.getObject("strength_score", Integer.class)),
                    rs.getObject("updated_at", OffsetDateTime.class));
        }, credentialId, ownerId);
        if (found.isEmpty()) throw new VaultCredentialNotFoundException();
        return found.get(0);
    }

    @Transactional
    public CredentialSummary create(UUID ownerId, CredentialRequest request) {
        int categoryId = categoryId(request.category());
        jdbcTemplate.queryForObject("SELECT id FROM users WHERE id = ? FOR UPDATE", UUID.class, ownerId);
        List<UUID> vaults = jdbcTemplate.query(
                "SELECT id FROM vaults WHERE owner_id = ? AND vault_type = 'PERSONAL' ORDER BY created_at LIMIT 1",
                (rs, rowNum) -> rs.getObject("id", UUID.class), ownerId);
        UUID vaultId;
        if (vaults.isEmpty()) {
            vaultId = jdbcTemplate.queryForObject(
                    "INSERT INTO vaults (owner_id, vault_name, vault_type) VALUES (?, 'Personal Vault', 'PERSONAL') RETURNING id",
                    UUID.class, ownerId);
        } else {
            vaultId = vaults.get(0);
        }

        UUID credentialId = UUID.randomUUID();
        var encrypted = encryptionService.encrypt(credentialId,
                new VaultEncryptionService.CredentialSecrets(request.username(), request.secret()));
        jdbcTemplate.update(
                "INSERT INTO credentials (id, vault_id, category_id, credential_type, title, website_url, "
                + "encrypted_data, encryption_iv, strength_score) VALUES (?, ?, ?, 'SECRET', ?, ?, ?, ?, ?)",
                credentialId, vaultId, categoryId, request.title(), emptyToNull(request.website()),
                encrypted.encryptedData(), encrypted.encryptionIv(), strengthScore(request.secret()));
        return summary(credentialId, request);
    }

    @Transactional
    public CredentialSummary update(UUID ownerId, UUID credentialId, CredentialRequest request) {
        int categoryId = categoryId(request.category());
        var encrypted = encryptionService.encrypt(credentialId,
                new VaultEncryptionService.CredentialSecrets(request.username(), request.secret()));
        int updated = jdbcTemplate.update(
                "UPDATE credentials c SET category_id = ?, title = ?, website_url = ?, encrypted_data = ?, "
                + "encryption_iv = ?, strength_score = ?, updated_at = CURRENT_TIMESTAMP "
                + "FROM vaults v WHERE c.id = ? AND c.vault_id = v.id AND v.owner_id = ?",
                categoryId, request.title(), emptyToNull(request.website()), encrypted.encryptedData(),
                encrypted.encryptionIv(), strengthScore(request.secret()), credentialId, ownerId);
        if (updated == 0) throw new VaultCredentialNotFoundException();
        return summary(credentialId, request);
    }

    @Transactional
    public void delete(UUID ownerId, UUID credentialId) {
        int deleted = jdbcTemplate.update(
                "DELETE FROM credentials c USING vaults v "
                + "WHERE c.id = ? AND c.vault_id = v.id AND v.owner_id = ?",
                credentialId, ownerId);
        if (deleted == 0) throw new VaultCredentialNotFoundException();
    }

    private CredentialSummary summary(UUID credentialId, CredentialRequest request) {
        return new CredentialSummary(credentialId, request.title(), request.category(), request.username(),
                emptyToNull(request.website()), strengthLabel(strengthScore(request.secret())),
                OffsetDateTime.now(ZoneOffset.UTC));
    }

    private int categoryId(String category) {
        if (!CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported credential category.");
        }
        List<Integer> ids = jdbcTemplate.queryForList(
                "SELECT id FROM categories WHERE category_name = ?", Integer.class, category);
        if (ids.isEmpty()) throw new IllegalStateException("Credential categories are not initialized.");
        return ids.get(0);
    }

    private String emptyToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private int strengthScore(String secret) {
        int score = Math.min(40, secret.length() * 2);
        if (secret.chars().anyMatch(Character::isLowerCase)) score += 15;
        if (secret.chars().anyMatch(Character::isUpperCase)) score += 15;
        if (secret.chars().anyMatch(Character::isDigit)) score += 15;
        if (secret.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch))) score += 15;
        return Math.min(score, 100);
    }

    private String strengthLabel(Integer score) {
        if (score == null) return "Not assessed";
        if (score >= 80) return "Very Strong";
        if (score >= 60) return "Strong";
        if (score >= 40) return "Medium";
        return "Weak";
    }

    public record CredentialRequest(String title, String category, String username, String website, String secret) {
        @Override
        public String toString() { return "CredentialRequest[redacted]"; }
    }
    public record CredentialSummary(UUID id, String title, String category, String username,
            String website, String strength, OffsetDateTime lastUpdated) {}
    public record CredentialDetail(UUID id, String title, String category, String username,
            String website, String secret, String strength, OffsetDateTime lastUpdated) {
        @Override
        public String toString() { return "CredentialDetail[redacted]"; }
    }
}
