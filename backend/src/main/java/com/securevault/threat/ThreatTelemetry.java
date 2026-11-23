package com.securevault.threat;

import java.util.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ThreatTelemetry {
    private final JdbcTemplate db;
    private final RiskPolicy riskPolicy;
    private final LocationProvider locationProvider;
    private final int failedLoginThreshold;
    private final int rateLimitThreshold;
    private final int windowMinutes;

    @Autowired
    public ThreatTelemetry(JdbcTemplate db,
                           @Autowired(required = false) RiskPolicy riskPolicy,
                           @Autowired(required = false) LocationProvider locationProvider,
                           @Value("${security.threat.failed-login.threshold:5}") int failedLoginThreshold,
                           @Value("${security.threat.rate-limit.threshold:5}") int rateLimitThreshold,
                           @Value("${security.threat.window-minutes:15}") int windowMinutes) {
        this.db = db;
        this.riskPolicy = riskPolicy != null ? riskPolicy : new RiskPolicy();
        this.locationProvider = locationProvider != null ? locationProvider : new ConfiguredLocationProvider("");
        this.failedLoginThreshold = failedLoginThreshold;
        this.rateLimitThreshold = rateLimitThreshold;
        this.windowMinutes = windowMinutes;
    }

    public ThreatTelemetry(JdbcTemplate db) {
        this(db, new RiskPolicy(), new ConfiguredLocationProvider(""), 5, 5, 15);
    }

    public Map<String, Object> metadata(String agent, String deviceId, String defaultDevice, String ip) {
        Map<String, Object> map = new LinkedHashMap<>();
        DeviceMetadata meta = DeviceMetadata.parse(agent);
        map.put("category", meta.category());
        map.put("os", meta.os());
        map.put("browser", meta.browser());
        if (deviceId != null) {
            map.put("deviceId", deviceId);
        }
        if (defaultDevice != null) {
            map.put("deviceLabel", defaultDevice);
        }
        if (ip != null) {
            map.put("ip", ip);
        }
        return map;
    }

    private String toJson(Map<String, Object> map) {
        if (map == null || map.isEmpty()) return "{}";
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            if (!first) sb.append(",");
            first = false;
            sb.append("\"").append(escape(entry.getKey())).append("\":");
            Object val = entry.getValue();
            if (val == null) {
                sb.append("null");
            } else if (val instanceof Number || val instanceof Boolean) {
                sb.append(val);
            } else {
                sb.append("\"").append(escape(val.toString())).append("\"");
            }
        }
        sb.append("}");
        return sb.toString();
    }

    private String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
    }

    public void audit(Object userId, String action, String status, String ip, String details, Map<String, Object> context) {
        UUID uid = null;
        if (userId instanceof UUID u) {
            uid = u;
        } else if (userId instanceof String s && !s.isBlank()) {
            try {
                uid = UUID.fromString(s);
            } catch (Exception ignored) {}
        }
        String jsonContext = toJson(context);

        try {
            db.update("INSERT INTO audit_logs (id, user_id, action_type, status, ip_address, details, context, timestamp) " +
                      "VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, ?::jsonb, CURRENT_TIMESTAMP)",
                      uid, action, status, ip != null ? ip : "unknown", details, jsonContext);
        } catch (Exception ex) {
            db.update("INSERT INTO audit_logs (id, user_id, action_type, status, ip_address, details, timestamp) " +
                      "VALUES (gen_random_uuid(), ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
                      uid, action, status, ip != null ? ip : "unknown", details);
        }
    }
}
