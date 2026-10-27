-- ============================================================================
-- SecureVault: Database Schema Initialization Script (PostgreSQL)
-- Compatible with: PostgreSQL 14+
-- ============================================================================

-- ============================================================================
-- 1. USER AUTHENTICATION & ACCESS CONTROL
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    vault_key_salt VARCHAR(255) NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret VARCHAR(255) NULL,
    oauth2_provider VARCHAR(50) NULL,
    reset_password_token VARCHAR(255) NULL,
    reset_token_expires_at TIMESTAMP WITH TIME ZONE NULL,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_pending_secret VARCHAR(500) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_totp_step BIGINT NULL;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID NULL,
    session_token VARCHAR(500) NOT NULL UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    device_fingerprint VARCHAR(255) NOT NULL,
    is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
    last_active TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_device UNIQUE (user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS login_mfa_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(16) NOT NULL CHECK (method IN ('EMAIL', 'TOTP')),
    code_hash VARCHAR(100) NULL,
    issued_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempt_count SMALLINT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    ip_address VARCHAR(45) NOT NULL,
    device_fingerprint VARCHAR(64) NOT NULL,
    CHECK ((method = 'EMAIL' AND code_hash IS NOT NULL) OR (method = 'TOTP' AND code_hash IS NULL))
);

-- Keep existing installations compatible while linking browser sessions to
-- the device record created at login. Revoking a device can then revoke every
-- active session created from that device.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS device_id UUID NULL;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_sessions_device_id'
    ) THEN
        ALTER TABLE sessions
            ADD CONSTRAINT fk_sessions_device_id
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. PASSWORD VAULT & CREDENTIAL MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vault_name VARCHAR(100) NOT NULL,
    vault_type VARCHAR(20) NOT NULL DEFAULT 'PERSONAL', -- 'PERSONAL', 'TEAM'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vault_members (
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'MEMBER', -- 'OWNER', 'ADMIN', 'MEMBER', 'VIEWER'
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (vault_id, user_id)
);

CREATE TABLE IF NOT EXISTS folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    folder_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    tag_name VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
    folder_id UUID NULL REFERENCES folders(id) ON DELETE SET NULL,
    category_id INT NOT NULL REFERENCES categories(id),
    credential_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    website_url TEXT NULL,
    encrypted_data TEXT NOT NULL,
    encryption_iv VARCHAR(100) NOT NULL,
    key_version INT NOT NULL DEFAULT 1,
    strength_score INT NULL,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    last_used_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tag_mappings (
    credential_id UUID NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (credential_id, tag_id)
);

CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    s3_file_path TEXT NOT NULL,
    encryption_iv VARCHAR(100) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. SECURE SHARING MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sharing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credential_id UUID NOT NULL REFERENCES credentials(id) ON DELETE CASCADE,
    shared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_level VARCHAR(30) NOT NULL, -- 'VIEW', 'EDIT', 'FULL_MANAGEMENT'
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'REVOKED', 'EXPIRED'
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. SECURITY MONITORING & AUDIT LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILURE'
    ip_address VARCHAR(45) NOT NULL,
    details TEXT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    risk_score INT NOT NULL,
    anomaly_detected BOOLEAN NOT NULL DEFAULT FALSE,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'RESOLVED'
    ip_address VARCHAR(45) NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    alert_title VARCHAR(200),
    detection_reason TEXT,
    resolution_notes TEXT,
    reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE security_events ADD COLUMN IF NOT EXISTS alert_title VARCHAR(200);
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS detection_reason TEXT;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE security_events SET alert_title = INITCAP(REPLACE(event_type, '_', ' ')) WHERE alert_title IS NULL;
UPDATE security_events SET detection_reason = 'Detected by rule ' || event_type WHERE detection_reason IS NULL;

CREATE TABLE IF NOT EXISTS security_event_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES security_events(id) ON DELETE CASCADE,
    reviewer_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
REVOKE UPDATE, DELETE ON security_event_history FROM securevault_app;

-- Keep existing installations compatible as threat statuses are introduced.
ALTER TABLE security_events ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'OPEN';
UPDATE security_events SET status = CASE WHEN is_resolved THEN 'RESOLVED' ELSE 'OPEN' END
WHERE (is_resolved AND status <> 'RESOLVED') OR (NOT is_resolved AND status = 'RESOLVED');

-- Raise a single actionable threat when recorded vault activity becomes bursty.
CREATE OR REPLACE FUNCTION securevault_detect_vault_access_burst()
RETURNS TRIGGER AS $$
DECLARE
    recent_count INT;
