package com.securevault.registration;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/registration")
public class RegistrationController {
    private final RegistrationService registrationService;

    public RegistrationController(RegistrationService registrationService) {
        this.registrationService = registrationService;
    }

    @PostMapping("/register")
    public ResponseEntity<RegistrationAcknowledgement> register(@Valid @RequestBody RegistrationRequest request) {
        registrationService.register(request.username(), request.email(), request.password());
        return acknowledgement();
    }

    static ResponseEntity<RegistrationAcknowledgement> acknowledgement() {
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new RegistrationAcknowledgement(
                "REQUEST_RECEIVED", "If these details are available, your account has been created."));
    }

    public record RegistrationAcknowledgement(String code, String message) {}

    public record RegistrationRequest(
            @NotBlank
            @Size(min = 3, max = 50)
            @Pattern(regexp = "[A-Za-z0-9_.-]+", message = "must contain only letters, numbers, dots, underscores, or hyphens")
            String username,
            @NotBlank @Email @Size(max = 255) String email,
            @NotBlank @Size(min = 12, max = 72) @BcryptPasswordLength String password) {
        @Override
        public String toString() { return "RegistrationRequest[redacted]"; }
    }

    public record RegistrationResponse(UUID id, String username, String email, Instant registeredAt) {}

    public record ApiError(String code, String message, Instant timestamp) {}
}
