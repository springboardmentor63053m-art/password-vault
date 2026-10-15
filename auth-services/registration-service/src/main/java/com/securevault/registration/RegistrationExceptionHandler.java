package com.securevault.registration;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class RegistrationExceptionHandler {
    @ExceptionHandler(DuplicateKeyException.class)
    public ResponseEntity<RegistrationController.RegistrationAcknowledgement> handleDuplicate(DuplicateKeyException exception) {
        return RegistrationController.acknowledgement();
    }
}
