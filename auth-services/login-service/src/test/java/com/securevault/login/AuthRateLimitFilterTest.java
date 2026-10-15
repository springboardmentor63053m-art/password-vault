package com.securevault.login;

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
            assertTrue(filter.allow("192.0.2.1"));
        }
        var request = request("192.0.2.1");
        request.addHeader("X-Forwarded-For", "192.0.2.99");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Endpoint must not run"));
        assertEquals(429, response.getStatus());
        assertEquals("60", response.getHeader("Retry-After"));
        assertEquals("no-store", response.getHeader("Cache-Control"));
        assertTrue(filter.allow("192.0.2.2"));
    }

    @Test
    void oneClientsTrafficDoesNotExhaustAGlobalMinuteQuota() {
        var filter = new AuthRateLimitFilter();
        for (int i = 0; i < 301; i++) {
            assertTrue(filter.allow("client-" + i));
        }
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

    @Test
    void limitsConcurrentWorkAndRecoversAsSoonAsRequestsFinish() throws Exception {
        var filter = new AuthRateLimitFilter();
        enter(filter, 0);
        var response = new MockHttpServletResponse();
        filter.doFilter(request("another-client"), response, (req, res) -> response.setStatus(204));
        assertEquals(204, response.getStatus());
    }

    private void enter(AuthRateLimitFilter filter, int depth) throws IOException, ServletException {
        var response = new MockHttpServletResponse();
        filter.doFilter(request("client-" + depth), response, (req, res) -> {
            if (depth == 8) {
                fail("Ninth concurrent request must not reach the endpoint");
            }
            enter(filter, depth + 1);
        });
        if (depth == 8) {
            assertEquals(429, response.getStatus());
        }
    }

    @Test
    void exceptionsDoNotLeakConcurrencyPermits() throws Exception {
        var filter = new AuthRateLimitFilter();
        for (int i = 0; i < 12; i++) {
            var request = request("client-" + i);
            assertThrows(ServletException.class, () -> filter.doFilter(request,
                    new MockHttpServletResponse(), (req, res) -> { throw new ServletException("failure"); }));
        }
    }

    @Test
    void slowDripBodiesCannotHoldAnAuthenticationSlotIndefinitely() throws Exception {
        var clock = new java.util.concurrent.atomic.AtomicLong();
        var filter = new AuthRateLimitFilter(clock::get);
        var request = new MockHttpServletRequest("POST", "/api/login") {
            @Override
            public jakarta.servlet.ServletInputStream getInputStream() {
                return new jakarta.servlet.ServletInputStream() {
                    @Override
                    public int read() { clock.addAndGet(java.util.concurrent.TimeUnit.SECONDS.toNanos(11)); return 'x'; }
                    @Override
                    public int read(byte[] bytes, int offset, int length) {
                        bytes[offset] = (byte) read();
                        return 1;
                    }
                    @Override
                    public boolean isFinished() { return false; }
                    @Override
                    public boolean isReady() { return true; }
                    @Override
                    public void setReadListener(jakarta.servlet.ReadListener listener) { }
                };
            }
        };
        request.setRemoteAddr("192.0.2.1");
        var response = new MockHttpServletResponse();
        filter.doFilter(request, response, (req, res) -> fail("Slow body reached endpoint"));
        assertEquals(408, response.getStatus());
    }

    private static MockHttpServletRequest request(String address) {
        var request = new MockHttpServletRequest("POST", "/api/login");
        request.setServletPath("/api/login");
        request.setRemoteAddr(address);
        return request;
    }
}