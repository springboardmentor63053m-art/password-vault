package com.securevault.admin;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AdminRoleChangeTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final UUID actorId = UUID.randomUUID();
    private final UUID targetId = UUID.randomUUID();
    private final AdminPrincipal actor = new AdminPrincipal(
            actorId, UUID.randomUUID(), UUID.randomUUID(), "admin", "admin@example.com");
    private AdminService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        service = new AdminService(jdbc, 900);
        when(jdbc.query(contains("SELECT r.role_name"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(List.of("ROLE_USER"));
        when(jdbc.queryForObject(contains("SELECT username, email"), any(RowMapper.class), any(Object[].class)))
                .thenReturn(new String[] {"alice", "alice@example.com"});
    }

    @Test
    void rejectsRoleChangeWhenActingAdminPasswordIsWrong() {
        when(jdbc.queryForObject(contains("SELECT password_hash"), eq(String.class), any(Object[].class)))
                .thenReturn(new BCryptPasswordEncoder().encode("right-password"));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.setUserRole(targetId, "ROLE_ADMIN", "wrong-password", actor, "192.0.2.8"));

        assertEquals(401, error.getStatusCode().value());
        verify(jdbc, never()).update(startsWith("DELETE FROM user_roles"), any(Object[].class));
        verify(jdbc, never()).update(contains("INSERT INTO audit_logs"), any(Object[].class));
    }

    @Test
    void successfulRoleChangeWritesAnAuditEntryNamingActorAndTarget() {
        when(jdbc.queryForObject(contains("SELECT password_hash"), eq(String.class), any(Object[].class)))
                .thenReturn(new BCryptPasswordEncoder().encode("right-password"));
        when(jdbc.queryForObject(contains("SELECT id FROM roles"), eq(Integer.class), any(Object[].class)))
                .thenReturn(3);

        service.setUserRole(targetId, "ROLE_ADMIN", "right-password", actor, "192.0.2.8");

        verify(jdbc).update(startsWith("DELETE FROM user_roles"), eq(targetId));
        verify(jdbc).update(startsWith("INSERT INTO user_roles"), eq(targetId), eq(3));
        ArgumentCaptor<Object[]> auditArgs = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).update(contains("INSERT INTO audit_logs"), auditArgs.capture());
        Object[] values = auditArgs.getValue();
        assertEquals(actorId, values[0]);
        assertEquals("USER_ROLE_CHANGED", values[1]);
        assertEquals("192.0.2.8", values[2]);
        assertTrue(values[3].toString().contains("admin (admin@example.com)"));
        assertTrue(values[3].toString().contains(targetId.toString()));
        assertTrue(values[3].toString().contains("alice, alice@example.com"));
    }
}
