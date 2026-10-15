package com.securevault.registration;

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
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Per-process limits. Use an additional shared gateway limiter when running replicas. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AuthRateLimitFilter extends OncePerRequestFilter {
    private static final long WINDOW_NANOS = TimeUnit.MINUTES.toNanos(1);
    private static final int MAX_CLIENTS = 10_000;
    private static final int MAX_BODY_BYTES = 8192;
    private final Map<String, Integer> attempts = new HashMap<>();
    private final Semaphore inFlight = new Semaphore(8);
    private final LongSupplier nanoTime;
    private long windowStart;

    public AuthRateLimitFilter() {
        this(System::nanoTime);
    }

    AuthRateLimitFilter(LongSupplier nanoTime) {
        this.nanoTime = nanoTime;
        this.windowStart = nanoTime.getAsLong();
    }

    synchronized boolean allow(String remoteAddress) {
        long now = nanoTime.getAsLong();
        if (now - windowStart >= WINDOW_NANOS) {
            attempts.clear();
            windowStart = now;
        }
        int count = attempts.getOrDefault(remoteAddress, 0);
        if (count >= 10 || (count == 0 && attempts.size() >= MAX_CLIENTS)) {
            return false;
        }
        attempts.put(remoteAddress, count + 1);
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                   FilterChain chain) throws ServletException, IOException {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader("X-Frame-Options", "DENY");
        if (!"POST".equals(request.getMethod())) {
            chain.doFilter(request, response);
            return;
        }
        // Do not trust client-supplied X-Forwarded-For headers.
        if (!allow(request.getRemoteAddr()) || !inFlight.tryAcquire()) {
            response.setHeader("Retry-After", "60");
            error(response, 429, "RATE_LIMITED", "Too many requests. Try again later.");
            return;
        }
        try {
            if (request.getContentLengthLong() > MAX_BODY_BYTES) {
                error(response, 413, "REQUEST_TOO_LARGE", "Request body exceeds 8192 bytes.");
                return;
            }
            // Reading a bounded amount also limits chunked bodies and ignored JSON fields.
            byte[] buffer = new byte[MAX_BODY_BYTES + 1];
            int length = 0;
            long started = nanoTime.getAsLong();
            ServletInputStream input = request.getInputStream();
            while (length < buffer.length) {
                int read = input.read(buffer, length, buffer.length - length);
                // Also bound slow-drip traffic; the connector bounds each blocking read.
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
            chain.doFilter(new BufferedRequest(request, body), response);
        } finally {
            inFlight.release();
        }
    }

    private static void error(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\"}");
    }

    /** The auth endpoints use blocking JSON reads; asynchronous servlet reads are unsupported. */
    private static final class BufferedRequest extends HttpServletRequestWrapper {
        private final byte[] body;
        private final ByteArrayInputStream input;

        BufferedRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body;
            this.input = new ByteArrayInputStream(body);
        }

        @Override
        public int getContentLength() { return body.length; }

        @Override
        public long getContentLengthLong() { return body.length; }

        @Override
        public ServletInputStream getInputStream() {
            return new ServletInputStream() {
                @Override
                public int read() { return input.read(); }
                @Override
                public int read(byte[] bytes, int offset, int length) { return input.read(bytes, offset, length); }
                @Override
                public boolean isFinished() { return input.available() == 0; }
                @Override
                public boolean isReady() { return true; }
                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("Only blocking reads are supported.");
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}