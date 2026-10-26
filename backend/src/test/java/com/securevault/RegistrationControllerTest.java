package com.securevault;

import com.securevault.auth.AuthController;
import com.securevault.auth.LoginService;
import com.securevault.auth.RegistrationService;
import com.securevault.common.GlobalExceptionHandler;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.dao.DataAccessResourceFailureException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RegistrationControllerTest {
    @Test
    void newAndDuplicateAccountsHaveIdenticalPublicResponses() {
        var controller = new AuthController(
                mock(RegistrationService.class), mock(LoginService.class), mock(JdbcTemplate.class));
        var created = controller.register(new AuthController.RegistrationRequest(
                "alice", "alice@example.com", "correct-password"));
        var duplicate = new GlobalExceptionHandler().handleDuplicate(new DuplicateKeyException("private detail"));
        assertEquals(202, created.getStatusCode().value());
        assertEquals(created, duplicate);
    }

    @Test
    void healthRequiresTheDatabaseSchema() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        doThrow(new DataAccessResourceFailureException("private database detail"))
                .when(jdbc).execute("SELECT 1 FROM users LIMIT 0");
        var controller = new AuthController(
                mock(RegistrationService.class), mock(LoginService.class), jdbc);

        var response = controller.health();

        assertEquals(503, response.getStatusCode().value());
        assertEquals("DOWN", response.getBody().status());
    }
}
