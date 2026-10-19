package com.securevault;

import com.securevault.auth.RegistrationService;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RegistrationServiceTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);

    @Test
    void publicRegistrationAlwaysAssignsOnlyRoleUser() {
        UUID userId = UUID.randomUUID();
        when(jdbc.queryForObject(startsWith("INSERT INTO users"), eq(UUID.class), any(Object[].class)))
                .thenReturn(userId);
        when(jdbc.update(contains("INSERT INTO user_roles"), eq(userId), eq("ROLE_USER"))).thenReturn(1);

        var created = new RegistrationService(jdbc).register("Alice", "Alice@example.com", "strong-password");

        assertEquals(userId, created.id());
        verify(jdbc).update(contains("INSERT INTO user_roles"), eq(userId), eq("ROLE_USER"));
        verify(jdbc, never()).update(contains("INSERT INTO user_roles"), eq(userId), eq("ROLE_ADMIN"));
        verify(jdbc, never()).update(contains("INSERT INTO user_roles"), eq(userId), eq("ROLE_TEAM_MEMBER"));
    }
}
