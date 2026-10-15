package com.securevault.registration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class ApplicationContextTest {
    @MockitoBean
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ApplicationContext context;

    @Test
    void contextLoads() {
        assertNotNull(context.getBean(RegistrationService.class));
        assertNotNull(context.getBean(RegistrationController.class));
        assertNotNull(context.getBean(AuthRateLimitFilter.class));
        assertNotNull(context.getBean(InputExceptionHandler.class));
        assertNotNull(context.getBean(RegistrationExceptionHandler.class));
    }
}
