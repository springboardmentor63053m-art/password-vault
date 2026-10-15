package com.securevault.login;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthInputValidationTest {
    private final LoginService service = mock(LoginService.class);
    private MockMvc mvc;

    @Test
    void diagnosticStringsDoNotContainPasswordsOrTokens() {
        String secret = "secret-do-not-log";
        org.junit.jupiter.api.Assertions.assertFalse(
                new LoginController.LoginRequest("alice", secret).toString().contains(secret));
        org.junit.jupiter.api.Assertions.assertFalse(
                new LoginController.LoginResponse(secret, "Bearer", Instant.now(), null).toString().contains(secret));
    }

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new LoginController(service))
                .setControllerAdvice(new InputExceptionHandler())
                .addFilters(new AuthRateLimitFilter())
                .build();
    }

    @Test
    void rejectsPasswordsAboveBcryptByteLimitWithoutEchoingThem() throws Exception {
        String password = "\u00e9".repeat(37);

        mvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(password)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString(password))));

        verifyNoInteractions(service);
    }

    @Test
    void acceptsExactly72Utf8BytesAndSerializesTheTokenAndExpiry() throws Exception {
        String password = "\u00e9".repeat(36);
        Instant expiresAt = Instant.parse("2026-10-15T12:00:00Z");
        var user = new LoginController.UserResponse(UUID.randomUUID(), "alice", "alice@example.com");
        var response = new LoginController.LoginResponse("test-access-token", "Bearer", expiresAt, user);
        when(service.authenticate(eq("alice"), eq(password), anyString(), nullable(String.class)))
                .thenReturn(new LoginService.AuthenticationResult(true, response, null, null, 200));

        mvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("test-access-token"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresAt").value(expiresAt.toString()))
                .andExpect(content().string(not(containsString(password))));

        verify(service).authenticate(eq("alice"), eq(password), anyString(), nullable(String.class));
    }

    @Test
    void malformedJsonReturnsAGenericErrorWithoutEchoingTheRequest() throws Exception {
        String secret = "secret-do-not-leak";

        mvc.perform(post("/api/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"alice\",\"password\":\"" + secret + "\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Request is invalid. Check the supplied fields."))
                .andExpect(content().string(not(containsString(secret))));

        verifyNoInteractions(service);
    }

    private String request(String password) {
        return "{\"identifier\":\"alice\",\"password\":\"" + password + "\"}";
    }
}
