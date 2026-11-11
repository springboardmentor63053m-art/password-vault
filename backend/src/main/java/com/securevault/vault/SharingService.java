package com.securevault.vault;
import com.securevault.common.AccountPrincipal;
import com.securevault.threat.ThreatTelemetry;
import java.time.Instant;
import java.sql.Timestamp;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SharingService {
    private final JdbcTemplate db;private final VaultService vault;private final ThreatTelemetry telemetry;private final VaultEvents events;
    public SharingService(JdbcTemplate db,VaultService vault,ThreatTelemetry telemetry,VaultEvents events){this.db=db;this.vault=vault;this.telemetry=telemetry;this.events=events;}
    public record Recipient(UUID id,String username){}
    public record Share(UUID id,UUID credentialId,UUID ownerId,String owner,UUID recipientId,String recipient,String permission,String status,Instant expiresAt,Instant createdAt){}
    public record History(UUID id,String action,String result,Instant timestamp,UUID credentialRef,UUID recipientRef){}
    private Share share(ResultSet r,int n)throws SQLException{return new Share(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getObject(3,UUID.class),r.getString(4),r.getObject(5,UUID.class),r.getString(6),r.getString(7),r.getString(8),r.getTimestamp(9)==null?null:r.getTimestamp(9).toInstant(),r.getTimestamp(10).toInstant());}
    public List<Recipient> recipients(UUID actor,String exact){
        if(exact==null||exact.trim().length()<3||exact.length()>120)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Enter an exact username or email of 3–120 characters.");
        return db.query("SELECT id,username FROM users WHERE is_active=TRUE AND id<>? AND (lower(username)=lower(?) OR lower(email)=lower(?)) ORDER BY username LIMIT 5",
                (r,n)->new Recipient(r.getObject(1,UUID.class),r.getString(2)),actor,exact.trim(),exact.trim());
    }
    private void expiry(Instant at){if(at!=null&&(!at.isAfter(Instant.now())||at.isAfter(Instant.now().plusSeconds(366L*86400))))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Expiry must be in the future and within one year.");}
    private void owner(AccountPrincipal actor,UUID credential,String ip,String agent,boolean lock){
        var rows=db.query("SELECT c.id FROM credentials c JOIN vaults v ON v.id=c.vault_id WHERE c.id=? AND v.owner_id=? AND c.deleted_at IS NULL"+(lock?" FOR UPDATE OF c":""),
                (r,n)->r.getObject(1,UUID.class),credential,actor.userId());
        if(rows.isEmpty()){events.shareDenied(actor,ip,agent,credential);throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Credential not found or sharing unavailable.");}
    }
    private void audit(AccountPrincipal actor,UUID credential,UUID recipient,UUID share,String action,String ip,String agent,boolean newRecipient){
        var context=telemetry.metadata(agent,actor.deviceId()==null?null:actor.deviceId().toString(),"Session device",ip);
        context.put("credentialRef",credential.toString());context.put("recipientRef",recipient.toString());context.put("shareRef",share.toString());context.put("permission","VIEW");context.put("recipientIsNew",newRecipient);
        telemetry.audit(actor.userId(),action,"SUCCESS",ip,"Sharing metadata recorded; credential values omitted",context);
    }
    @Transactional
    public Share create(AccountPrincipal actor,UUID credential,UUID recipient,Instant expires,String ip,String agent){
        expiry(expires);owner(actor,credential,ip,agent,true);
        if(actor.userId().equals(recipient)||!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM users WHERE id=? AND is_active=TRUE)",Boolean.class,recipient))){
            events.shareDenied(actor,ip,agent,credential);throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select an active recipient other than yourself.");
        }
        if(Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM sharing WHERE credential_id=? AND shared_with_user_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP))",Boolean.class,credential,recipient))){
            events.shareDenied(actor,ip,agent,credential);throw new ResponseStatusException(HttpStatus.CONFLICT,"This recipient already has active access. Update expiry or revoke that share.");
        }
        boolean first=!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM sharing WHERE shared_by_user_id=? AND shared_with_user_id=?)",Boolean.class,actor.userId(),recipient));
        UUID id=UUID.randomUUID();
        db.update("INSERT INTO sharing(id,credential_id,shared_by_user_id,shared_with_user_id,permission_level,status,expires_at) VALUES (?,?,?,?,'VIEW','ACTIVE',?)",id,credential,actor.userId(),recipient,expires==null?null:Timestamp.from(expires));
        audit(actor,credential,recipient,id,"CREDENTIAL_SHARED",ip,agent,first);
        return list(actor,true).stream().filter(s->s.id().equals(id)).findFirst().orElseThrow();
    }
    public List<Share> list(AccountPrincipal actor,boolean sent){
        return db.query("SELECT s.id,s.credential_id,s.shared_by_user_id,o.username,s.shared_with_user_id,r.username AS recipient,s.permission_level,"+
                "CASE WHEN c.deleted_at IS NOT NULL THEN 'REVOKED' WHEN s.status='ACTIVE' AND s.expires_at<=CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE s.status END AS effective_status,s.expires_at,s.created_at "+
                "FROM sharing s JOIN credentials c ON c.id=s.credential_id JOIN users o ON o.id=s.shared_by_user_id JOIN users r ON r.id=s.shared_with_user_id WHERE "+
                (sent?"s.shared_by_user_id=?":"s.shared_with_user_id=?")+" ORDER BY s.created_at DESC,s.id DESC LIMIT 500",
                this::share,actor.userId());
    }
    private Share ownedShare(AccountPrincipal actor,UUID id,String ip,String agent){
        var found=db.query("SELECT s.id,s.credential_id,s.shared_by_user_id,o.username,s.shared_with_user_id,r.username,s.permission_level,"+
                "CASE WHEN s.status='ACTIVE' AND s.expires_at<=CURRENT_TIMESTAMP THEN 'EXPIRED' ELSE s.status END,s.expires_at,s.created_at FROM sharing s JOIN users o ON o.id=s.shared_by_user_id JOIN users r ON r.id=s.shared_with_user_id WHERE s.id=? AND s.shared_by_user_id=?",this::share,id,actor.userId());
        if(found.isEmpty()){events.shareDenied(actor,ip,agent,id);throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Share not found or permission unavailable.");}
        return found.get(0);
    }
    @Transactional
    public void revoke(AccountPrincipal actor,UUID id,String ip,String agent){
        Share share=ownedShare(actor,id,ip,agent);
        if(!share.status().equals("ACTIVE"))throw new ResponseStatusException(HttpStatus.CONFLICT,"This share is no longer active.");
        int changed=db.update("UPDATE sharing SET status='REVOKED' WHERE id=? AND shared_by_user_id=? AND status='ACTIVE'",id,actor.userId());
        if(changed!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Share changed; refresh and retry.");
        audit(actor,share.credentialId(),share.recipientId(),id,"SHARE_REVOKED",ip,agent,false);
    }
    @Transactional
    public void updateExpiry(AccountPrincipal actor,UUID id,Instant expires,String ip,String agent){
        expiry(expires);Share share=ownedShare(actor,id,ip,agent);
        if(!share.status().equals("ACTIVE"))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only active shares can be changed.");
        int changed=db.update("UPDATE sharing SET expires_at=? WHERE id=? AND shared_by_user_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>CURRENT_TIMESTAMP)",expires==null?null:Timestamp.from(expires),id,actor.userId());
        if(changed!=1)throw new ResponseStatusException(HttpStatus.CONFLICT,"Share changed; refresh and retry.");
        audit(actor,share.credentialId(),share.recipientId(),id,"SHARE_PERMISSION_CHANGED",ip,agent,false);
    }
    @Transactional
    public VaultService.Item read(AccountPrincipal actor,UUID id,String ip,String agent){
        var authorized=db.query("SELECT s.credential_id,s.shared_by_user_id FROM sharing s JOIN credentials c ON c.id=s.credential_id JOIN vaults v ON v.id=c.vault_id JOIN users o ON o.id=v.owner_id "+
                "WHERE s.id=? AND s.shared_with_user_id=? AND s.shared_by_user_id=v.owner_id AND o.is_active=TRUE AND s.permission_level='VIEW' AND s.status='ACTIVE' AND (s.expires_at IS NULL OR s.expires_at>CURRENT_TIMESTAMP) AND c.deleted_at IS NULL FOR SHARE OF s,c",
                (r,n)->new UUID[]{r.getObject(1,UUID.class),r.getObject(2,UUID.class)},id,actor.userId());
        if(authorized.isEmpty()){events.sharedDenied(actor,ip,agent,id);throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Shared credential unavailable or access expired.");}
        UUID[] source=authorized.get(0);
        var result=vault.sharedItem(source[1],source[0]);
        var context=telemetry.metadata(agent,null,"Session device",ip);context.put("shareRef",id.toString());context.put("ownerRef",source[1].toString());context.put("credentialRef",source[0].toString());context.put("sharedAccess",true);
        telemetry.audit(actor.userId(),"CREDENTIAL_READ","SUCCESS",ip,"Authorized shared credential read; values omitted",context);
        return result;
    }
    public List<History> history(AccountPrincipal actor){
        return db.query("SELECT id,action_type,status,timestamp,context->>'credentialRef',context->>'recipientRef' FROM audit_logs WHERE "+
                "(user_id=? OR context->>'recipientRef'=?) AND action_type IN ('CREDENTIAL_SHARED','CREDENTIAL_SHARE_DENIED','SHARE_REVOKED','SHARE_PERMISSION_CHANGED','SHARE_EXPIRED') ORDER BY timestamp DESC,id DESC LIMIT 100",
                (r,n)->new History(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getTimestamp(4).toInstant(),uuid(r.getString(5)),uuid(r.getString(6))),actor.userId(),actor.userId().toString());
    }
    private UUID uuid(String value){try{return value==null?null:UUID.fromString(value);}catch(IllegalArgumentException e){return null;}}
}
