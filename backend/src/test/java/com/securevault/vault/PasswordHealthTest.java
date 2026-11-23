package com.securevault.vault;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class PasswordHealthTest {
 @Test void explainsCommonShortAndLongPasswordsWithoutClaimingBreachDetection(){
  assertEquals("Very Weak",PasswordHealth.assess("password123").strength());
  assertEquals("Very Weak",PasswordHealth.assess("aaaaaaaaaaaaaaaaaaaa").strength());
  assertTrue(PasswordHealth.assess("aB4!xY7#qR2$mN8@").score()>=70);
  assertTrue(PasswordHealth.assess("short").suggestions().stream().anyMatch(s->s.contains("16 characters")));
  assertTrue(PasswordHealth.assess("aB4!xY7#qR2$mN8@").suggestions().stream().anyMatch(s->s.contains("not a breach check")));
 }
}
