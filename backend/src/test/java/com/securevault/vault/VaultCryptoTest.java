package com.securevault.vault;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;
import static org.junit.jupiter.api.Assertions.*;
class VaultCryptoTest {
    VaultCrypto crypto(){byte[] bytes=new byte[48];new java.security.SecureRandom().nextBytes(bytes);return new VaultCrypto(Base64.getEncoder().encodeToString(bytes));}
    @Test void ciphertextIsRandomizedAndBoundToOwnerAndCredential(){
        var c=crypto();UUID owner=UUID.randomUUID(),id=UUID.randomUUID();
        var a=c.encrypt(owner,id,"synthetic-sensitive-fixture");
        var b=c.encrypt(owner,id,"synthetic-sensitive-fixture");
        assertNotEquals(a.data(),b.data());assertFalse(a.data().contains("synthetic"));
        assertTrue(c.decrypt(owner,id,a.data(),a.nonce()).startsWith("synthetic"));
        assertThrows(ResponseStatusException.class,()->c.decrypt(UUID.randomUUID(),id,a.data(),a.nonce()));
        assertThrows(ResponseStatusException.class,()->c.decrypt(owner,UUID.randomUUID(),a.data(),a.nonce()));
        byte[] tampered=Base64.getDecoder().decode(a.data());tampered[0]^=1;
        assertThrows(ResponseStatusException.class,()->c.decrypt(owner,id,Base64.getEncoder().encodeToString(tampered),a.nonce()));
        assertFalse(a.toString().contains(a.data()));
    }
    @Test void absentKeyDisablesVaultOnlyAndNeverFallsBackToAuthenticationKeys(){
        var c=new VaultCrypto("");
        assertThrows(ResponseStatusException.class,()->c.encrypt(UUID.randomUUID(),UUID.randomUUID(),"fixture"));
        assertThrows(IllegalArgumentException.class,()->new VaultCrypto("not-base64"));
    }
}
