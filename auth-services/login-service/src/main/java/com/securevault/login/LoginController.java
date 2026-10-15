package com.securevault.login;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/login")
public class LoginController {
    private final LoginService loginService;

    public LoginController(LoginService loginService) {
        this.loginService = loginService;
    }

    @PostMapping
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request, HttpServletRequest httpRequest) {
        LoginService.AuthenticationResult result = loginService.authenticate(
                request.identifier(), request.password(), httpRequest.getRemoteAddr(), httpRequest.getHeader("User-Agent"));
        if (!result.authenticated()) {
            return ResponseEntity.status(result.status()).body(
                    new ApiError(result.errorCode(), result.message(), Instant.now()));
        }
        return ResponseEntity.ok(result.response());
    }

    @GetMapping("/health")
    public HealthResponse health() {
        return new HealthResponse("UP", "login-service");
    }

    public record LoginRequest(@NotBlank @Size(max = 255) String identifier,
                               @NotBlank @Size(max = 72) @BcryptPasswordLength String password) {
        @Override
        public String toString() { return "LoginRequest[redacted]"; }
    }

    public record ApiError(String code, String message, Instant timestamp) {}

    public record HealthResponse(String status, String service) {}

    public record LoginResponse(String accessToken, String tokenType, Instant expiresAt, UserResponse user) {
        @Override
        public String toString() { return "LoginResponse[redacted]"; }
    }

    public record UserResponse(UUID id, String username, String email) {}
}
