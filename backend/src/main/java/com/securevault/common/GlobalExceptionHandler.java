package com.securevault.common;

import com.securevault.auth.AuthController;
import jakarta.validation.ConstraintViolationException;
import java.time.Instant;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;
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

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> handleExpectedServiceError(ResponseStatusException exception) {
        String message = exception.getReason() == null ? "The requested operation could not be completed."
                : exception.getReason();
        return ResponseEntity.status(exception.getStatusCode()).body(new ErrorResponse(
                "ADMIN_OPERATION_REJECTED", message, Instant.now()));
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {}
}