BEGIN
    IF NEW.status <> 'SUCCESS'
       OR (NEW.action_type NOT ILIKE 'VAULT_%' AND NEW.action_type NOT ILIKE 'CREDENTIAL_%') THEN
        RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO recent_count
    FROM audit_logs l
    WHERE (l.action_type ILIKE 'VAULT_%' OR l.action_type ILIKE 'CREDENTIAL_%')
      AND l.status = 'SUCCESS'
      AND l.user_id IS NOT DISTINCT FROM NEW.user_id
      AND l.ip_address = NEW.ip_address
      AND l.timestamp >= CURRENT_TIMESTAMP - INTERVAL '5 minutes';

    IF recent_count >= 20 AND NOT EXISTS (
        SELECT 1 FROM security_events e
        WHERE e.event_type = 'SUSPICIOUS_VAULT_ACCESS'
          AND e.user_id IS NOT DISTINCT FROM NEW.user_id
          AND e.ip_address = NEW.ip_address
          AND e.timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 minutes'
    ) THEN
        INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected, ip_address)
        VALUES (NEW.user_id, 'SUSPICIOUS_VAULT_ACCESS', 'HIGH', 80, TRUE, NEW.ip_address);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_securevault_vault_access_burst ON audit_logs;
CREATE TRIGGER trg_securevault_vault_access_burst
AFTER INSERT ON audit_logs
FOR EACH ROW EXECUTE FUNCTION securevault_detect_vault_access_burst();

-- Treat future credential-share and permission-change audit entries as reviewable alerts.
CREATE OR REPLACE FUNCTION securevault_detect_credential_sharing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status <> 'SUCCESS' OR (
        NEW.action_type NOT ILIKE 'CREDENTIAL_SHARED'
        AND NEW.action_type NOT ILIKE 'CREDENTIAL_SHARE_%'
        AND NEW.action_type NOT ILIKE 'SHARE_PERMISSION_%'
    ) THEN
        RETURN NEW;
    END IF;

    INSERT INTO security_events
        (user_id, event_type, severity, risk_score, anomaly_detected, ip_address, alert_title, detection_reason)
    VALUES
        (NEW.user_id, 'CREDENTIAL_SHARED', 'MEDIUM', 50, TRUE, NEW.ip_address,
         'Credential sharing activity', 'A successful credential share or share-permission change was recorded.');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_securevault_credential_sharing ON audit_logs;
CREATE TRIGGER trg_securevault_credential_sharing
AFTER INSERT ON audit_logs
FOR EACH ROW EXECUTE FUNCTION securevault_detect_credential_sharing();

CREATE OR REPLACE FUNCTION securevault_detect_weak_credential()
RETURNS TRIGGER AS $$
DECLARE
    owner_user_id UUID;
