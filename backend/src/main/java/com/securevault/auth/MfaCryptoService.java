package com.securevault.auth;

import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** TOTP and encrypted-at-rest storage for authenticator seeds. */
@Component
public class MfaCryptoService {
    private static final char[] BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".toCharArray();
    private static final int PERIOD_SECONDS = 30;
    private static final int DIGITS = 6;
    private static final String TOTP_PREFIX = "enc:v1:";

    private final SecureRandom secureRandom = new SecureRandom();
    private final SecretKeySpec encryptionKey;

    public MfaCryptoService(@Value("${security.mfa.encryption-key-base64}") String secretBase64) {
        try {
            byte[] rootKey = Base64.getDecoder().decode(secretBase64.trim());
            if (rootKey.length < 32) {
                throw new IllegalArgumentException("MFA_ENCRYPTION_KEY_BASE64 must decode to at least 32 bytes.");
            }
            Mac derivation = Mac.getInstance("HmacSHA256");
            derivation.init(new SecretKeySpec(rootKey, "HmacSHA256"));
            byte[] key = derivation.doFinal("SecureVault/TOTP encryption/v1".getBytes(StandardCharsets.UTF_8));
            encryptionKey = new SecretKeySpec(key, "AES");
        } catch (Exception exception) {
            throw new IllegalArgumentException("The MFA encryption key could not be initialized.", exception);
        }
    }

    public String newSecret() {
        byte[] secret = new byte[20];
        secureRandom.nextBytes(secret);
        return base32Encode(secret);
    }

    public String encryptSecret(String secret) {
        try {
            byte[] iv = new byte[12];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(secret.getBytes(StandardCharsets.UTF_8));
            Base64.Encoder encoder = Base64.getUrlEncoder().withoutPadding();
            return TOTP_PREFIX + encoder.encodeToString(iv) + ":" + encoder.encodeToString(encrypted);
        } catch (Exception exception) {
            throw new IllegalStateException("The authenticator secret could not be protected.", exception);
        }
    }

    public String decryptSecret(String storedSecret) {
        if (storedSecret == null || !storedSecret.startsWith(TOTP_PREFIX)) {
            // Older installations may contain a legacy plaintext seed. Callers re-encrypt it on use.
            return storedSecret;
        }
        try {
            String[] parts = storedSecret.substring(TOTP_PREFIX.length()).split(":", 2);
            if (parts.length != 2) throw new IllegalArgumentException("Malformed encrypted MFA seed.");
            Base64.Decoder decoder = Base64.getUrlDecoder();
            byte[] iv = decoder.decode(parts[0]);
            byte[] encrypted = decoder.decode(parts[1]);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (Exception exception) {
            throw new IllegalStateException("The stored authenticator secret could not be decrypted.", exception);
        }
    }

    public boolean isEncrypted(String storedSecret) {
        return storedSecret != null && storedSecret.startsWith(TOTP_PREFIX);
    }

    public String otpauthUri(String account, String secret) {
        String label = "SecureVault:" + (account == null ? "account" : account);
        return "otpauth://totp/" + urlEncode(label)
                + "?secret=" + secret + "&issuer=SecureVault&algorithm=SHA1&digits=" + DIGITS
                + "&period=" + PERIOD_SECONDS;
    }

    /** Returns the matching 30-second counter, or -1 when the code is invalid or replayed. */
    public long matchingTotpStep(String secret, String code, Instant now, long lastAcceptedStep) {
        if (secret == null || code == null || !code.matches("\\d{" + DIGITS + "}")) return -1;
        long currentStep = now.getEpochSecond() / PERIOD_SECONDS;
        for (long candidate = currentStep - 1; candidate <= currentStep + 1; candidate++) {
            if (candidate <= lastAcceptedStep) continue;
            byte[] expected = totp(secret, candidate).getBytes(StandardCharsets.US_ASCII);
            byte[] supplied = code.getBytes(StandardCharsets.US_ASCII);
            if (MessageDigest.isEqual(expected, supplied)) return candidate;
        }
        return -1;
    }

    static String codeForStep(String secret, long step) {
        try {
            byte[] counter = ByteBuffer.allocate(Long.BYTES).putLong(step).array();
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(base32Decode(secret), "HmacSHA1"));
            byte[] hash = mac.doFinal(counter);
            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24)
                    | ((hash[offset + 1] & 0xff) << 16)
                    | ((hash[offset + 2] & 0xff) << 8)
                    | (hash[offset + 3] & 0xff);
            int otp = binary % 1_000_000;
            return String.format(java.util.Locale.ROOT, "%06d", otp);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Invalid authenticator seed.", exception);
        }
    }

    private String totp(String secret, long step) {
        return codeForStep(secret, step);
    }

    private static String base32Encode(byte[] bytes) {
        StringBuilder output = new StringBuilder((bytes.length * 8 + 4) / 5);
        int buffer = 0;
        int bitsLeft = 0;
        for (byte value : bytes) {
            buffer = (buffer << 8) | (value & 0xff);
            bitsLeft += 8;
            while (bitsLeft >= 5) {
                output.append(BASE32[(buffer >> (bitsLeft - 5)) & 0x1f]);
                bitsLeft -= 5;
            }
        }
        if (bitsLeft > 0) output.append(BASE32[(buffer << (5 - bitsLeft)) & 0x1f]);
        return output.toString();
    }

    private static byte[] base32Decode(String value) {
        String normalized = value.replace("=", "").replace(" ", "").toUpperCase(java.util.Locale.ROOT);
        byte[] output = new byte[normalized.length() * 5 / 8];
        int buffer = 0;
        int bitsLeft = 0;
        int index = 0;
        for (char symbol : normalized.toCharArray()) {
            int digit = symbol >= 'A' && symbol <= 'Z' ? symbol - 'A'
                    : symbol >= '2' && symbol <= '7' ? symbol - '2' + 26 : -1;
            if (digit < 0) throw new IllegalArgumentException("Invalid base32 authenticator seed.");
            buffer = (buffer << 5) | digit;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                output[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xff);
                bitsLeft -= 8;
            }
        }
        return output;
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }
}
