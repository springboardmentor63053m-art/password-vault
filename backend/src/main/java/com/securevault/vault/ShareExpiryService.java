package com.securevault.vault;
import com.securevault.threat.ThreatTelemetry;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
@Service
public class ShareExpiryService {
    private final JdbcTemplate db;private final ThreatTelemetry telemetry;
    public ShareExpiryService(JdbcTemplate db,ThreatTelemetry telemetry){this.db=db;this.telemetry=telemetry;}
    @Transactional
    public int expire(){
        var rows=db.query("SELECT id,credential_id,shared_by_user_id,shared_with_user_id FROM sharing WHERE status='ACTIVE' AND expires_at<=CURRENT_TIMESTAMP ORDER BY expires_at LIMIT 200 FOR UPDATE SKIP LOCKED",
                (r,n)->new UUID[]{r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getObject(4,UUID.class)});
        for(UUID[] s:rows){
            db.update("UPDATE sharing SET status='EXPIRED' WHERE id=?",s[0]);
            telemetry.audit(s[2],"SHARE_EXPIRED","SUCCESS","system","Shared access expired; credential values omitted",
                    Map.of("shareRef",s[0].toString(),"credentialRef",s[1].toString(),"recipientRef",s[3].toString(),"source","expiry-maintenance"));
        }
        return rows.size();
    }
}
