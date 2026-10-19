package com.securevault;

import com.securevault.vault.VaultCredentialNotFoundException;
import com.securevault.vault.VaultCredentialService;
import com.securevault.vault.VaultEncryptionService;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class VaultCredentialServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final VaultCredentialService service = new VaultCredentialService(jdbc,
            new VaultEncryptionService(Base64.getEncoder().encodeToString(new byte[32])));
    private final UUID ownerId = UUID.randomUUID();
    private final UUID vaultId = UUID.randomUUID();

    @Test
    void createStoresAuthenticatedCiphertextInOwnersPersonalVault() {
        String category = "Website Login";
        var request = new VaultCredentialService.CredentialRequest(
                "Example", category, "alice", "https://example.test", "plaintext-secret");
        when(jdbc.queryForList(contains("FROM categories"), eq(Integer.class), eq(category))).thenReturn(List.of(1));
        when(jdbc.queryForObject(contains("SELECT id FROM users"), eq(UUID.class), eq(ownerId))).thenReturn(ownerId);
        when(jdbc.query(contains("SELECT id FROM vaults"), any(RowMapper.class), eq(ownerId))).thenReturn(List.of(vaultId));
        when(jdbc.update(contains("INSERT INTO credentials"), any(Object[].class))).thenReturn(1);

        var created = service.create(ownerId, request);

        assertNotNull(created.id());
        assertEquals("alice", created.username());
        assertEquals("Example", created.title());
        org.mockito.ArgumentCaptor<Object[]> arguments = org.mockito.ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("INSERT INTO credentials"), arguments.capture());
        Object[] stored = arguments.getValue();
        assertEquals(vaultId, stored[1]);
        assertFalse(stored[5].toString().contains("plaintext-secret"));
        var decrypted = new VaultEncryptionService(Base64.getEncoder().encodeToString(new byte[32]))
                .decrypt((UUID) stored[0], stored[5].toString(), stored[6].toString());
        assertEquals("plaintext-secret", decrypted.secret());
    }

    @Test
    void listFiltersByVaultOwnerAndReturnsNoRowsForOtherUsers() {
        when(jdbc.query(contains("WHERE v.owner_id = ?"), any(RowMapper.class), eq(ownerId))).thenReturn(List.of());
        assertTrue(service.list(ownerId).isEmpty());
        verify(jdbc).query(contains("WHERE v.owner_id = ?"), any(RowMapper.class), eq(ownerId));
    }

    @Test
    void getDoesNotDiscloseCredentialOwnedByDifferentUser() {
        UUID anotherUser = UUID.randomUUID();
        UUID credentialId = UUID.randomUUID();
        when(jdbc.query(contains("WHERE c.id = ? AND v.owner_id = ?"), any(RowMapper.class),
                eq(credentialId), eq(anotherUser))).thenReturn(List.of());

        assertThrows(VaultCredentialNotFoundException.class, () -> service.get(anotherUser, credentialId));
    }

    @Test
    void updateRequiresOwnershipAndWritesOnlyEncryptedSecretPayload() {
        UUID credentialId = UUID.randomUUID();
        String category = "API Keys";
        var request = new VaultCredentialService.CredentialRequest("API", category, "bot", "", "token-value");
        when(jdbc.queryForList(contains("FROM categories"), eq(Integer.class), eq(category))).thenReturn(List.of(6));
        when(jdbc.update(contains("UPDATE credentials c SET"), any(Object[].class))).thenReturn(0);

        assertThrows(VaultCredentialNotFoundException.class, () -> service.update(ownerId, credentialId, request));
        verify(jdbc).update(contains("c.vault_id = v.id AND v.owner_id = ?"), any(Object[].class));
    }

    @Test
    void ownerCanUpdateCredential() {
        UUID credentialId = UUID.randomUUID();
        String category = "API Keys";
        var request = new VaultCredentialService.CredentialRequest("API", category, "bot", "", "new-token");
        when(jdbc.queryForList(contains("FROM categories"), eq(Integer.class), eq(category))).thenReturn(List.of(6));
        when(jdbc.update(contains("UPDATE credentials c SET"), any(Object[].class))).thenReturn(1);

        var updated = service.update(ownerId, credentialId, request);

        assertEquals(credentialId, updated.id());
        assertEquals("API", updated.title());
        verify(jdbc).update(contains("v.owner_id = ?"), any(Object[].class));
    }

    @Test
    void deleteIsScopedToTheOwnersVault() {
        UUID credentialId = UUID.randomUUID();
        when(jdbc.update(contains("DELETE FROM credentials c USING vaults v"), any(Object[].class))).thenReturn(0);
        assertThrows(VaultCredentialNotFoundException.class, () -> service.delete(ownerId, credentialId));
        verify(jdbc).update(contains("c.vault_id = v.id AND v.owner_id = ?"), any(Object[].class));
    }

    @Test
    void ownerCanDeleteCredential() {
        UUID credentialId = UUID.randomUUID();
        when(jdbc.update(contains("DELETE FROM credentials c USING vaults v"), any(Object[].class))).thenReturn(1);
        assertDoesNotThrow(() -> service.delete(ownerId, credentialId));
        verify(jdbc).update(contains("c.vault_id = v.id AND v.owner_id = ?"), any(Object[].class));
    }
}
