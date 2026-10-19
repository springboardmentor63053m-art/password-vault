package com.securevault;

import com.securevault.vault.VaultEncryptionService;
import com.securevault.vault.VaultKeyUnavailableException;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class VaultEncryptionServiceTest {
    private final UUID credentialId = UUID.randomUUID();

    @Test
    void encryptsAndAuthenticatesSecretPayload() {
        var encryption = new VaultEncryptionService(key());
        var value = encryption.encrypt(credentialId,
                new VaultEncryptionService.CredentialSecrets("vault-user", "private-secret"));

        assertFalse(value.encryptedData().contains("private-secret"));
        assertEquals(new VaultEncryptionService.CredentialSecrets("vault-user", "private-secret"),
                encryption.decrypt(credentialId, value.encryptedData(), value.encryptionIv()));
        assertThrows(IllegalStateException.class,
                () -> encryption.decrypt(UUID.randomUUID(), value.encryptedData(), value.encryptionIv()));
    }

    @Test
    void missingOrInvalidEncryptionKeyFailsClosed() {
        var missing = new VaultEncryptionService("");
        assertThrows(VaultKeyUnavailableException.class, () -> missing.encrypt(
                credentialId, new VaultEncryptionService.CredentialSecrets("user", "secret")));

        var wrongSize = new VaultEncryptionService(Base64.getEncoder().encodeToString(new byte[16]));
        assertThrows(VaultKeyUnavailableException.class, () -> wrongSize.encrypt(
                credentialId, new VaultEncryptionService.CredentialSecrets("user", "secret")));
    }

    private String key() {
        return Base64.getEncoder().encodeToString(new byte[32]);
    }
}
