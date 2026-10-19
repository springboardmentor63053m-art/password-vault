package com.securevault.auth;

import com.securevault.common.BcryptPasswordLength;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@CrossOrigin(origins = {"http://localhost:3000", "http://127.0.0.1:3000"}, allowedHeaders = {"Content-Type", "Authorization"}, methods = {org.springframework.web.bind.annotation.RequestMethod.GET, org.springframework.web.bind.annotation.RequestMethod.POST, org.springframework.web.bind.annotation.RequestMethod.OPTIONS})
@Validated
@RestController
@RequestMapping("/api")
public class AuthController {
    private final RegistrationService registrationService;
    private final LoginService loginService;

    public AuthController(RegistrationService registrationService, LoginService loginService) {
        this.registrationService = registrationService;
        this.loginService = loginService;
    }

    // ==========================================
    // Registration Endpoints
    // ==========================================

    @PostMapping("/registration/register")
    public ResponseEntity<RegistrationAcknowledgement> register(@Valid @RequestBody RegistrationRequest request) {
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
        LoginService.AuthenticationResult result = loginService.authenticate(
                request.identifier(), request.password(), httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        if (!result.authenticated()) {
            return ResponseEntity.status(result.status()).body(
                    new ApiError(result.errorCode(), result.message(), Instant.now()));
        }
        return ResponseEntity.ok(result.response());
    }

    @GetMapping({"/health", "/login/health"})
    public HealthResponse health() {
        return new HealthResponse("UP", "securevault-backend");
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

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, UserResponse user) {
        @Override
        public String toString() { return "LoginResponse[redacted]"; }
    }

   public record UserResponse(
        UUID id,
        String username,
        String email,
        String role) {}

    public record ApiError(String code, String message, Instant timestamp) {}

    public record HealthResponse(String status, String service) {}
}
