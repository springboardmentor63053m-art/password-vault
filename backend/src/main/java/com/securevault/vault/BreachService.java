package com.securevault.vault;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import org.springframework.stereotype.Service;

/**
 * Validates password exposure against public breach corpuses using the
 * Have I Been Pwned (HIBP) k-Anonymity API.
 * The full password is never transmitted; only the 5-character SHA-1 prefix is queried.
 */
@Service
public class BreachService {
    private final HttpClient httpClient;

    public BreachService() {
        this(HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
    }

    public BreachService(HttpClient httpClient) {
        this.httpClient = httpClient;
    }

    public record BreachResult(boolean breached, long count, String message) {
        @Override
        public String toString() {
            return "BreachResult[breached=" + breached + ", count=" + count + "]";
        }
    }

    public BreachResult check(String password) {
        if (password == null || password.isEmpty()) {
            return new BreachResult(false, 0, "No password provided.");
        }
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            byte[] digest = sha1.digest(password.getBytes(StandardCharsets.UTF_8));
            String hex = HexFormat.of().formatHex(digest).toUpperCase(Locale.ROOT);
            String prefix = hex.substring(0, 5);
            String suffix = hex.substring(5);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.pwnedpasswords.com/range/" + prefix))
                    .header("User-Agent", "SecureVault-BreachChecker")
                    .header("Add-Padding", "true")
                    .timeout(Duration.ofSeconds(6))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return new BreachResult(false, 0, "Breach database service unavailable.");
            }

            for (String line : response.body().split("\r?\n")) {
                String[] parts = line.split(":", 2);
                if (parts.length == 2 && parts[0].trim().equalsIgnoreCase(suffix)) {
                    long count = Long.parseLong(parts[1].trim());
                    return new BreachResult(true, count, "Password found in " + count + " known public data breaches.");
                }
            }
            return new BreachResult(false, 0, "No known breaches found in public databases.");
        } catch (Exception ex) {
            return new BreachResult(false, 0, "Breach check could not be completed: " + ex.getMessage());
        }
    }
}

