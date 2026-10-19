CREATE TABLE IF NOT EXISTS admin_settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value BOOLEAN NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admin_settings (setting_key, setting_value) VALUES
    ('securityMonitoringEnabled', TRUE),
    ('activityMonitoringEnabled', TRUE)
ON CONFLICT (setting_key) DO NOTHING;
