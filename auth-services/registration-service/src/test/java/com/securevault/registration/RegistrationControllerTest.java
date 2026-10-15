package com.securevault.registration;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistrationControllerTest {
    @Test
    void newAndDuplicateAccountsHaveIdenticalPublicResponses() {
        var controller = new RegistrationController(mock(RegistrationService.class));
        var created = controller.register(new RegistrationController.RegistrationRequest(
                "alice", "alice@example.com", "correct-password"));
        var duplicate = new RegistrationExceptionHandler().handleDuplicate(new DuplicateKeyException("private detail"));
        assertEquals(202, created.getStatusCode().value());
        assertEquals(created, duplicate);
    }
}
