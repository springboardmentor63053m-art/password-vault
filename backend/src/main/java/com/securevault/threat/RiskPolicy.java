package com.securevault.threat;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class RiskPolicy {
    private final Environment env;

    public RiskPolicy() {
        this(null);
    }

    public RiskPolicy(Environment env) {
        this.env = env;
    }

    public int calculateRiskScore(String eventType, boolean anomaly) {
        if (anomaly) return 80;
        return switch (eventType) {
            case "ACCESS_DENIED" -> 20;
            case "REPEATED_ACCESS_DENIED" -> 75;
            case "SUSPICIOUS_VAULT_ACCESS" -> 85;
            case "FAILED_LOGIN" -> 30;
            default -> 10;
        };
    }
}

