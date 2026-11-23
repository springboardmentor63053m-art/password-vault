package com.securevault.vault;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/** Server-side authenticated encryption. Vault keys are independent of account/JWT/MFA keys. */
@Component
public class VaultCrypto {
    private final byte[] root;
    private final SecureRandom random = new SecureRandom();

    public VaultCrypto(@Value("${security.vault.encryption-key-base64:}") String encoded) {
        if (encoded == null || encoded.isBlank()) { root = null; return; }
        try {
            root = Base64.getDecoder().decode(encoded.trim());
            if (root.length < 32) throw new IllegalArgumentException();
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Vault encryption key must contain at least 32 random bytes in base64.");
        }
    }

    private SecretKeySpec key(UUID owner) throws Exception {
        if (root == null) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Vault encryption is not configured. Contact the operator.");
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(root, "HmacSHA256"));
        return new SecretKeySpec(mac.doFinal(("SecureVault/credential/v1/" + owner)
                .getBytes(StandardCharsets.UTF_8)), "AES");
    }

    private byte[] aad(UUID owner, UUID credential) {
        return ("SecureVault/credential/v1/" + owner + "/" + credential).getBytes(StandardCharsets.UTF_8);
    }

    public Sealed encrypt(UUID owner, UUID credential, String plaintext) {
        try {
            byte[] nonce = new byte[12]; random.nextBytes(nonce);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(owner), new GCMParameterSpec(128, nonce));
            cipher.updateAAD(aad(owner, credential));
            return new Sealed(Base64.getEncoder().encodeToString(cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8))),
                    Base64.getEncoder().encodeToString(nonce));
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new IllegalStateException("Credential encryption failed."); }
    }

    public String decrypt(UUID owner, UUID credential, String data, String nonce) {
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(owner), new GCMParameterSpec(128, Base64.getDecoder().decode(nonce)));
            cipher.updateAAD(aad(owner, credential));
            return new String(cipher.doFinal(Base64.getDecoder().decode(data)), StandardCharsets.UTF_8);
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Credential integrity could not be verified. No data was returned."); }
    }

    public record Sealed(String data, String nonce) {
        @Override public String toString() { return "Sealed[redacted]"; }
    }
}
