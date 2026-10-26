package com.securevault.auth;

import com.securevault.common.BcryptPasswordLength;
import com.securevault.common.ClientIpResolver;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataAccessException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {
        "http://localhost:3000", "http://127.0.0.1:3000",
        "http://localhost:3001", "http://127.0.0.1:3001"
})
@Validated
@RestController
@RequestMapping("/api")
public class AuthController {
    private final RegistrationService registrationService;
    private final LoginService loginService;
    private final JdbcTemplate jdbcTemplate;
    private final ClientIpResolver clientIpResolver;

    public AuthController(
            RegistrationService registrationService,
            LoginService loginService,
            JdbcTemplate jdbcTemplate) {
        this(registrationService, loginService, jdbcTemplate, ClientIpResolver.withoutTrustedProxies());
    }

    @Autowired
    public AuthController(
            RegistrationService registrationService,
            LoginService loginService,
            JdbcTemplate jdbcTemplate,
            ClientIpResolver clientIpResolver) {
        this.registrationService = registrationService;
        this.loginService = loginService;
        this.jdbcTemplate = jdbcTemplate;
        this.clientIpResolver = clientIpResolver;
    }

    // ==========================================
    // Registration Endpoints
    // ==========================================

    @PostMapping("/registration/register")
    public ResponseEntity<RegistrationAcknowledgement> register(
            @Valid @RequestBody RegistrationRequest request, HttpServletRequest httpRequest) {
        registrationService.register(request.username(), request.email(), request.password(),
                clientIpResolver.resolve(httpRequest));
        return acknowledgement();
    }

    /** Kept for direct controller callers; HTTP requests use the mapped method above. */
    public ResponseEntity<RegistrationAcknowledgement> register(RegistrationRequest request) {
        registrationService.register(request.username(), request.email(), request.password());
        return acknowledgement();
    }

    public static ResponseEntity<RegistrationAcknowledgement> acknowledgement() {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new RegistrationAcknowledgement(
                "REQUEST_RECEIVED", "If these details are available, your account has been created."));
    }

    // ==========================================
    // Login Endpoints
    // ==========================================

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        String ipAddress = clientIpResolver.resolve(httpRequest);
        String userAgent = httpRequest.getHeader("User-Agent");
        String clientDeviceId = httpRequest.getHeader("X-SecureVault-Device");
        LoginService.AuthenticationResult result = clientDeviceId == null || clientDeviceId.isBlank()
                ? loginService.authenticate(request.identifier(), request.password(), ipAddress, userAgent)
                : loginService.authenticate(request.identifier(), request.password(), ipAddress, userAgent,
                        clientDeviceId);
        if (result.challenge() != null) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(result.challenge());
        }
        if (!result.authenticated()) {
            return ResponseEntity.status(result.status()).body(
                    new ApiError(result.errorCode(), result.message(), Instant.now()));
        }
        return ResponseEntity.ok(result.response());
    }

    @PostMapping("/login/mfa")
    public ResponseEntity<?> verifyLoginMfa(@Valid @RequestBody LoginMfaRequest request,
                                            HttpServletRequest httpRequest) {
        LoginService.AuthenticationResult result = loginService.verifyMfaChallenge(
                request.challengeId(), request.code(), clientIpResolver.resolve(httpRequest),
                httpRequest.getHeader("User-Agent"), httpRequest.getHeader("X-SecureVault-Device"));
        if (!result.authenticated()) {
            return ResponseEntity.status(result.status()).body(
                    new ApiError(result.errorCode(), result.message(), Instant.now()));
        }
        return ResponseEntity.ok(result.response());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
        String authorization = httpRequest.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            loginService.revokeSession(
                    authorization.substring(7).trim(), clientIpResolver.resolve(httpRequest));
        }
        return ResponseEntity.noContent().build();
    }

    @GetMapping({"/health", "/login/health"})
    public ResponseEntity<HealthResponse> health() {
        try {
            jdbcTemplate.execute("SELECT 1 FROM users LIMIT 0");
            return ResponseEntity.ok(new HealthResponse("UP", "securevault-backend"));
        } catch (DataAccessException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(new HealthResponse("DOWN", "securevault-backend"));
        }
    }

    // ==========================================
    // Request & Response Records
    // ==========================================

    public record RegistrationRequest(
            @NotBlank
            @Size(min = 3, max = 50)
            @Pattern(regexp = "[A-Za-z0-9_.-]+", message = "must contain only letters, numbers, dots, underscores, or hyphens")
            String username,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 8, max = 72) @BcryptPasswordLength String password) {
        @Override
        public String toString() { return "RegistrationRequest[redacted]"; }
    }

    public record RegistrationAcknowledgement(String code, String message) {}

    public record RegistrationResponse(UUID id, String username, String email, Instant registeredAt) {}

    public record LoginRequest(
            @NotBlank @Size(max = 255) String identifier,
            @NotBlank @Size(max = 72) @BcryptPasswordLength String password) {
        @Override
        public String toString() { return "LoginRequest[redacted]"; }
    }

    public record LoginMfaRequest(@NotNull UUID challengeId,
            @NotBlank @Pattern(regexp = "[0-9]{6}") @Size(min = 6, max = 6) String code) {
        @Override public String toString() { return "LoginMfaRequest[redacted]"; }
    }

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, UserResponse user) {
        @Override
        public String toString() { return "LoginResponse[redacted]"; }
    }

    public record UserResponse(UUID id, String username, String email) {}

    public record ApiError(String code, String message, Instant timestamp) {}

    public record HealthResponse(String status, String service) {}
}
