CREATE OR REPLACE FUNCTION securevault_detect_credential_sharing()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.action_type = 'CREDENTIAL_SHARE_DENIED' AND NEW.status = 'FAILURE' AND NEW.user_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtextextended('share-denied:' || NEW.user_id::text, 0));
        IF (SELECT count(*) FROM audit_logs
            WHERE user_id = NEW.user_id AND action_type = 'CREDENTIAL_SHARE_DENIED'
              AND status = 'FAILURE' AND timestamp > clock_timestamp() - interval '15 minutes') >= 5
           AND NOT EXISTS (SELECT 1 FROM security_events
            WHERE user_id = NEW.user_id AND event_type = 'CREDENTIAL_SHARED'
              AND alert_title = 'Repeated credential sharing denials'
              AND timestamp > clock_timestamp() - interval '15 minutes') THEN
            INSERT INTO security_events
                (user_id, event_type, severity, risk_score, anomaly_detected, ip_address, alert_title, detection_reason)
            VALUES (NEW.user_id, 'CREDENTIAL_SHARED', 'HIGH', 75, TRUE, NEW.ip_address,
                    'Repeated credential sharing denials', 'At least five sharing requests were denied in 15 minutes.');
        END IF;
        RETURN NEW;
    END IF;
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
