package com.securevault.registration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthInputValidationTest {
    private final RegistrationService service = mock(RegistrationService.class);
    private MockMvc mvc;

    @Test
    void diagnosticStringsDoNotContainPasswords() {
        String secret = "secret-do-not-log";
        org.junit.jupiter.api.Assertions.assertFalse(new RegistrationController.RegistrationRequest(
                "alice", "alice@example.com", secret).toString().contains(secret));
    }

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new RegistrationController(service))
                .setControllerAdvice(new InputExceptionHandler(), new RegistrationExceptionHandler())
                .addFilters(new AuthRateLimitFilter())
                .build();
    }

    @Test
    void rejectsPasswordsAboveBcryptByteLimitWithoutEchoingThem() throws Exception {
        String password = "\u00e9".repeat(37);

        mvc.perform(post("/api/registration/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(password)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(content().string(not(containsString(password))));

        verifyNoInteractions(service);
    }

    @Test
    void acceptsExactly72Utf8Bytes() throws Exception {
        String password = "\u00e9".repeat(36);

        mvc.perform(post("/api/registration/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request(password)))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.code").value("REQUEST_RECEIVED"))
                .andExpect(content().string(not(containsString(password))));

        verify(service).register("alice", "alice@example.com", password);
    }

    @Test
    void malformedJsonReturnsAGenericErrorWithoutEchoingTheRequest() throws Exception {
        String secret = "secret-do-not-leak";

        mvc.perform(post("/api/registration/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"alice\",\"email\":\"alice@example.com\",\"password\":\"" + secret + "\""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_REQUEST"))
                .andExpect(jsonPath("$.message").value("Request is invalid. Check the supplied fields."))
                .andExpect(content().string(not(containsString(secret))));

        verifyNoInteractions(service);
    }

    @Test
    void duplicateAndNewAccountsHaveIdenticalPublicResponses() throws Exception {
        String body = request("correct-password");
        var created = mvc.perform(post("/api/registration/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andReturn().getResponse();

        when(service.register("alice", "alice@example.com", "correct-password"))
                .thenThrow(new DuplicateKeyException("private-database-detail"));
        var duplicate = mvc.perform(post("/api/registration/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andExpect(content().string(not(containsString("private-database-detail"))))
                .andReturn().getResponse();

        assertEquals(created.getContentAsString(), duplicate.getContentAsString());
        assertEquals(created.getContentType(), duplicate.getContentType());
    }

    private String request(String password) {
        return "{\"username\":\"alice\",\"email\":\"alice@example.com\",\"password\":\"" + password + "\"}";
    }
}
