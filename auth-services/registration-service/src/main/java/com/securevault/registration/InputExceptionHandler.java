package com.securevault.registration;

import java.time.Instant;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class InputExceptionHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class,
            ConstraintViolationException.class, HandlerMethodValidationException.class})
    public ResponseEntity<ErrorResponse> invalidInput(Exception exception) {
        // Never echo rejected fields, passwords, or the raw request body.
        return ResponseEntity.badRequest().body(new ErrorResponse(
                "INVALID_REQUEST", "Request is invalid. Check the supplied fields.", Instant.now()));
    }

    public record ErrorResponse(String code, String message, Instant timestamp) {}
}