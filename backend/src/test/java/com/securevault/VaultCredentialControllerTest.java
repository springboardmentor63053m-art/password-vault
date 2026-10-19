package com.securevault;

import com.securevault.common.GlobalExceptionHandler;
import com.securevault.common.VaultSessionAuthorizationFilter;
import com.securevault.vault.VaultCredentialController;
import com.securevault.vault.VaultCredentialService;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class VaultCredentialControllerTest {
    private final UUID userId = UUID.randomUUID();
    private final UUID credentialId = UUID.randomUUID();
    private final VaultCredentialService service = mock(VaultCredentialService.class);
    private MockMvc mvc;

    @BeforeEach
    void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new VaultCredentialController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }

    @Test
    void listCreateViewUpdateAndDeleteUseAuthenticatedRequestIdentity() throws Exception {
        var summary = new VaultCredentialService.CredentialSummary(credentialId, "Example", "Website Login",
                "alice", "https://example.test", "Strong", OffsetDateTime.now());
        var detail = new VaultCredentialService.CredentialDetail(credentialId, "Example", "Website Login",
                "alice", "https://example.test", "private-secret", "Strong", OffsetDateTime.now());
        when(service.list(userId)).thenReturn(List.of(summary));
        when(service.create(eq(userId), any())).thenReturn(summary);
        when(service.get(userId, credentialId)).thenReturn(detail);
        when(service.update(eq(userId), eq(credentialId), any())).thenReturn(summary);

        mvc.perform(withUser(get("/api/vault/credentials")))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(credentialId.toString()))
                .andExpect(jsonPath("$[0].secret").doesNotExist());
        mvc.perform(withUser(post("/api/vault/credentials").contentType("application/json")
                        .content(requestBody())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.username").value("alice"));
        mvc.perform(withUser(get("/api/vault/credentials/{id}", credentialId)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.secret").value("private-secret"));
        mvc.perform(withUser(put("/api/vault/credentials/{id}", credentialId)
                        .contentType("application/json").content(requestBody())))
                .andExpect(status().isOk());
        mvc.perform(withUser(delete("/api/vault/credentials/{id}", credentialId)))
                .andExpect(status().isNoContent());

        verify(service).create(eq(userId), any());
        verify(service).update(eq(userId), eq(credentialId), any());
        verify(service).delete(userId, credentialId);
    }

    @Test
    void invalidCredentialFieldsAreRejectedBeforeServiceCall() throws Exception {
        mvc.perform(withUser(post("/api/vault/credentials").contentType("application/json")
                        .content("{\"title\":\"\",\"category\":\"Website Login\",\"username\":\"alice\",\"secret\":\"secret\"}")))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
        verifyNoInteractions(service);
    }

    private MockHttpServletRequestBuilder withUser(MockHttpServletRequestBuilder request) {
        return request.requestAttr(VaultSessionAuthorizationFilter.USER_ID_ATTRIBUTE, userId);
    }

    private String requestBody() {
        return "{\"title\":\"Example\",\"category\":\"Website Login\","
                + "\"username\":\"alice\",\"website\":\"https://example.test\",\"secret\":\"private-secret\"}";
    }
}
