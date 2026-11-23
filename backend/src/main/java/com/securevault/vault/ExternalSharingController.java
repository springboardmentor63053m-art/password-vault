package com.securevault.vault;

import com.securevault.common.AccountAuthenticationInterceptor;
import com.securevault.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ExternalSharingController {
    private static final String TOKEN = "[A-Za-z0-9_-]{43}";
    private final ExternalSharingService service;
    private final ClientIpResolver ips;

    public ExternalSharingController(ExternalSharingService service, ClientIpResolver ips) {
        this.service = service;
        this.ips = ips;
    }

    public record Invitation(@NotNull UUID credentialId, @NotBlank @Email @Size(max=254) String email,
                             int minutes, boolean oneTime, @Size(max=240) String message) {
        @Override public String toString() { return "Invitation[redacted]"; }
    }
    public record Link(@NotNull @Pattern(regexp=TOKEN) String token) {
        @Override public String toString() { return "Link[redacted]"; }
    }
    public record Code(@NotNull @Pattern(regexp=TOKEN) String token, @NotNull @Pattern(regexp="[0-9]{6}") String code) {
        @Override public String toString() { return "Code[redacted]"; }
    }
    public record Redemption(@NotNull @Pattern(regexp=TOKEN) String token, @NotNull @Pattern(regexp=TOKEN) String grant) {
        @Override public String toString() { return "Redemption[redacted]"; }
    }

    @PostMapping("/api/account/shares/external")
    public ResponseEntity<?> create(@Valid @RequestBody Invitation body, HttpServletRequest request) {
        return mail(service.create(AccountAuthenticationInterceptor.principal(request), body.credentialId(),
                body.email(), body.minutes(), body.oneTime(), body.message(), ips.resolve(request)));
    }

    @GetMapping("/api/account/shares/external")
    public Object sent(HttpServletRequest request) {
        return service.sent(AccountAuthenticationInterceptor.principal(request).userId());
    }

    @DeleteMapping("/api/account/shares/external/{id}")
    public ResponseEntity<Void> revoke(@PathVariable UUID id, HttpServletRequest request) {
        service.revoke(AccountAuthenticationInterceptor.principal(request).userId(), id, ips.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/external-shares/inspect")
    public ResponseEntity<?> inspect(@Valid @RequestBody Link body) { return safe(service.inspect(body.token())); }

    @PostMapping("/api/external-shares/code")
    public ResponseEntity<?> code(@Valid @RequestBody Link body, HttpServletRequest request) {
        return mail(service.requestCode(body.token(), ips.resolve(request)));
    }

    @PostMapping("/api/external-shares/verify")
    public ResponseEntity<?> verify(@Valid @RequestBody Code body, HttpServletRequest request) {
        return safe(service.verify(body.token(), body.code(), ips.resolve(request)));
    }

    @PostMapping("/api/external-shares/retrieve")
    public ResponseEntity<?> retrieve(@Valid @RequestBody Redemption body, HttpServletRequest request) {
        return safe(service.retrieve(body.token(), body.grant(), ips.resolve(request)));
    }

    private ResponseEntity<?> safe(Object value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }

    private ResponseEntity<?> mail(ExternalSharingService.MailResult result) {
        return result.submitted() ? safe(result) : ResponseEntity.status(503).cacheControl(CacheControl.noStore())
                .body(Map.of("message", "Email submission failed. Check SMTP configuration or try again later."));
    }
}
