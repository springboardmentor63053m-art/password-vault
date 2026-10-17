package com.securevault;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(properties = {
    "security.jwt.secret-base64=c2VjdXJldmF1bHQtdGVhbTMtZGV2ZWxvcG1lbnQta2V5LWNoYW5nZS1tZS00OC1ieXRlcy1zZWNyZXQh",
    "spring.datasource.url=jdbc:postgresql://localhost:5432/securevault_test",
    "spring.autoconfigure.exclude=org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration"
})
class ApplicationContextTest {
    @Test
    void contextLoads() {
    }
}
