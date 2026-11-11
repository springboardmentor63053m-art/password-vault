-- Phase 1: additive only. Apply explicitly after review; never replay schema.sql on existing data.
BEGIN;
CREATE TABLE IF NOT EXISTS user_vault_categories (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id UUID NOT NULL REFERENCES users(id),
 name VARCHAR(80) NOT NULL,
 name_key VARCHAR(80) NOT NULL,
 UNIQUE(owner_id,name_key)
);
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS custom_category_id UUID REFERENCES user_vault_categories(id);
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_credentials_live_vault ON credentials(vault_id) WHERE deleted_at IS NULL;
INSERT INTO categories(category_name) VALUES ('Website Login'),('Social Media'),('Email Accounts'),
 ('Work Accounts'),('Educational Accounts'),('Entertainment'),('Gaming Accounts'),('Wi-Fi Passwords'),
 ('Banking Credentials'),('Other') ON CONFLICT(category_name) DO NOTHING;
GRANT SELECT,INSERT,UPDATE,DELETE ON user_vault_categories TO securevault_app;
-- Do not widen existing audit/history permissions.
COMMIT;
