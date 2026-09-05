package com.aitrading.market;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class FrankfurterMarketDataClientTests {
    private HttpServer server;
    private URI base;
    private final AtomicReference<URI> requested = new AtomicReference<>();

    @BeforeEach void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        base = URI.create("http://127.0.0.1:" + server.getAddress().getPort());
        server.start();
    }

    @AfterEach void stopServer() { server.stop(0); }

    @Test void mapsAReferenceFixToAnHonestDailyPointCandle() {
        respond(200, "[{\"date\":\"2026-09-04\",\"base\":\"EUR\",\"quote\":\"USD\",\"rate\":1.1622}]");
        var client = new FrankfurterMarketDataClient(base, HttpClient.newHttpClient());

        var candles = client.candles("EUR-USD", 20, Instant.parse("2026-09-05T00:00:00Z").toEpochMilli());
        assertThat(candles).singleElement().satisfies(candle -> {
            assertThat(candle.open()).isEqualTo("1.1622");
            assertThat(candle.high()).isEqualTo("1.1622");
            assertThat(candle.low()).isEqualTo("1.1622");
            assertThat(candle.close()).isEqualTo("1.1622");
            assertThat(candle.volume()).isEqualTo("0");
            assertThat(candle.closed()).isTrue();
        });
        assertThat(requested.get().getPath()).isEqualTo("/v2/rates");
        assertThat(requested.get().getQuery()).contains("base=EUR", "quotes=USD", "providers=ECB");
    }

    @Test void rejectsUnknownPairsAndMalformedProviderRowsBeforeTheyCanReachTheChart() {
        var client = new FrankfurterMarketDataClient(base, HttpClient.newHttpClient());
        assertThatIllegalArgumentException().isThrownBy(() -> client.candles("EUR-JPY", 1, null));
        assertThat(requested.get()).isNull();

        respond(200, "[{\"date\":\"2026-09-04\",\"base\":\"EUR\",\"quote\":\"JPY\",\"rate\":1.1622}]");
        assertThatThrownBy(() -> client.candles("EUR-USD", 1, null)).isInstanceOfSatisfying(FrankfurterDataFailure.class,
                failure -> assertThat(failure.code()).isEqualTo("FRANKFURTER_INVALID_RESPONSE"));
    }

    @Test void retainsTheProviderRateLimitSignal() {
        respond(429, "{\"error\":\"rate limit\"}");
        var client = new FrankfurterMarketDataClient(base, HttpClient.newHttpClient());
        assertThatThrownBy(() -> client.candles("EUR-USD", 1, null)).isInstanceOfSatisfying(FrankfurterDataFailure.class, failure -> {
            assertThat(failure.code()).isEqualTo("FRANKFURTER_RATE_LIMIT");
            assertThat(failure.status()).isEqualTo(429);
        });
    }

    private void respond(int status, String body) {
        server.createContext("/", exchange -> {
            requested.set(exchange.getRequestURI());
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
    }
}
