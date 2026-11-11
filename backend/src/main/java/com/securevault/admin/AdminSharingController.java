package com.securevault.admin;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/admin/shares")
public class AdminSharingController {
    private final JdbcTemplate db;

    public AdminSharingController(JdbcTemplate db) {
        this.db = db;
    }

    public record SharingRow(UUID id, String sender, String recipient, String status, String permission, Instant createdAt, Instant expiresAt) {
        @Override
        public String toString() {
            return "SharingRow[id=" + id + ", sender=" + sender + ", recipient=" + recipient + ", status=" + status + ", permission=" + permission + "]";
        }
    }

    public record PageData<T>(List<T> items, long total, int page, int size) {}

    @GetMapping
    public PageData<SharingRow> list(@RequestParam(defaultValue = "0") int page,
                                     @RequestParam(defaultValue = "50") int size,
                                     @RequestParam(defaultValue = "ALL") String status) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid pagination parameters.");
        }
        String sql = "SELECT s.id, u1.username AS sender, u2.username AS recipient, s.status, s.permission, s.created_at, s.expires_at " +
                     "FROM sharing s " +
                     "JOIN users u1 ON s.shared_by_user_id = u1.id " +
                     "JOIN users u2 ON s.shared_with_user_id = u2.id ";
        boolean filterStatus = status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status);
        if (filterStatus) {
            sql += "WHERE s.status = ? ";
        }
        sql += "ORDER BY s.created_at DESC LIMIT ? OFFSET ?";

        List<SharingRow> items = filterStatus
                ? db.query(sql, (rs, rowNum) -> new SharingRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("sender"),
                        rs.getString("recipient"),
                        rs.getString("status"),
                        rs.getString("permission"),
                        rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : null,
                        rs.getTimestamp("expires_at") != null ? rs.getTimestamp("expires_at").toInstant() : null
                ), status.toUpperCase(), size, page * size)
                : db.query(sql, (rs, rowNum) -> new SharingRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("sender"),
                        rs.getString("recipient"),
                        rs.getString("status"),
                        rs.getString("permission"),
                        rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toInstant() : null,
                        rs.getTimestamp("expires_at") != null ? rs.getTimestamp("expires_at").toInstant() : null
                ), size, page * size);

        Long total = filterStatus
                ? db.queryForObject("SELECT count(*) FROM sharing WHERE status = ?", Long.class, status.toUpperCase())
                : db.queryForObject("SELECT count(*) FROM sharing", Long.class);

        return new PageData<>(items, total != null ? total : 0, page, size);
    }
}

