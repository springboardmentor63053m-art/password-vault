CREATE TABLE IF NOT EXISTS external_shares (
    id uuid PRIMARY KEY,
    sender_id uuid NOT NULL REFERENCES users(id),
    credential_id uuid NOT NULL REFERENCES credentials(id),
    recipient varchar(254) NOT NULL,
    token_hash bytea UNIQUE NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    one_time boolean NOT NULL,
    delivery varchar(16) NOT NULL DEFAULT 'PENDING',
    revoked_at timestamptz,
    accessed_at timestamptz,
    consumed_at timestamptz,
    otp_hash bytea,
    otp_until timestamptz,
    otp_sent_at timestamptz,
    otp_attempts integer NOT NULL DEFAULT 0,
    otp_sends integer NOT NULL DEFAULT 0,
    grant_hash bytea,
    grant_until timestamptz
);
CREATE INDEX IF NOT EXISTS external_shares_sender_created_idx ON external_shares(sender_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON external_shares TO securevault_app;
