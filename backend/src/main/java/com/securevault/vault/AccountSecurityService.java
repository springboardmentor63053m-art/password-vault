package com.securevault.vault;
import com.securevault.auth.MfaCryptoService;
import com.securevault.common.AccountPrincipal;
import com.securevault.threat.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class AccountSecurityService {
 private final JdbcTemplate db;private final MfaCryptoService mfa;private final ThreatTelemetry telemetry;private final SensitiveActionLimiter limiter;
 private final BCryptPasswordEncoder bcrypt=new BCryptPasswordEncoder();
 public AccountSecurityService(JdbcTemplate db,MfaCryptoService mfa,ThreatTelemetry telemetry,SensitiveActionLimiter limiter){this.db=db;this.mfa=mfa;this.telemetry=telemetry;this.limiter=limiter;}
 public record Session(UUID id,UUID deviceId,String ip,Instant createdAt,Instant expiresAt,boolean revoked,boolean current){}
 public record Device(UUID id,String category,String os,String browser,Instant lastActive,boolean trusted,boolean current,long activeSessions){}
 public record SecurityActivity(UUID id,String action,String result,String ip,Instant timestamp){}
 public record Overview(String username,String email,boolean mfaEnabled,List<Session> sessions,List<Device> devices,List<SecurityActivity> activities,List<String> recommendations){}
 private record Account(String hash,boolean mfaEnabled,String mfaSecret,Long lastStep){@Override public String toString(){return "AccountSecurity[redacted]";}}
 private Account account(UUID user,boolean lock){return db.queryForObject("SELECT password_hash,mfa_enabled,mfa_secret,mfa_last_totp_step FROM users WHERE id=? AND is_active=TRUE"+(lock?" FOR UPDATE":""),
   (r,n)->new Account(r.getString(1),r.getBoolean(2),r.getString(3),r.getObject(4,Long.class)),user);}
 public Overview overview(AccountPrincipal actor){
  boolean enabled=db.queryForObject("SELECT mfa_enabled FROM users WHERE id=?",Boolean.class,actor.userId());
  var sessions=db.query("SELECT id,device_id,ip_address,created_at,expires_at,is_revoked FROM sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
   (r,n)->new Session(r.getObject(1,UUID.class),r.getObject(2,UUID.class),r.getString(3),r.getTimestamp(4).toInstant(),r.getTimestamp(5).toInstant(),r.getBoolean(6),actor.sessionId().equals(r.getObject(1,UUID.class))),actor.userId());
  var devices=db.query("SELECT d.id,d.last_active,d.is_trusted,(SELECT user_agent FROM sessions s WHERE s.device_id=d.id ORDER BY s.created_at DESC LIMIT 1) AS agent,"+
   "(SELECT count(*) FROM sessions s WHERE s.device_id=d.id AND s.user_id=d.user_id AND s.is_revoked=FALSE AND s.expires_at>CURRENT_TIMESTAMP) AS active_count FROM devices d WHERE d.user_id=? ORDER BY d.last_active DESC LIMIT 100",
   (r,n)->{var metadata=DeviceMetadata.parse(r.getString("agent"));return new Device(r.getObject(1,UUID.class),metadata.category(),metadata.os(),metadata.browser(),r.getTimestamp(2).toInstant(),r.getBoolean(3),Objects.equals(actor.deviceId(),r.getObject(1,UUID.class)),r.getLong("active_count"));},actor.userId());
  var activity=db.query("SELECT id,action_type,status,ip_address,timestamp FROM audit_logs WHERE user_id=? AND (action_type LIKE 'LOGIN%' OR action_type LIKE 'MFA_%' OR action_type LIKE 'PASSWORD_%' OR action_type LIKE 'SESSION_%' OR action_type LIKE 'DEVICE_%' OR action_type='VAULT_ACCESS_DENIED') ORDER BY timestamp DESC,id DESC LIMIT 100",
   (r,n)->new SecurityActivity(r.getObject(1,UUID.class),r.getString(2),r.getString(3),r.getString(4),r.getTimestamp(5).toInstant()),actor.userId());
  var advice=new ArrayList<String>();if(!enabled)advice.add("Enable authenticator MFA and keep access to your authenticator; recovery codes are not yet available.");
  advice.add("Review your active sessions and revoke any you do not recognize.");advice.add("Device labels are coarse User-Agent observations, not verified hardware identities.");
  return new Overview(actor.username(),actor.email(),enabled,sessions,devices,activity,advice);
 }
 private void audit(AccountPrincipal actor,String action,String ip,String agent){telemetry.audit(actor.userId(),action,"SUCCESS",ip,"Account security action completed; credentials and verification codes omitted",telemetry.metadata(agent,actor.deviceId()==null?null:actor.deviceId().toString(),"Session device",ip));}
 @Transactional
 public void revokeSession(AccountPrincipal actor,UUID id,String ip,String agent){
  if(db.update("UPDATE sessions SET is_revoked=TRUE WHERE id=? AND user_id=?",id,actor.userId())!=1)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Session not found.");
  audit(actor,"SESSION_REVOKED",ip,agent);
 }
 @Transactional
 public void revokeDevice(AccountPrincipal actor,UUID id,String ip,String agent){
  if(!Boolean.TRUE.equals(db.queryForObject("SELECT EXISTS(SELECT 1 FROM devices WHERE id=? AND user_id=?)",Boolean.class,id,actor.userId())))throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Device not found.");
  db.update("UPDATE sessions SET is_revoked=TRUE WHERE device_id=? AND user_id=?",id,actor.userId());
  db.update("UPDATE devices SET is_trusted=FALSE WHERE id=? AND user_id=?",id,actor.userId());
  audit(actor,"DEVICE_SESSIONS_REVOKED",ip,agent);
 }
 @Transactional
 public void changePassword(AccountPrincipal actor,String current,String replacement,String code,String ip,String agent){
  limiter.attempt(actor.userId());Account initial=account(actor.userId(),false);
  if(current==null||current.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72||!bcrypt.matches(current,initial.hash()))throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Current password could not be verified.");
  if(replacement==null||replacement.length()<12||replacement.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>72||PasswordHealth.assess(replacement).score()<40)
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a stronger new password of 12–72 UTF-8 bytes; prefer at least 16 characters.");
  if(bcrypt.matches(replacement,initial.hash()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a different new password.");
  long step=-1;
  if(initial.mfaEnabled()){
   if(initial.mfaSecret()==null)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Authenticator verification is required.");
   step=mfa.matchingTotpStep(mfa.decryptSecret(initial.mfaSecret()),code,Instant.now(),initial.lastStep()==null?-1:initial.lastStep());
   if(step<0)throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Authenticator verification is required or the code was already used.");
  }
  Account locked=account(actor.userId(),true);
  if(!locked.hash().equals(initial.hash())||locked.mfaEnabled()!=initial.mfaEnabled()||!Objects.equals(locked.mfaSecret(),initial.mfaSecret())||
    (initial.mfaEnabled()&&locked.lastStep()!=null&&locked.lastStep()>=step))throw new ResponseStatusException(HttpStatus.CONFLICT,"Account security changed. Refresh and retry verification.");
  db.update("UPDATE users SET password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",bcrypt.encode(replacement),actor.userId());
  if(initial.mfaEnabled())db.update("UPDATE users SET mfa_last_totp_step=? WHERE id=?",step,actor.userId());
  db.update("UPDATE sessions SET is_revoked=TRUE WHERE user_id=?",actor.userId());
  db.update("UPDATE login_mfa_challenges SET completed_at=CURRENT_TIMESTAMP WHERE user_id=? AND completed_at IS NULL",actor.userId());
  db.update("UPDATE account_sensitive_attempts SET attempts=0 WHERE user_id=?",actor.userId());
  audit(actor,"PASSWORD_CHANGED",ip,agent);
 }
}
