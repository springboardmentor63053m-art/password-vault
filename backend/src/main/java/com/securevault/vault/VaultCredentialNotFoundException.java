package com.securevault.vault;

public class VaultCredentialNotFoundException extends RuntimeException {
    public VaultCredentialNotFoundException() {
        super("Credential not found.");
    }
}
