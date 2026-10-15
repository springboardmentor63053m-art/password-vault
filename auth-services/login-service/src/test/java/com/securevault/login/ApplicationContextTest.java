package com.securevault.login;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE, properties = {
        // Public, test-only 48-byte key. Never used by application configuration.
        "security.jwt.secret-base64=x/Fq3HGJMxsgM8MuFVTNJEdQiKArxMB9s7BE0/PU5E9i4SBFDUtuAbrH/jUT1YvT"
})
class ApplicationContextTest {
    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertNotNull(context.getBean(LoginService.class));
        assertNotNull(context.getBean(LoginController.class));
        assertNotNull(context.getBean(AuthRateLimitFilter.class));
        assertNotNull(context.getBean(InputExceptionHandler.class));
    }
}
