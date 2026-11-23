-- Additive, opt-in deployment migration. No account, credential or historical audit changes.
BEGIN;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_ref UUID;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_event ON notifications(user_id,event_ref,notification_type) WHERE event_ref IS NOT NULL;
CREATE OR REPLACE FUNCTION securevault_notify_account_activity() RETURNS TRIGGER AS $$
DECLARE heading TEXT; body TEXT; recipient UUID;
BEGIN
 CASE NEW.action_type
  WHEN 'CREDENTIAL_ADDED' THEN heading='Credential added';
  WHEN 'CREDENTIAL_UPDATED' THEN heading='Credential updated';
  WHEN 'CREDENTIAL_DELETED' THEN heading='Credential deleted';
  WHEN 'CREDENTIAL_SHARED' THEN heading='Credential shared';
  WHEN 'CREDENTIAL_SHARE_DENIED' THEN heading='Sharing attempt failed';
  WHEN 'SHARE_REVOKED' THEN heading='Shared access revoked';
  WHEN 'SHARE_EXPIRED' THEN heading='Shared access expired';
  WHEN 'SHARE_PERMISSION_CHANGED' THEN heading='Sharing access changed';
  WHEN 'VAULT_ACCESS_DENIED' THEN heading='Vault access rejected';
  WHEN 'PASSWORD_CHANGED' THEN heading='Account password changed';
  WHEN 'MFA_TOTP_ENABLED' THEN heading='Authenticator enabled';
  WHEN 'MFA_TOTP_DISABLED' THEN heading='Authenticator disabled';
  ELSE RETURN NEW;
 END CASE;
 body='Review the corresponding activity in your SecureVault account. No credential values are included in this message.';
 IF NEW.user_id IS NOT NULL THEN
  INSERT INTO notifications(user_id,title,message,notification_type,event_ref)
  VALUES(NEW.user_id,heading,body,NEW.action_type,NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 IF NEW.action_type IN ('CREDENTIAL_SHARED','SHARE_REVOKED','SHARE_EXPIRED','SHARE_PERMISSION_CHANGED')
    AND COALESCE(NEW.context->>'recipientRef','') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
  SELECT id INTO recipient FROM users WHERE id=(NEW.context->>'recipientRef')::UUID;
  IF recipient IS NOT NULL AND recipient IS DISTINCT FROM NEW.user_id THEN
   INSERT INTO notifications(user_id,title,message,notification_type,event_ref)
   VALUES(recipient,CASE WHEN NEW.action_type='CREDENTIAL_SHARED' THEN 'New credential received' ELSE heading END,body,NEW.action_type,NEW.id) ON CONFLICT DO NOTHING;
  END IF;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_securevault_account_notifications' AND tgrelid='audit_logs'::regclass) THEN
  CREATE TRIGGER trg_securevault_account_notifications AFTER INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION securevault_notify_account_activity();
 END IF;
END $$;
CREATE OR REPLACE FUNCTION securevault_notify_security_signal() RETURNS TRIGGER AS $$
BEGIN
 IF NEW.user_id IS NOT NULL THEN
  INSERT INTO notifications(user_id,title,message,notification_type,event_ref)
  VALUES(NEW.user_id,'Security activity needs review','A security signal was recorded for your account. Review Account Security.','SECURITY_WARNING',NEW.id) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_securevault_security_notifications' AND tgrelid='security_events'::regclass) THEN
  CREATE TRIGGER trg_securevault_security_notifications AFTER INSERT ON security_events FOR EACH ROW EXECUTE FUNCTION securevault_notify_security_signal();
 END IF;
END $$;
COMMIT;
