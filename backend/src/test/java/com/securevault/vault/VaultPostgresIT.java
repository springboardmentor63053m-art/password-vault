package com.securevault.vault;
import com.securevault.common.*;
import com.securevault.threat.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;

@org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable(named = "SECUREVAULT_TEST_PG_URL", matches = ".+")
class VaultPostgresIT {
 @Test void repeatedFailedSharingProducesThresholdAlertWithoutVaultSecrets(){
  var item=tx.execute(s->service.save(alice,null,input("Private detection fixture",category()),"192.0.2.1",null));
  for(int i=0;i<5;i++)assertThrows(ResponseStatusException.class,()->sharing.create(bob,item.id(),alice.userId(),null,"192.0.2.2",null));
  assertEquals(5,db.queryForObject("SELECT count(*) FROM audit_logs WHERE user_id=? AND action_type='CREDENTIAL_SHARE_DENIED'",Integer.class,bob.userId()));
  assertTrue(db.queryForObject("SELECT EXISTS(SELECT 1 FROM security_events WHERE user_id=? AND event_type='CREDENTIAL_SHARED')",Boolean.class,bob.userId()));
  assertFalse(db.queryForObject("SELECT string_agg(context::text,'') FROM audit_logs WHERE user_id=?",String.class,bob.userId()).contains("synthetic-vault-test-value"));
 }
 @Test void apiBoundaryEnforcesLiveSessionOwnershipAndValidation()throws Exception{
  byte[] key=new byte[48];new java.security.SecureRandom().nextBytes(key);
  String encoded=Base64.getEncoder().encodeToString(key);
  String token=io.jsonwebtoken.Jwts.builder().subject(alice.userId().toString()).expiration(new java.util.Date(System.currentTimeMillis()+60000)).signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(key)).compact();
  db.update("INSERT INTO sessions(id,user_id,session_token,ip_address,expires_at) VALUES (?,?,?,'192.0.2.1',CURRENT_TIMESTAMP+INTERVAL '5 minutes')",alice.sessionId(),alice.userId(),SessionTokenUtils.fingerprint(token));
  var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new VaultController(service,ClientIpResolver.withoutTrustedProxies()),new com.securevault.auth.AccountIdentityController(db))
   .addInterceptors(new AccountAuthenticationInterceptor(db,encoded)).setControllerAdvice(new GlobalExceptionHandler()).build();
  var get=org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/account/vault/credentials");
  mvc.perform(get).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
  db.update("INSERT INTO user_roles(user_id,role_id) SELECT ?,id FROM roles WHERE role_name='ROLE_USER'",alice.userId());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/account/me").header("Authorization","Bearer "+token))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.roles[0]").value("ROLE_USER"));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/account/vault/credentials").header("Authorization","Bearer "+token).contentType("application/json").content("{}"))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  var item=tx.execute(s->service.save(alice,null,input("HTTP fixture",category()),"192.0.2.1",null));
  String body=mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/account/vault/credentials").header("Authorization","Bearer "+token))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk()).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsString();
  assertTrue(body.contains("HTTP fixture"));assertFalse(body.contains("synthetic-vault-test-value"));assertFalse(body.contains("synthetic-note"));
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/account/vault/credentials").param("sort","invalid").header("Authorization","Bearer "+token))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
  db.update("UPDATE sessions SET is_revoked=TRUE WHERE id=?",alice.sessionId());
  mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/account/vault/credentials/"+item.id()).header("Authorization","Bearer "+token))
   .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
 }
 @Test void enabledMfaIsRequiredAndPreservedDuringPasswordChange(){
  byte[] key=new byte[32];new java.security.SecureRandom().nextBytes(key);
  var mfa=new com.securevault.auth.MfaCryptoService(Base64.getEncoder().encodeToString(key));
  String seed=mfa.newSecret(),encrypted=mfa.encryptSecret(seed);
  var encoder=new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
  db.update("UPDATE users SET password_hash=?,mfa_enabled=TRUE,mfa_secret=? WHERE id=?",encoder.encode("Synthetic-current-42"),encrypted,alice.userId());
  var telemetry=new ThreatTelemetry(db,new RiskPolicy(new MockEnvironment()),new ConfiguredLocationProvider(""),5,5,15);
  var account=new AccountSecurityService(db,mfa,telemetry,new SensitiveActionLimiter(db));
  assertThrows(ResponseStatusException.class,()->account.changePassword(alice,"Synthetic-current-42","Synthetic-replacement-42",null,"192.0.2.1",null));
  String code=org.springframework.test.util.ReflectionTestUtils.invokeMethod(mfa,"totp",seed,java.time.Instant.now().getEpochSecond()/30);
  tx.executeWithoutResult(s->account.changePassword(alice,"Synthetic-current-42","Synthetic-replacement-42",code,"192.0.2.1",null));
  assertEquals(encrypted,db.queryForObject("SELECT mfa_secret FROM users WHERE id=?",String.class,alice.userId()));assertTrue(db.queryForObject("SELECT mfa_enabled FROM users WHERE id=?",Boolean.class,alice.userId()));
  assertTrue(db.queryForObject("SELECT mfa_last_totp_step IS NOT NULL FROM users WHERE id=?",Boolean.class,alice.userId()));
 }
 @Test void sharingMonitoringIsMetadataOnlyAndCredentialDeletionRevokesAccess(){
  var item=tx.execute(s->service.save(alice,null,input("Confidential fixture title",category()),"192.0.2.1",null));
  var share=tx.execute(s->sharing.create(alice,item.id(),bob.userId(),null,"192.0.2.1",null));
  var monitor=new com.securevault.admin.AdminSharingController(db);
  var row=monitor.list(0,100,"ACTIVE").items().stream().filter(r->r.id().equals(share.id())).findFirst().orElseThrow();
  assertEquals(alice.username(),row.sender());assertEquals(bob.username(),row.recipient());
  assertFalse(row.toString().contains("Confidential"));assertFalse(row.toString().contains("synthetic-vault-test-value"));
  assertThrows(ResponseStatusException.class,()->monitor.list(-1,100,"ALL"));assertThrows(ResponseStatusException.class,()->monitor.list(0,101,"ALL"));
  tx.executeWithoutResult(s->service.delete(alice,item.id(),"192.0.2.1",null));
  assertEquals("REVOKED",sharing.list(bob,false).get(0).status());
  assertThrows(ResponseStatusException.class,()->sharing.read(bob,share.id(),"192.0.2.2",null));
  assertTrue(notices.list(bob.userId(),0,100,false).items().stream().anyMatch(n->n.type().equals("SHARE_REVOKED")));
 }
 @Test void accountPasswordChangesPreserveVaultAndRejectForeignSessionChanges(){
  var encoder=new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder();
  db.update("UPDATE users SET password_hash=? WHERE id=?",encoder.encode("Synthetic-current-42"),alice.userId());
  byte[] key=new byte[32];new java.security.SecureRandom().nextBytes(key);
  var telemetry=new ThreatTelemetry(db,new RiskPolicy(new MockEnvironment()),new ConfiguredLocationProvider(""),5,5,15);
  var account=new AccountSecurityService(db,new com.securevault.auth.MfaCryptoService(Base64.getEncoder().encodeToString(key)),telemetry,new SensitiveActionLimiter(db));
  var item=tx.execute(s->service.save(alice,null,input("Password change fixture",category()),"192.0.2.1",null));
  String before=db.queryForObject("SELECT encrypted_data FROM credentials WHERE id=?",String.class,item.id());
  assertThrows(ResponseStatusException.class,()->account.revokeSession(bob,alice.sessionId(),"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->account.changePassword(alice,"Wrong-current","Synthetic-replacement-42",null,"192.0.2.1",null));
  tx.executeWithoutResult(s->account.changePassword(alice,"Synthetic-current-42","Synthetic-replacement-42",null,"192.0.2.1",null));
  assertTrue(encoder.matches("Synthetic-replacement-42",db.queryForObject("SELECT password_hash FROM users WHERE id=?",String.class,alice.userId())));
  assertEquals(before,db.queryForObject("SELECT encrypted_data FROM credentials WHERE id=?",String.class,item.id()));
  assertEquals("synthetic-vault-test-value",service.read(alice,item.id(),"192.0.2.1",null).password());
  assertFalse(db.queryForObject("SELECT mfa_enabled FROM users WHERE id=?",Boolean.class,alice.userId()));
 }
 @Test void healthStatisticsComeFromOnlyLiveOwnedCredentials(){
  assertNull(service.overview(alice).health().score());
  var first=tx.execute(s->service.save(alice,null,input("First",category()),"192.0.2.1",null));
  tx.execute(s->service.save(alice,null,input("Second",category()),"192.0.2.1",null));
  tx.execute(s->service.save(alice,null,new VaultService.Input("Weak","","","password123",category(),"",false),"192.0.2.1",null));
  var result=service.overview(alice);assertEquals(3,result.health().total());assertEquals(2,result.health().strong());assertEquals(1,result.health().weak());assertEquals(2,result.health().reused());
  assertEquals(0,service.overview(bob).health().total());assertTrue(service.assess(alice,"synthetic-vault-test-value",null).reused());assertFalse(service.assess(bob,"synthetic-vault-test-value",null).reused());
  assertFalse(result.toString().contains("synthetic-vault-test-value"));
  assertEquals(2,db.queryForObject("SELECT reused_passwords_count FROM password_health WHERE user_id=?",Integer.class,alice.userId()));
  tx.executeWithoutResult(s->service.delete(alice,first.id(),"192.0.2.1",null));
  assertEquals(0,service.overview(alice).health().reused());assertEquals(2,service.overview(alice).health().total());
 }
 JdbcTemplate db;VaultService service;TransactionTemplate tx;AccountPrincipal alice,bob;SharingService sharing;NotificationService notices;ShareExpiryService expiry;
 VaultService.Input input(String title,String category){return new VaultService.Input(title,"https://example.invalid","synthetic-user","synthetic-vault-test-value",category,"synthetic-note",false);}
 @BeforeEach void fixture(){
  String url=System.getenv("SECUREVAULT_TEST_PG_URL");
  if(url==null||!url.matches("jdbc:postgresql://127\\.0\\.0\\.1:[0-9]+/securevault_test"))throw new IllegalStateException("Disposable test database required");
  var ds=new DriverManagerDataSource(url,"postgres",System.getenv("SECUREVAULT_TEST_PG_PASSWORD"));db=new JdbcTemplate(ds);
  assertEquals("securevault-isolated-verification",db.queryForObject("SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()",String.class));
  tx=new TransactionTemplate(new DataSourceTransactionManager(ds));
  var telemetry=new ThreatTelemetry(db,new RiskPolicy(new MockEnvironment()),new ConfiguredLocationProvider(""),5,5,15);
  byte[] bytes=new byte[48];new java.security.SecureRandom().nextBytes(bytes);
  service=new VaultService(db,new VaultCrypto(Base64.getEncoder().encodeToString(bytes)),telemetry,new VaultEvents(telemetry));
  sharing=new SharingService(db,service,telemetry,new VaultEvents(telemetry));
  notices=new NotificationService(db);expiry=new ShareExpiryService(db,telemetry);
  alice=user();bob=user();
 }
 AccountPrincipal user(){UUID id=UUID.randomUUID();String n="vault-fixture-"+id;db.update("INSERT INTO users(id,username,email,password_hash,vault_key_salt) VALUES (?,?,?,'fixture-hash','fixture-salt')",id,n,n+"@example.invalid");return new AccountPrincipal(id,UUID.randomUUID(),null,n,n+"@example.invalid");}
 String category(){return service.categories(alice.userId()).get(0).id();}
 @Test void notificationsAreOwnedSecretFreeAndExpiryIsRecordedOnce(){
  var item=tx.execute(s->service.save(alice,null,input("Notification fixture",category()),"192.0.2.1",null));
  assertTrue(notices.unread(alice.userId())>=1);
  var notice=notices.list(alice.userId(),0,20,false).items().get(0);
  assertThrows(ResponseStatusException.class,()->notices.mark(bob.userId(),notice.id()));
  notices.mark(alice.userId(),notice.id());assertTrue(notices.list(alice.userId(),0,20,false).items().stream().anyMatch(n->n.id().equals(notice.id())&&n.read()));
  var share=tx.execute(s->sharing.create(alice,item.id(),bob.userId(),java.time.Instant.now().plusSeconds(600),"192.0.2.1",null));
  assertTrue(notices.list(bob.userId(),0,20,false).items().stream().anyMatch(n->n.title().equals("New credential received")));
  db.update("UPDATE sharing SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=?",share.id());
  tx.executeWithoutResult(s->expiry.expire());tx.executeWithoutResult(s->expiry.expire());
  assertEquals(1,db.queryForObject("SELECT count(*) FROM audit_logs WHERE action_type='SHARE_EXPIRED' AND context->>'shareRef'=?",Integer.class,share.id().toString()));
  assertTrue(notices.list(bob.userId(),0,20,false).items().stream().anyMatch(n->n.type().equals("SHARE_EXPIRED")));
  assertFalse(notices.list(alice.userId(),0,100,false).toString().contains("synthetic-vault-test-value"));
  notices.markAll(bob.userId());assertEquals(0,notices.unread(bob.userId()));
 }
 @Test void sharingIsReadOnlyOwnerControlledAndRevocationStopsFutureReads(){
  var item=tx.execute(s->service.save(alice,null,input("Shared fixture",category()),"192.0.2.1",null));
  var share=tx.execute(s->sharing.create(alice,item.id(),bob.userId(),java.time.Instant.now().plusSeconds(600),"192.0.2.1",null));
  assertEquals("VIEW",share.permission());assertEquals("ACTIVE",share.status());
  assertEquals(1,sharing.list(bob,false).size());assertEquals(1,service.overview(alice).sharedByMe());assertEquals(1,service.overview(bob).sharedWithMe());
  assertEquals("synthetic-vault-test-value",tx.execute(s->sharing.read(bob,share.id(),"192.0.2.2",null)).password());
  assertThrows(ResponseStatusException.class,()->service.save(bob,item.id(),input("Forbidden edit",category()),"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->sharing.create(bob,item.id(),user().userId(),null,"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->sharing.revoke(bob,share.id(),"192.0.2.2",null));
  tx.executeWithoutResult(s->sharing.updateExpiry(alice,share.id(),java.time.Instant.now().plusSeconds(1200),"192.0.2.1",null));
  tx.executeWithoutResult(s->sharing.revoke(alice,share.id(),"192.0.2.1",null));
  assertThrows(ResponseStatusException.class,()->sharing.read(bob,share.id(),"192.0.2.2",null));
  assertEquals("REVOKED",sharing.list(bob,false).get(0).status());assertTrue(sharing.history(alice).stream().anyMatch(h->h.action().equals("SHARE_REVOKED")));
  assertEquals(0,service.overview(bob).sharedWithMe());
 }
 @Test void expiryAndNonParticipantChecksDoNotDependOnUiOrScheduler(){
  var item=tx.execute(s->service.save(alice,null,input("Expiring fixture",category()),"192.0.2.1",null));
  var share=tx.execute(s->sharing.create(alice,item.id(),bob.userId(),java.time.Instant.now().plusSeconds(600),"192.0.2.1",null));
  assertThrows(ResponseStatusException.class,()->sharing.read(user(),share.id(),"192.0.2.3",null));
  db.update("UPDATE sharing SET expires_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=?",share.id());
  assertEquals("EXPIRED",sharing.list(bob,false).get(0).status());
  assertThrows(ResponseStatusException.class,()->sharing.read(bob,share.id(),"192.0.2.2",null));
  assertTrue(sharing.recipients(alice.userId(),bob.username()).stream().anyMatch(r->r.id().equals(bob.userId())));
  assertThrows(ResponseStatusException.class,()->sharing.recipients(alice.userId(),""));
  assertFalse(sharing.history(alice).toString().contains("synthetic-vault-test-value"));
 }
 @Test void createReadUpdateFavoriteAndSoftDeleteAreOwnedAndEncrypted(){
  var item=tx.execute(s->service.save(alice,null,input("Fixture item",category()),"192.0.2.1",null));
  assertNull(item.password());
  String encoded=db.queryForObject("SELECT encrypted_data FROM credentials WHERE id=?",String.class,item.id());
  assertFalse(encoded.contains("synthetic"));assertFalse(encoded.contains("Fixture item"));
  assertEquals("Encrypted credential",db.queryForObject("SELECT title FROM credentials WHERE id=?",String.class,item.id()));
  assertEquals("synthetic-vault-test-value",service.read(alice,item.id(),"192.0.2.1",null).password());
  tx.executeWithoutResult(s->service.save(alice,item.id(),input("Changed title",category()),"192.0.2.1",null));
  tx.executeWithoutResult(s->service.favorite(alice,item.id(),true,"192.0.2.1",null));
  assertEquals(1,service.list(alice,"changed","","TITLE",true).size());
  tx.executeWithoutResult(s->service.delete(alice,item.id(),"192.0.2.1",null));
  assertTrue(service.list(alice,"","","NEWEST",false).isEmpty());
  assertThrows(ResponseStatusException.class,()->service.read(alice,item.id(),"192.0.2.1",null));
 }
 @Test void crossAccountReadUpdateDeleteAndCustomCategoryUseAreRejected(){
  var category=tx.execute(s->service.createCategory(alice.userId(),"Private custom category"));
  assertFalse(service.categories(bob.userId()).stream().anyMatch(c->c.id().equals(category.id())));
  var item=tx.execute(s->service.save(alice,null,input("Owner fixture",category.id()),"192.0.2.1",null));
  assertTrue(service.list(bob,"","","NEWEST",false).isEmpty());
  assertThrows(ResponseStatusException.class,()->service.read(bob,item.id(),"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->service.save(bob,item.id(),input("Forbidden",category.id()),"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->service.delete(bob,item.id(),"192.0.2.2",null));
  assertThrows(ResponseStatusException.class,()->service.save(bob,null,input("Forbidden category",category.id()),"192.0.2.2",null));
  assertEquals(3,db.queryForObject("SELECT count(*) FROM audit_logs WHERE user_id=? AND action_type='VAULT_ACCESS_DENIED'",Integer.class,bob.userId()));
  assertEquals("Owner fixture",service.read(alice,item.id(),"192.0.2.1",null).title());
 }
 @Test void auditAndAdminMonitoringContainMetadataWithoutCredentialFields(){
  var item=tx.execute(s->service.save(alice,null,input("Fixture confidential title",category()),"192.0.2.1","Mozilla Windows Chrome/120"));
  String audit=db.queryForObject("SELECT details||context::text FROM audit_logs WHERE user_id=? AND action_type='CREDENTIAL_ADDED'",String.class,alice.userId());
  assertFalse(audit.contains("synthetic-vault-test-value"));assertFalse(audit.contains("synthetic-note"));assertFalse(audit.contains("confidential title"));
  assertTrue(audit.contains(item.id().toString()));assertTrue(audit.contains("Chrome"));
 }
}
