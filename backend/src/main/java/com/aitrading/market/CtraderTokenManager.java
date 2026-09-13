package com.aitrading.market;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

final class CtraderTokenManager {
    static final Duration REFRESH_SKEW = Duration.ofHours(24);
    static final Duration DEFAULT_ACCESS_TOKEN_LIFETIME = Duration.ofDays(30);
    private final String clientId;
    private final String clientSecret;
    private final URI refreshEndpoint;
    private final HttpClient httpClient;
    private final JsonMapper objectMapper;
    private final Clock clock;
    private volatile TokenState state;

    CtraderTokenManager(String clientId, String clientSecret, String accessToken, String refreshToken,
                        String expiresAt, URI refreshEndpoint, HttpClient httpClient,
                        JsonMapper objectMapper, Clock clock) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.refreshEndpoint = refreshEndpoint;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.clock = clock;
        this.state = new TokenState(accessToken, refreshToken, parseExpiry(expiresAt));
    }

    synchronized TokenState beforeRequest() {
        var current = state;
        if (current.refreshToken().isEmpty()
                || current.expiresAt() != null && clock.instant().plus(REFRESH_SKEW).isBefore(current.expiresAt())) {
            return current;
        }
        return refreshLocked();
    }

    synchronized TokenState afterAuthExpired(String failedAccessToken) {
        if (!state.accessToken().equals(failedAccessToken)) {
            return state;
        }
        return refreshLocked();
    }

    TokenState current() {
        return state;
    }

    private TokenState refreshLocked() {
        var current = state;
        if (current.refreshToken().isEmpty()) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_UNCONFIGURED", 503);
        }
        var query = "grant_type=refresh_token"
                + "&refresh_token=" + encode(current.refreshToken())
                + "&client_id=" + encode(clientId)
                + "&client_secret=" + encode(clientSecret);
        var request = HttpRequest.newBuilder(URI.create(refreshEndpoint + "?" + query))
                .timeout(Duration.ofSeconds(8))
                .POST(HttpRequest.BodyPublishers.noBody())
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .build();
        final HttpResponse<String> response;
        try {
            response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        } catch (IOException failure) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300 || response.body().length() > 64 * 1024) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        }
        final JsonNode json;
        try {
            json = objectMapper.readTree(response.body());
        } catch (RuntimeException malformed) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        }
        if (json == null || !json.isObject()) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        }
        var accessToken = clean(json.path("accessToken").asText(""), 2048);
        var refreshToken = clean(json.path("refreshToken").asText(""), 2048);
        var expiresIn = json.path("expiresIn").asLong(0);
        if (accessToken.isEmpty() || refreshToken.isEmpty() || expiresIn <= 0) {
            throw new CtraderDataFailure("CTRADER_TOKEN_REFRESH_FAILED", 502);
        }
        var refreshed = new TokenState(accessToken, refreshToken, clock.instant().plusSeconds(expiresIn));
        state = refreshed;
        return refreshed;
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private Instant parseExpiry(String value) {
        if (value == null || value.isBlank()) {
            return clock.instant().plus(DEFAULT_ACCESS_TOKEN_LIFETIME);
        }
        try {
            return Instant.parse(value.strip());
        } catch (RuntimeException invalid) {
            return clock.instant().plus(DEFAULT_ACCESS_TOKEN_LIFETIME);
        }
    }

    private static String clean(String value, int max) {
        value = value == null ? "" : value.strip();
        return value.length() <= max ? value : "";
    }

    record TokenState(String accessToken, String refreshToken, Instant expiresAt) {
    }
}
