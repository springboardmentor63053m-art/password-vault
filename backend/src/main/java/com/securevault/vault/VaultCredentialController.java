package com.securevault.vault;

import com.securevault.common.VaultSessionAuthorizationFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/vault/credentials")
public class VaultCredentialController {
    private final VaultCredentialService service;

    public VaultCredentialController(VaultCredentialService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<VaultCredentialService.CredentialSummary>> list(HttpServletRequest request) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(service.list(userId(request)));
    }

    @PostMapping
    public ResponseEntity<VaultCredentialService.CredentialSummary> create(
            HttpServletRequest request, @Valid @RequestBody CredentialRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).cacheControl(org.springframework.http.CacheControl.noStore())
                .body(service.create(userId(request), body.toServiceRequest()));
    }

    @GetMapping("/{credentialId}")
    public ResponseEntity<VaultCredentialService.CredentialDetail> get(
            HttpServletRequest request, @PathVariable UUID credentialId) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(service.get(userId(request), credentialId));
    }

    @PutMapping("/{credentialId}")
    public ResponseEntity<VaultCredentialService.CredentialSummary> update(
            HttpServletRequest request, @PathVariable UUID credentialId,
            @Valid @RequestBody CredentialRequest body) {
        return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                .body(service.update(userId(request), credentialId, body.toServiceRequest()));
    }

    @DeleteMapping("/{credentialId}")
    public ResponseEntity<Void> delete(HttpServletRequest request, @PathVariable UUID credentialId) {
        service.delete(userId(request), credentialId);
        return ResponseEntity.noContent().build();
    }

    private UUID userId(HttpServletRequest request) {
        Object id = request.getAttribute(VaultSessionAuthorizationFilter.USER_ID_ATTRIBUTE);
        if (!(id instanceof UUID userId)) throw new IllegalStateException("Authenticated user is unavailable.");
        return userId;
    }

    public record CredentialRequest(
            @NotBlank @Size(max = 255) String title,
            @NotBlank @Size(max = 50) String category,
            @NotBlank @Size(max = 255) String username,
            @Size(max = 2048) String website,
            @NotBlank @Size(max = 10000) String secret) {
        private VaultCredentialService.CredentialRequest toServiceRequest() {
            return new VaultCredentialService.CredentialRequest(title, category, username, website, secret);
        }

        @Override
        public String toString() { return "CredentialRequest[redacted]"; }
    }
}
