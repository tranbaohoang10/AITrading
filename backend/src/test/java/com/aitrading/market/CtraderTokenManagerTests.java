package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class CtraderTokenManagerTests {
    private HttpServer server;
    private AtomicInteger refreshCalls;
    private volatile String requestBody;
    private volatile String responseBody;

    @BeforeEach
    void startServer() throws IOException {
        refreshCalls = new AtomicInteger();
        responseBody = "{\"accessToken\":\"new-access\",\"refreshToken\":\"new-refresh\",\"expiresIn\":2592000}";
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/token", this::refresh);
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    @Test
    void estimatesUnknownExpiryAndRotatesBothTokensAfterAuthExpiry() {
        var manager = manager("old-access", "old-refresh", "");

        var current = manager.beforeRequest();

        assertEquals("old-access", current.accessToken());
        assertEquals("old-refresh", current.refreshToken());
        assertEquals(0, refreshCalls.get());

        var refreshed = manager.afterAuthExpired("old-access");

        assertEquals("new-access", refreshed.accessToken());
        assertEquals("new-refresh", refreshed.refreshToken());
        assertNotNull(refreshed.expiresAt());
        assertEquals(1, refreshCalls.get());
        assertEquals("", requestBody);
        assertEquals("new-access", manager.afterAuthExpired("old-access").accessToken());
        assertEquals(1, refreshCalls.get());
    }

    @Test
    void refreshesBeforeConfiguredExpiryAndDoesNotReuseRotatedRefreshToken() {
        var manager = manager("old-access", "old-refresh", "2026-09-13T00:00:00Z");

        var refreshed = manager.beforeRequest();

        assertEquals("new-refresh", refreshed.refreshToken());
        assertEquals(1, refreshCalls.get());
        assertEquals("new-access", manager.afterAuthExpired("old-access").accessToken());
        assertEquals(1, refreshCalls.get());
    }

    @Test
    void authExpiredForCurrentTokenRefreshesOnceAndStaleFailureCannotReplaceNewState() {
        var manager = manager("old-access", "old-refresh", "2026-01-01T00:00:00Z");

        var refreshed = manager.afterAuthExpired("old-access");
        var unchanged = manager.afterAuthExpired("old-access");

        assertEquals("new-access", refreshed.accessToken());
        assertEquals("new-refresh", refreshed.refreshToken());
        assertSame(refreshed, unchanged);
        assertEquals(1, refreshCalls.get());
    }

    @Test
    void invalidRefreshResponseLeavesThePreviousTokenPairUntouched() {
        var manager = manager("old-access", "old-refresh", "2026-01-01T00:00:00Z");
        responseBody = "{\"accessToken\":\"new-access\"}";

        assertThrows(CtraderDataFailure.class, manager::beforeRequest);
        assertEquals("old-access", manager.current().accessToken());
        assertEquals("old-refresh", manager.current().refreshToken());
    }

    private CtraderTokenManager manager(String accessToken, String refreshToken, String expiresAt) {
        return new CtraderTokenManager("client", "secret", accessToken, refreshToken, expiresAt,
                URI.create("http://127.0.0.1:" + server.getAddress().getPort() + "/token"),
                HttpClient.newHttpClient(), JsonMapper.builder().build(),
                Clock.fixed(Instant.parse("2026-09-13T12:00:00Z"), java.time.ZoneOffset.UTC));
    }

    private void refresh(HttpExchange exchange) throws IOException {
        refreshCalls.incrementAndGet();
        requestBody = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        var response = responseBody;
        exchange.sendResponseHeaders(200, response.length());
        try (var output = exchange.getResponseBody()) {
            output.write(response.getBytes(StandardCharsets.UTF_8));
        }
    }
}
