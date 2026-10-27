package com.securevault.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Records minimal protected-resource denial telemetry without retaining credentials or tokens. */
@Component
public class SecurityEventRecorder {
    private static final int REPEATED_DENIAL_THRESHOLD = 5;

    private final JdbcTemplate jdbcTemplate;
    private final ClientIpResolver clientIpResolver;

    public SecurityEventRecorder(JdbcTemplate jdbcTemplate, ClientIpResolver clientIpResolver) {
        this.jdbcTemplate = jdbcTemplate;
        this.clientIpResolver = clientIpResolver;
    }

    @Transactional
    public void recordAccessDenied(HttpServletRequest request) {
        String ip = clientIpResolver.resolve(request);
        jdbcTemplate.update("INSERT INTO security_events "
                        + "(event_type, severity, risk_score, anomaly_detected, ip_address, alert_title, detection_reason) "
                        + "VALUES ('ACCESS_DENIED', 'LOW', 20, FALSE, ?, 'Protected access denied', "
                        + "'A protected API request did not have a valid active session or required role.')",
                ip);

        Integer recent = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM security_events WHERE event_type = 'ACCESS_DENIED' "
                        + "AND ip_address = ? AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'",
                Integer.class, ip);
        Integer existingAlert = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM security_events WHERE event_type = 'REPEATED_ACCESS_DENIED' "
                        + "AND ip_address = ? AND timestamp >= CURRENT_TIMESTAMP - INTERVAL '15 minutes'",
                Integer.class, ip);
        if (recent != null && recent >= REPEATED_DENIAL_THRESHOLD
                && (existingAlert == null || existingAlert == 0)) {
            jdbcTemplate.update("INSERT INTO security_events "
                            + "(event_type, severity, risk_score, anomaly_detected, ip_address, alert_title, detection_reason) "
                            + "VALUES ('REPEATED_ACCESS_DENIED', 'HIGH', 75, TRUE, ?, "
                            + "'Repeated unauthorized access attempts', "
                            + "'At least 5 protected API requests from this source were denied within 5 minutes.')",
                    ip);
        }
    }
}