BEGIN
    IF NEW.strength_score IS NULL OR NEW.strength_score >= 40 THEN
        RETURN NEW;
    END IF;
    SELECT owner_id INTO owner_user_id FROM vaults WHERE id = NEW.vault_id;
    IF owner_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM security_events WHERE user_id = owner_user_id
          AND event_type = 'WEAK_PASSWORD' AND is_resolved = FALSE
    ) THEN
        INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected)
        VALUES (owner_user_id, 'WEAK_PASSWORD', 'MEDIUM', 45, TRUE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_securevault_weak_credential ON credentials;
CREATE TRIGGER trg_securevault_weak_credential
AFTER INSERT OR UPDATE OF strength_score ON credentials
FOR EACH ROW EXECUTE FUNCTION securevault_detect_weak_credential();

-- Convert password-health assessments and safe strength metadata into alerts;
-- no plaintext or decrypted credential value is stored or inspected here.
CREATE OR REPLACE FUNCTION securevault_report_password_health()
RETURNS TRIGGER AS $$
DECLARE
    user_id_value UUID;
    weak_count INT;
    reused_count INT;
    compromised_count INT;
BEGIN
    user_id_value := NEW.user_id;
    weak_count := NEW.weak_passwords_count;
    reused_count := NEW.reused_passwords_count;
    compromised_count := NEW.compromised_count;

    IF weak_count = 0 THEN
        UPDATE security_events SET is_resolved = TRUE, status = 'RESOLVED'
        WHERE user_id = user_id_value AND event_type = 'WEAK_PASSWORD' AND is_resolved = FALSE;
    ELSIF NOT EXISTS (SELECT 1 FROM security_events WHERE user_id = user_id_value
            AND event_type = 'WEAK_PASSWORD' AND is_resolved = FALSE) THEN
        INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected)
        VALUES (user_id_value, 'WEAK_PASSWORD', 'MEDIUM', LEAST(70, 40 + weak_count * 2), TRUE);
    END IF;

    IF reused_count = 0 THEN
        UPDATE security_events SET is_resolved = TRUE, status = 'RESOLVED'
        WHERE user_id = user_id_value AND event_type = 'REUSED_PASSWORD' AND is_resolved = FALSE;
    ELSIF NOT EXISTS (SELECT 1 FROM security_events WHERE user_id = user_id_value
            AND event_type = 'REUSED_PASSWORD' AND is_resolved = FALSE) THEN
        INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected)
        VALUES (user_id_value, 'REUSED_PASSWORD', 'HIGH', LEAST(85, 60 + reused_count * 3), TRUE);
    END IF;

    IF compromised_count = 0 THEN
        UPDATE security_events SET is_resolved = TRUE, status = 'RESOLVED'
        WHERE user_id = user_id_value AND event_type = 'COMPROMISED_PASSWORD' AND is_resolved = FALSE;
    ELSIF NOT EXISTS (SELECT 1 FROM security_events WHERE user_id = user_id_value
            AND event_type = 'COMPROMISED_PASSWORD' AND is_resolved = FALSE) THEN
        INSERT INTO security_events (user_id, event_type, severity, risk_score, anomaly_detected)
        VALUES (user_id_value, 'COMPROMISED_PASSWORD', 'CRITICAL', 95, TRUE);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TABLE IF NOT EXISTS blocked_ips (
    ip_address VARCHAR(45) PRIMARY KEY,
    reason VARCHAR(255) NOT NULL,
    blocked_until TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'LOGIN_ALERT', 'SECURITY_ALERT', 'SHARE_INVITE', 'PASSWORD_EXPIRY'
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. ANALYTICS DASHBOARD MODULE
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_health (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    overall_health_score INT NOT NULL DEFAULT 100,
    weak_passwords_count INT NOT NULL DEFAULT 0,
    reused_passwords_count INT NOT NULL DEFAULT 0,
    compromised_count INT NOT NULL DEFAULT 0,
    last_calculated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_securevault_password_health ON password_health;
CREATE TRIGGER trg_securevault_password_health
AFTER INSERT OR UPDATE ON password_health
FOR EACH ROW EXECUTE FUNCTION securevault_report_password_health();

CREATE TABLE IF NOT EXISTS login_stats (
    stat_date DATE PRIMARY KEY,
    total_logins INT NOT NULL DEFAULT 0,
    failed_logins INT NOT NULL DEFAULT 0,
    mfa_successes INT NOT NULL DEFAULT 0
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_login_mfa_challenges_user_issued ON login_mfa_challenges(user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_mfa_challenges_expiry ON login_mfa_challenges(expires_at);
CREATE INDEX IF NOT EXISTS idx_vaults_owner_id ON vaults(owner_id);
CREATE INDEX IF NOT EXISTS idx_credentials_vault_id ON credentials(vault_id);
CREATE INDEX IF NOT EXISTS idx_credentials_folder_id ON credentials(folder_id);
CREATE INDEX IF NOT EXISTS idx_credentials_category_id ON credentials(category_id);
CREATE INDEX IF NOT EXISTS idx_credentials_title ON credentials(title);
CREATE INDEX IF NOT EXISTS idx_sharing_credential_id ON sharing(credential_id);
CREATE INDEX IF NOT EXISTS idx_sharing_shared_with ON sharing(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_timestamp ON audit_logs(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp ON audit_logs(action_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user_timestamp ON security_events(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_timestamp ON security_events(ip_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

-- ============================================================================
-- INITIAL SEED DATA (Aligned with Project Specification)
-- ============================================================================

-- Roles (Project Spec Page 2)
INSERT INTO roles (role_name) VALUES
    ('ROLE_USER'),
    ('ROLE_TEAM_MEMBER'),
    ('ROLE_ADMIN')
ON CONFLICT (role_name) DO NOTHING;

-- Credential Categories (Project Spec Page 3)
INSERT INTO categories (category_name) VALUES
    ('Website Login'),
    ('Email Accounts'),
    ('Banking Credentials'),
    ('Social Media Accounts'),
    ('Application Accounts'),
    ('API Keys'),
    ('Secure Notes')
ON CONFLICT (category_name) DO NOTHING;
