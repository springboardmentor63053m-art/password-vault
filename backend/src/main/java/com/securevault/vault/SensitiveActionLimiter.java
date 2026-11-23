package com.securevault.vault;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
@Service
public class SensitiveActionLimiter {
 private final JdbcTemplate db;
 public SensitiveActionLimiter(JdbcTemplate db){this.db=db;}
 @Transactional(propagation=Propagation.REQUIRES_NEW)
 public void attempt(UUID user){
  Integer attempts=db.queryForObject("INSERT INTO account_sensitive_attempts(user_id,attempts,window_started) VALUES (?,1,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET "+
    "attempts=CASE WHEN account_sensitive_attempts.window_started<CURRENT_TIMESTAMP-INTERVAL '15 minutes' THEN 1 ELSE account_sensitive_attempts.attempts+1 END,"+
    "window_started=CASE WHEN account_sensitive_attempts.window_started<CURRENT_TIMESTAMP-INTERVAL '15 minutes' THEN CURRENT_TIMESTAMP ELSE account_sensitive_attempts.window_started END RETURNING attempts",Integer.class,user);
  if(attempts>5)throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,"Too many sensitive-account attempts. Wait 15 minutes before retrying.");
 }
}
