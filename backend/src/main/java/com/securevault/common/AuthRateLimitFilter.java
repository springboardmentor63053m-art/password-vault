package com.securevault.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Unified Rate Limiting Filter for Auth Endpoints.
 * Enforces per-client IP limits:
 * - /api/login: 30 requests / minute
 * - /api/registration: 15 requests / minute
 * Enforces body size limit (8 KiB) and slow-loris read timeouts.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_NANOS = TimeUnit.MINUTES.toNanos(1);
    private static final int MAX_CLIENTS = 10_000;
    private static final int MAX_BODY_BYTES = 8192;
    private final Map<String, Integer> loginAttempts = new HashMap<>();
    private final Map<String, Integer> registerAttempts = new HashMap<>();
    private final Semaphore inFlight = new Semaphore(16);
    private final LongSupplier nanoTime;
    private final ClientIpResolver clientIpResolver;
    private long windowStart;

    public AuthRateLimitFilter() {
        this(System::nanoTime, ClientIpResolver.withoutTrustedProxies());
    }

    public AuthRateLimitFilter(LongSupplier nanoTime) {
        this(nanoTime, ClientIpResolver.withoutTrustedProxies());
    }

    @Autowired
    public AuthRateLimitFilter(ClientIpResolver clientIpResolver) {
        this(System::nanoTime, clientIpResolver);
    }

    public AuthRateLimitFilter(LongSupplier nanoTime, ClientIpResolver clientIpResolver) {
        this.nanoTime = nanoTime;
        this.clientIpResolver = clientIpResolver;
        this.windowStart = nanoTime.getAsLong();
    }

    public synchronized boolean allow(String remoteAddress, String uri) {
        long now = nanoTime.getAsLong();
        if (now - windowStart >= WINDOW_NANOS) {
            loginAttempts.clear();
            registerAttempts.clear();
            windowStart = now;
        }

        boolean isRegister = uri.contains("/registration");
        Map<String, Integer> map = isRegister ? registerAttempts : loginAttempts;
        int maxAllowed = isRegister ? 15 : 30;

        int count = map.getOrDefault(remoteAddress, 0);
        if (count >= maxAllowed || (count == 0 && map.size() >= MAX_CLIENTS)) {
            return false;
        }
        map.put(remoteAddress, count + 1);
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");

        String uri = request.getRequestURI();
        boolean authRequest = "/api/login".equals(uri) || "/api/login/mfa".equals(uri)
                || "/api/registration/register".equals(uri);
        if (!"POST".equals(request.getMethod()) || !authRequest) {
            chain.doFilter(request, response);
            return;
        }

        if (!allow(clientIpResolver.resolve(request), uri) || !inFlight.tryAcquire()) {
            response.setHeader("Retry-After", "60");
            error(response, 429, "RATE_LIMITED", "Too many requests. Try again later.");
            return;
        }

        try {
            if (request.getContentLengthLong() > MAX_BODY_BYTES) {
                error(response, 413, "REQUEST_TOO_LARGE", "Request body exceeds 8192 bytes.");
                return;
            }

            byte[] buffer = new byte[MAX_BODY_BYTES + 1];
            int length = 0;
            long started = nanoTime.getAsLong();
            ServletInputStream input = request.getInputStream();
            while (length < buffer.length) {
                int read = input.read(buffer, length, buffer.length - length);
                if (nanoTime.getAsLong() - started >= TimeUnit.SECONDS.toNanos(10)) {
                    error(response, 408, "REQUEST_TIMEOUT", "Request body took too long to read.");
                    return;
                }
                if (read < 0) {
                    break;
                }
                length += read;
            }

            byte[] body = Arrays.copyOf(buffer, length);
            if (body.length > MAX_BODY_BYTES) {
                error(response, 413, "REQUEST_TOO_LARGE", "Request body exceeds 8192 bytes.");
                return;
            }

            chain.doFilter(new BoundedBodyRequest(request, body), response);
        } finally {
            inFlight.release();
        }
    }

    private void error(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write(
                "{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }

    private static final class BoundedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        private BoundedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream stream = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() { return stream.available() == 0; }
                @Override
                public boolean isReady() { return true; }
                @Override
                public void setReadListener(ReadListener listener) {}
                @Override
                public int read() { return stream.read(); }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
