package com.securevault.vault;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.DataOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** AES-256-GCM encryption for credential secret fields. The key is supplied out of band. */
@Service
public class VaultEncryptionService {
    private static final int KEY_BYTES = 32;
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final String encodedKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public VaultEncryptionService(
            @Value("${security.vault.encryption-key-base64:}") String encodedKey) {
        this.encodedKey = encodedKey;
    }

    public EncryptedValue encrypt(UUID credentialId, CredentialSecrets secrets) {
        try {
            byte[] iv = new byte[IV_BYTES];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(credentialId.toString().getBytes(StandardCharsets.UTF_8));
            byte[] ciphertext = cipher.doFinal(serialize(secrets));
            return new EncryptedValue(
                    Base64.getEncoder().encodeToString(ciphertext),
                    Base64.getEncoder().encodeToString(iv));
        } catch (VaultKeyUnavailableException exception) {
            throw exception;
        } catch (GeneralSecurityException | IOException exception) {
            throw new IllegalStateException("Credential encryption failed.", exception);
        }
    }

    public CredentialSecrets decrypt(UUID credentialId, String encryptedData, String encodedIv) {
        try {
            byte[] iv = Base64.getDecoder().decode(encodedIv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(TAG_BITS, iv));
            cipher.updateAAD(credentialId.toString().getBytes(StandardCharsets.UTF_8));
            return deserialize(cipher.doFinal(Base64.getDecoder().decode(encryptedData)));
        } catch (VaultKeyUnavailableException exception) {
            throw exception;
        } catch (GeneralSecurityException | IllegalArgumentException | IOException exception) {
            throw new IllegalStateException("Credential decryption failed.", exception);
        }
    }

    private SecretKeySpec key() {
        try {
            byte[] keyBytes = Base64.getDecoder().decode(encodedKey);
            if (keyBytes.length != KEY_BYTES) throw new IllegalArgumentException();
            return new SecretKeySpec(keyBytes, "AES");
        } catch (IllegalArgumentException exception) {
            throw new VaultKeyUnavailableException();
        }
    }

    private byte[] serialize(CredentialSecrets secrets) throws IOException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (DataOutputStream output = new DataOutputStream(bytes)) {
            output.writeUTF(secrets.username());
            output.writeUTF(secrets.secret());
        }
        return bytes.toByteArray();
    }

    private CredentialSecrets deserialize(byte[] payload) throws IOException {
        try (DataInputStream input = new DataInputStream(new ByteArrayInputStream(payload))) {
            CredentialSecrets secrets = new CredentialSecrets(input.readUTF(), input.readUTF());
            if (input.available() != 0) throw new IOException("Unexpected credential payload data.");
            return secrets;
        }
    }

    public record CredentialSecrets(String username, String secret) {
        @Override
        public String toString() { return "CredentialSecrets[redacted]"; }
    }
    public record EncryptedValue(String encryptedData, String encryptionIv) {}
}
