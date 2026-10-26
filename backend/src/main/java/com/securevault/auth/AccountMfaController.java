package com.securevault.auth;

import com.securevault.common.AccountAuthenticationInterceptor;
import com.securevault.common.AccountPrincipal;
import com.securevault.common.BcryptPasswordLength;
import com.securevault.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001"})
@Validated
@RestController
@RequestMapping("/api/account/mfa")
public class AccountMfaController {
    private final AccountMfaService mfaService;
    private final ClientIpResolver clientIpResolver;

    public AccountMfaController(AccountMfaService mfaService, ClientIpResolver clientIpResolver) {
        this.mfaService = mfaService;
        this.clientIpResolver = clientIpResolver;
    }

    @GetMapping
    public AccountMfaService.MfaStatus status(HttpServletRequest request) {
        return mfaService.status(principal(request).userId());
    }

    @PostMapping("/totp/setup")
    public AccountMfaService.TotpSetup beginSetup(@Valid @RequestBody SetupTotpRequest body,
                                                 HttpServletRequest request) {
        return mfaService.startTotpSetup(principal(request).userId(), body.currentPassword(),
                clientIpResolver.resolve(request));
    }

    @PostMapping("/totp/confirm")
    public ResponseEntity<Void> confirmSetup(@Valid @RequestBody TotpCodeRequest body,
                                             HttpServletRequest request) {
        mfaService.confirmTotp(principal(request).userId(), body.code(), clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/totp")
    public ResponseEntity<Void> disable(@Valid @RequestBody DisableTotpRequest body,
                                        HttpServletRequest request) {
        mfaService.disableTotp(principal(request).userId(), body.currentPassword(), body.code(),
                clientIpResolver.resolve(request));
        return ResponseEntity.noContent().build();
    }

    private AccountPrincipal principal(HttpServletRequest request) {
        return AccountAuthenticationInterceptor.principal(request);
    }

    public record TotpCodeRequest(@NotBlank @Pattern(regexp = "[0-9]{6}") String code) {
        @Override public String toString() { return "TotpCodeRequest[redacted]"; }
    }

    public record SetupTotpRequest(@NotBlank @Size(max = 72) @BcryptPasswordLength String currentPassword) {
        @Override public String toString() { return "SetupTotpRequest[redacted]"; }
    }

    public record DisableTotpRequest(
            @NotBlank @Size(max = 72) @BcryptPasswordLength String currentPassword,
            @NotBlank @Pattern(regexp = "[0-9]{6}") String code) {
        @Override public String toString() { return "DisableTotpRequest[redacted]"; }
    }
}
