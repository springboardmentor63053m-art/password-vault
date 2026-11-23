package com.securevault.vault;

import com.securevault.common.AccountPrincipal;
import com.securevault.threat.ThreatTelemetry;
import com.securevault.auth.EmailChallengeSender;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class ExternalSharingService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Set<Integer> DURATIONS = Set.of(15, 60, 1440, 10080);
    private static final String STATUS = """
        CASE WHEN s.revoked_at IS NOT NULL OR c.deleted_at IS NOT NULL OR NOT u.is_active THEN 'REVOKED'
             WHEN s.consumed_at IS NOT NULL THEN 'CONSUMED'
             WHEN s.expires_at <= now() THEN 'EXPIRED'
             WHEN s.delivery = 'FAILED' THEN 'DELIVERY_FAILED'
             WHEN s.grant_hash IS NOT NULL THEN 'ACTIVE'
             ELSE 'PENDING_VERIFICATION' END
        """;
    private static final String ROWS = " FROM external_shares s JOIN credentials c ON c.id=s.credential_id"
            + " JOIN users u ON u.id=s.sender_id";

    private final JdbcTemplate db;
    private final VaultService vault;
    private final EmailChallengeSender mail;
    private final ThreatTelemetry telemetry;
    private final String appUrl;
    private final SecretKeySpec otpKey;

    public ExternalSharingService(JdbcTemplate db, VaultService vault, EmailChallengeSender mail,
            ThreatTelemetry telemetry, @Value("${securevault.external.base-url:}") String appUrl,
            @Value("${security.mfa.encryption-key-base64}") String key) {
        this.db = db;
        this.vault = vault;
        this.mail = mail;
        this.telemetry = telemetry;
        this.appUrl = appUrl.trim();
        this.otpKey = new SecretKeySpec(Base64.getDecoder().decode(key.trim()), "HmacSHA256");
    }

    public record SentShare(UUID id, UUID credentialId, String recipient, String status,
                            Instant createdAt, Instant expiresAt, boolean oneTime) {}
    public record LinkInfo(Instant expiresAt, boolean oneTime) {}
    public record Verification(String grant) { @Override public String toString() { return "Verification[redacted]"; } }
    public record Credential(String title, String username, String url, String password) { @Override public String toString() { return "Credential[redacted]"; } }
    public record MailResult(boolean submitted) {}

    @Transactional
    public MailResult create(AccountPrincipal actor, UUID credential, String email, int minutes,
                             boolean oneTime, String message, String ip) {
        if (!DURATIONS.contains(minutes)) throw error(HttpStatus.BAD_REQUEST, "Invalid access duration.");
        String base = trustedBase();
        // Serialize this sender's quota check and also establish credential ownership.
        db.queryForObject("SELECT id FROM users WHERE id=? FOR UPDATE", UUID.class, actor.userId());
        if (db.queryForObject("""
                SELECT count(*) FROM external_shares WHERE sender_id=? AND created_at > now()-interval '1 hour'
                """, Long.class, actor.userId()) >= 10) {
            throw error(HttpStatus.TOO_MANY_REQUESTS, "Too many invitations. Try again later.");
        }
        if (db.query("""
                SELECT c.id FROM credentials c JOIN vaults v ON v.id=c.vault_id
                WHERE c.id=? AND v.owner_id=? AND c.deleted_at IS NULL FOR SHARE OF c
                """, (row, n) -> row.getObject(1, UUID.class), credential, actor.userId()).isEmpty()) {
            throw error(HttpStatus.NOT_FOUND, "Credential unavailable.");
        }
        UUID id = UUID.randomUUID();
        String token = token();
        Instant expiry = Instant.now().plusSeconds(minutes * 60L);
        db.update("""
                INSERT INTO external_shares(id,sender_id,credential_id,recipient,token_hash,expires_at,one_time)
                VALUES (?,?,?,?,?,?,?)
                """, id, actor.userId(), credential, email, digest(token), java.sql.Timestamp.from(expiry), oneTime);
        audit(actor.userId(), credential, id, "EXTERNAL_SHARE_CREATED", true, ip);
        boolean submitted = false;
        try {
            mail.sendExternalInvitation(email, actor.username(), base + "/external.html#" + token, expiry, message);
            submitted = true;
        } catch (RuntimeException unavailable) {
            // SMTP exceptions can contain addresses or message fragments.
        }
        db.update("UPDATE external_shares SET delivery=? WHERE id=?", submitted ? "SUBMITTED" : "FAILED", id);
        audit(actor.userId(), credential, id, submitted ? "EXTERNAL_INVITATION_SUBMITTED" : "EXTERNAL_DELIVERY_FAILED", submitted, ip);
        return new MailResult(submitted);
    }

    @Transactional(readOnly = true)
    public List<SentShare> sent(UUID actor) {
        return db.query("SELECT s.*, " + STATUS + " AS status" + ROWS
                        + " WHERE s.sender_id=? ORDER BY s.created_at DESC,s.id DESC LIMIT 500",
                (row, n) -> new SentShare(row.getObject("id", UUID.class), row.getObject("credential_id", UUID.class),
                        row.getString("recipient"), row.getString("status"), instant(row, "created_at"),
                        instant(row, "expires_at"), row.getBoolean("one_time")), actor);
    }

    @Transactional
    public void revoke(UUID actor, UUID id, String ip) {
        var ids = db.query("""
                UPDATE external_shares SET revoked_at=now(), otp_hash=NULL, grant_hash=NULL
                WHERE id=? AND sender_id=? AND revoked_at IS NULL RETURNING credential_id
                """, (row, n) -> row.getObject(1, UUID.class), id, actor);
        if (ids.isEmpty()) throw error(HttpStatus.NOT_FOUND, "Share unavailable.");
        audit(actor, ids.get(0), id, "EXTERNAL_SHARE_REVOKED", true, ip);
    }

    @Transactional(readOnly = true)
    public LinkInfo inspect(String token) {
        Share share = available(token, false);
        return new LinkInfo(share.expiresAt(), share.oneTime());
    }

    @Transactional
    public MailResult requestCode(String token, String ip) {
        Share share = available(token, true);
        Instant now = Instant.now();
        if (share.sends() >= 12 || (share.sentAt() != null && share.sentAt().plusSeconds(60).isAfter(now))) {
            throw error(HttpStatus.TOO_MANY_REQUESTS, "Please wait before requesting another code.");
        }
        String code = String.format(Locale.ROOT, "%06d", RANDOM.nextInt(1_000_000));
        db.update("""
                UPDATE external_shares SET otp_hash=?, otp_until=now()+interval '5 minutes',
                    otp_sent_at=now(), otp_sends=otp_sends+1, otp_attempts=0 WHERE id=?
                """, otp(share.id(), code), share.id());
        try {
            mail.sendExternalCode(share.recipient(), code);
            return new MailResult(true);
        } catch (RuntimeException unavailable) {
            db.update("UPDATE external_shares SET otp_hash=NULL WHERE id=?", share.id());
            audit(share, "EXTERNAL_DELIVERY_FAILED", false, ip);
            return new MailResult(false);
        }
    }

    // Invalid attempts must commit their counter even though the HTTP response rejects them.
    @Transactional(noRollbackFor = ResponseStatusException.class)
    public Verification verify(String token, String code, String ip) {
        Share share = available(token, true);
        if (share.attempts() >= 5) throw error(HttpStatus.TOO_MANY_REQUESTS, "Too many attempts. Request a new code.");
        if (share.otpHash() == null || !share.otpUntil().isAfter(Instant.now())) {
            throw error(HttpStatus.UNAUTHORIZED, "Verification code is invalid or expired.");
        }
        boolean valid = MessageDigest.isEqual(share.otpHash(), otp(share.id(), code));
        if (!valid) {
            db.update("UPDATE external_shares SET otp_attempts=otp_attempts+1 WHERE id=?", share.id());
            throw error(HttpStatus.UNAUTHORIZED, "Verification code is invalid or expired.");
        }
        String grant = token();
        db.update("""
                UPDATE external_shares SET otp_hash=NULL, grant_hash=?, grant_until=now()+interval '5 minutes' WHERE id=?
                """, digest(grant), share.id());
        audit(share, "EXTERNAL_RECIPIENT_VERIFIED", true, ip);
        return new Verification(grant);
    }

    @Transactional
    public Credential retrieve(String token, String grant, String ip) {
        Share share = available(token, true);
        if (share.grantHash() == null || share.grantUntil() == null || !share.grantUntil().isAfter(Instant.now())
                || !MessageDigest.isEqual(share.grantHash(), digest(grant))) {
            throw error(HttpStatus.UNAUTHORIZED, "Verify your email before retrieving the credential.");
        }
        var item = vault.sharedItem(share.sender(), share.credential());
        db.update("""
                UPDATE external_shares SET accessed_at=now(), consumed_at=CASE WHEN one_time THEN now() ELSE NULL END,
                    grant_until=NULL WHERE id=?
                """, share.id());
        audit(share, "EXTERNAL_CREDENTIAL_ACCESSED", true, ip);
        if (share.oneTime()) audit(share, "EXTERNAL_SHARE_CONSUMED", true, ip);
        return new Credential(item.title(), item.username(), item.url(), item.password());
    }

    private Share available(String token, boolean lock) {
        var rows = db.query("SELECT s.*, " + STATUS + " AS status" + ROWS
                        + " WHERE s.token_hash=?" + (lock ? " FOR UPDATE OF s FOR SHARE OF c, u" : ""),
                (row, n) -> new Share(row.getObject("id", UUID.class), row.getObject("sender_id", UUID.class),
                        row.getObject("credential_id", UUID.class), row.getString("recipient"),
                        row.getString("status"), row.getString("delivery"), instant(row, "expires_at"),
                        row.getBoolean("one_time"), row.getBytes("otp_hash"), instant(row, "otp_until"),
                        instant(row, "otp_sent_at"), row.getInt("otp_attempts"), row.getInt("otp_sends"),
                        row.getBytes("grant_hash"), instant(row, "grant_until")), digest(token));
        if (rows.isEmpty()) throw error(HttpStatus.NOT_FOUND, "Invalid secure access link.");
        Share share = rows.get(0);
        switch (share.status()) {
            case "REVOKED" -> throw error(HttpStatus.GONE, "This share was revoked.");
            case "EXPIRED" -> throw error(HttpStatus.GONE, "This share has expired.");
            case "CONSUMED" -> throw error(HttpStatus.GONE, "This one-time share has already been used.");
            default -> {
                if (!"SUBMITTED".equals(share.delivery())) throw error(HttpStatus.NOT_FOUND, "Invalid secure access link.");
            }
        }
        // now() in SQL is transaction-start time. Recheck wall time after waiting for a row lock.
        if (!share.expiresAt().isAfter(Instant.now())) throw error(HttpStatus.GONE, "This share has expired.");
        return share;
    }

    private String trustedBase() {
        try {
            URI uri = URI.create(appUrl);
            boolean loopback = Set.of("localhost", "127.0.0.1").contains(uri.getHost());
            if (("https".equals(uri.getScheme()) || ("http".equals(uri.getScheme()) && loopback))
                    && uri.getHost() != null && uri.getRawUserInfo() == null && uri.getRawQuery() == null
                    && uri.getRawFragment() == null && Set.of("", "/").contains(uri.getRawPath())) {
                return appUrl.replaceFirst("/$", "");
            }
        } catch (RuntimeException invalid) {
            // Report only the safe configuration error.
        }
        throw error(HttpStatus.SERVICE_UNAVAILABLE, "External sharing has no trusted application URL configured.");
    }

    private void audit(Share share, String action, boolean success, String ip) {
        audit(share.sender(), share.credential(), share.id(), action, success, ip);
    }

    private void audit(UUID sender, UUID credential, UUID share, String action, boolean success, String ip) {
        telemetry.audit(sender, action, success ? "SUCCESS" : "FAILURE", ip, "External sharing activity.",
                Map.of("credentialRef", credential.toString(), "shareRef", share.toString()));
    }

    private byte[] otp(UUID shareId, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(otpKey);
            return mac.doFinal(("SecureVault/external-share/otp/v1:" + shareId + ":" + code).getBytes(StandardCharsets.UTF_8));
        } catch (java.security.GeneralSecurityException failure) {
            throw new IllegalStateException("OTP verification unavailable.", failure);
        }
    }

    private static byte[] digest(String value) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.US_ASCII));
        } catch (java.security.GeneralSecurityException failure) {
            throw new IllegalStateException("Token verification unavailable.", failure);
        }
    }

    private static String token() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static Instant instant(ResultSet row, String column) throws SQLException {
        OffsetDateTime time = row.getObject(column, OffsetDateTime.class);
        return time == null ? null : time.toInstant();
    }

    private static ResponseStatusException error(HttpStatus status, String message) {
        return new ResponseStatusException(status, message);
    }

    private record Share(UUID id, UUID sender, UUID credential, String recipient, String status, String delivery,
                         Instant expiresAt, boolean oneTime, byte[] otpHash, Instant otpUntil, Instant sentAt,
                         int attempts, int sends, byte[] grantHash, Instant grantUntil) {}
}
