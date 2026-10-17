package com.securevault;

import com.securevault.auth.AuthController;
import com.securevault.auth.LoginService;
import com.securevault.auth.RegistrationService;
import com.securevault.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistrationControllerTest {
    @Test
    void newAndDuplicateAccountsHaveIdenticalPublicResponses() {
        var controller = new AuthController(mock(RegistrationService.class), mock(LoginService.class));
        var created = controller.register(new AuthController.RegistrationRequest(
                "alice", "alice@example.com", "correct-password"));
        var duplicate = new GlobalExceptionHandler().handleDuplicate(new DuplicateKeyException("private detail"));
        assertEquals(202, created.getStatusCode().value());
        assertEquals(created, duplicate);
    }
}
