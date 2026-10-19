package com.securevault.common;

import com.securevault.auth.AuthController;
import com.securevault.vault.VaultCredentialNotFoundException;
import com.securevault.vault.VaultKeyUnavailableException;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler({
        MethodArgumentNotValidException.class,
        HttpMessageNotReadableException.class,
        ConstraintViolationException.class,
        HandlerMethodValidationException.class
    })
    public ResponseEntity<ErrorResponse> handleInvalidInput(Exception exception) {
        // Never echo rejected fields, passwords, or the raw request body.
        return ResponseEntity.badRequest().body(new ErrorResponse(
                "INVALID_REQUEST", "Request is invalid. Check the supplied fields.", Instant.now()));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<AuthController.RegistrationAcknowledgement> handleDuplicate(DuplicateKeyException exception) {
        // Consistent opaque response for duplicates prevents account enumeration
        return AuthController.acknowledgement();
    }

    @ExceptionHandler(VaultCredentialNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleMissingVaultCredential(VaultCredentialNotFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(
                "CREDENTIAL_NOT_FOUND", "Credential not found.", Instant.now()));
    }

    @ExceptionHandler(VaultKeyUnavailableException.class)
    public ResponseEntity<ErrorResponse> handleMissingVaultKey(VaultKeyUnavailableException exception) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(new ErrorResponse(
                "VAULT_ENCRYPTION_UNAVAILABLE",
                "Vault encryption is not configured. Set VAULT_ENCRYPTION_KEY_BASE64 to a base64-encoded 32-byte key.",
                Instant.now()));
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {}
}
