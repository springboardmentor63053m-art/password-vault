package com.securevault.vault;

public class VaultKeyUnavailableException extends RuntimeException {
    public VaultKeyUnavailableException() {
        super("Vault encryption is not configured.");
    }
}
