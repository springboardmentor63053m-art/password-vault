BEGIN;
CREATE TABLE IF NOT EXISTS account_sensitive_attempts (
 user_id UUID PRIMARY KEY REFERENCES users(id),
 attempts INTEGER NOT NULL DEFAULT 0,
 window_started TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
GRANT SELECT,INSERT,UPDATE ON account_sensitive_attempts TO securevault_app;
COMMIT;
