package com.securevault;

import com.securevault.common.AuthRateLimitFilter;
import jakarta.servlet.ServletException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import static org.junit.jupiter.api.Assertions.*;

class AuthRateLimitFilterTest {
    @Test
    void rejectsExcessRequestsBeforeInvokingTheEndpoint() throws Exception {
        var filter = new AuthRateLimitFilter();
        for (int i = 0; i < 30; i++) {
            assertTrue(filter.allow("192.0.2.1", "/api/login"));
        }
        var request = request("192.0.2.1");
        request.addHeader("X-Forwarded-For", "192.0.2.99");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Endpoint must not run"));
        assertEquals(429, response.getStatus());
        assertEquals("60", response.getHeader("Retry-After"));
        assertEquals("no-store", response.getHeader("Cache-Control"));
        assertTrue(filter.allow("192.0.2.2", "/api/login"));
    }

    @Test
    void oneClientsTrafficDoesNotExhaustAGlobalMinuteQuota() {
        var filter = new AuthRateLimitFilter();
        for (int i = 0; i < 301; i++) {
            assertTrue(filter.allow("client-" + i, "/api/login"));
        }
    }

    @Test
    void registrationHasTighterRateLimit() {
        var filter = new AuthRateLimitFilter();
        for (int i = 0; i < 15; i++) {
            assertTrue(filter.allow("192.0.2.1", "/api/registration/register"));
        }
        assertFalse(filter.allow("192.0.2.1", "/api/registration/register"));
    }

    @Test
    void rejectsOversizedBodiesEvenWithoutContentLength() throws Exception {
        var filter = new AuthRateLimitFilter();
        var request = new MockHttpServletRequest("POST", "/api/login") {
            @Override
            public long getContentLengthLong() { return -1; }
        };
        request.setRemoteAddr("192.0.2.1");
        request.setContent(new byte[8193]);
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Oversized body reached controller"));
        assertEquals(413, response.getStatus());
    }

    @Test
    void allowsBoundarySizeAndPreservesBodyForJsonParsing() throws Exception {
        var filter = new AuthRateLimitFilter();
        var request = request("192.0.2.1");
        byte[] body = "x".repeat(8192).getBytes(StandardCharsets.UTF_8);
        request.setContent(body);
        var actual = new AtomicReference<byte[]>();
        filter.doFilter(request, new MockHttpServletResponse(),
                (req, res) -> actual.set(req.getInputStream().readAllBytes()));
        assertArrayEquals(body, actual.get());
    }

    private MockHttpServletRequest request(String ip) {
        var req = new MockHttpServletRequest("POST", "/api/login");
        req.setRemoteAddr(ip);
        req.setContent(new byte[0]);
        return req;
    }
}
