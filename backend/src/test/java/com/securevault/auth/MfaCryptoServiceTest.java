package com.securevault.auth;

import java.time.Instant;
import java.util.Base64;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class MfaCryptoServiceTest {
    private MfaCryptoService crypto;

    @BeforeEach
    void setUp() {
        byte[] key = new byte[48];
        new java.security.SecureRandom().nextBytes(key);
        crypto = new MfaCryptoService(Base64.getEncoder().encodeToString(key));
    }

    @Test
    void followsTheRfc6238Sha1SixDigitVector() {
        String seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
        assertEquals("287082", MfaCryptoService.codeForStep(seed, 1));
        assertEquals(1, crypto.matchingTotpStep(seed, "287082", Instant.ofEpochSecond(59), -1));
    }

    @Test
    void rejectsReplayAndMalformedCodes() {
        String seed = crypto.newSecret();
        long step = Instant.now().getEpochSecond() / 30;
        String code = MfaCryptoService.codeForStep(seed, step);
        assertEquals(step, crypto.matchingTotpStep(seed, code, Instant.ofEpochSecond(step * 30), step - 1));
        assertEquals(-1, crypto.matchingTotpStep(seed, code, Instant.ofEpochSecond(step * 30), step));
        assertEquals(-1, crypto.matchingTotpStep(seed, "12x456", Instant.now(), -1));
    }

    @Test
    void protectsSeedsWithAuthenticatedEncryptionAndBuildsStandardEnrollmentUri() {
        String secret = crypto.newSecret();
        String encrypted = crypto.encryptSecret(secret);
        assertTrue(crypto.isEncrypted(encrypted));
        assertEquals(secret, crypto.decryptSecret(encrypted));
        assertNotEquals(secret, encrypted);
        assertTrue(crypto.otpauthUri("alice@example.com", secret).startsWith("otpauth://totp/"));
        assertTrue(crypto.otpauthUri("alice@example.com", secret).contains("issuer=SecureVault"));
    }
}
