package com.securevault.admin;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/shares")
public class AdminSharingController {
    private static final Set<String> STATUSES = Set.of("ALL", "ACTIVE", "EXPIRED", "REVOKED", "CONSUMED", "PENDING_VERIFICATION", "DELIVERY_FAILED");
    private static final String SHARES = """
            WITH shares AS (
                SELECT s.id, s.credential_id, sender.username AS sender, recipient.username AS recipient,
                       CASE WHEN s.status = 'ACTIVE' AND s.expires_at <= CURRENT_TIMESTAMP
                            THEN 'EXPIRED' ELSE s.status END AS status,
                       s.permission_level AS permission, s.created_at, s.expires_at, 'INTERNAL' AS type, NULL::timestamptz AS accessed_at
                FROM sharing s
                JOIN users sender ON sender.id = s.shared_by_user_id
                JOIN users recipient ON recipient.id = s.shared_with_user_id
                UNION ALL
                SELECT s.id, s.credential_id, sender.username, 'External recipient',
                       CASE WHEN s.revoked_at IS NOT NULL OR c.deleted_at IS NOT NULL OR NOT sender.is_active THEN 'REVOKED'
                            WHEN s.consumed_at IS NOT NULL THEN 'CONSUMED'
                            WHEN s.expires_at <= now() THEN 'EXPIRED'
                            WHEN s.delivery='FAILED' THEN 'DELIVERY_FAILED'
                            WHEN s.grant_hash IS NOT NULL THEN 'ACTIVE' ELSE 'PENDING_VERIFICATION' END,
                       'VIEW', s.created_at, s.expires_at, 'EXTERNAL', s.accessed_at
                FROM external_shares s JOIN users sender ON sender.id=s.sender_id
                JOIN credentials c ON c.id=s.credential_id
            )
            """;
    private static final String FILTER = " FROM shares WHERE (? = 'ALL' OR status = ?) AND (? = 'ALL' OR type = ?)";

    private final JdbcTemplate db;

    public AdminSharingController(JdbcTemplate db) {
        this.db = db;
    }

    public record SharingRow(UUID id, UUID credentialRef, String sender, String recipient,
                             String status, String permission, Instant createdAt, Instant expiresAt, String type, Instant accessedAt) {}

    public record PageData<T>(List<T> items, long total, int page, int size) {}

    public PageData<SharingRow> list(int page, int size, String status) {
        return list(page, size, status, "ALL");
    }

    @GetMapping
    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public PageData<SharingRow> list(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "50") int size,
                                     @RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "ALL") String type) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination parameters.");
        }
        String filter = status == null || status.isBlank() ? "ALL" : status.trim().toUpperCase(Locale.ROOT);
        if (!STATUSES.contains(filter)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid share status.");
        }

        String kind = type.toUpperCase(Locale.ROOT);
        if (!Set.of("ALL", "INTERNAL", "EXTERNAL").contains(kind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid share type.");
        }
        long total = db.queryForObject(SHARES + "SELECT count(*)" + FILTER, Long.class, filter, filter, kind, kind);
        List<SharingRow> items = db.query(SHARES
                        + "SELECT id, credential_id, sender, recipient, status, permission, created_at, expires_at, type, accessed_at"
                        + FILTER + " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
                (rs, rowNum) -> new SharingRow(
                        rs.getObject("id", UUID.class), rs.getObject("credential_id", UUID.class),
                        rs.getString("sender"), rs.getString("recipient"), rs.getString("status"),
                        rs.getString("permission"), instant(rs, "created_at"), instant(rs, "expires_at"), rs.getString("type"), instant(rs, "accessed_at")),
                filter, filter, kind, kind, size, (long) page * size);
        return new PageData<>(items, total, page, size);
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
