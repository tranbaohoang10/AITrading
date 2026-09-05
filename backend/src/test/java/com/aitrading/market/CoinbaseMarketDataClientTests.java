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

class CoinbaseMarketDataClientTests {
    private HttpServer server;
    private URI base;
    private final AtomicReference<URI> requested = new AtomicReference<>();

    @BeforeEach void startServer() throws Exception {
        server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        base=URI.create("http://127.0.0.1:"+server.getAddress().getPort());
        server.start();
    }

    @AfterEach void stopServer() { server.stop(0); }

    @Test void requestsOnlyTheValidatedCoinbaseSeriesContract() {
        respond(200,"[[1788594900,109,112,110,111,4]]");
        var client=new CoinbaseMarketDataClient(base,HttpClient.newHttpClient());

        long from=Instant.parse("2026-09-05T01:14:00Z").toEpochMilli();
        long to=Instant.parse("2026-09-05T01:15:00Z").toEpochMilli();
        assertThat(client.series("BTC-USD",60,from,to)).startsWith("[[");
        assertThat(requested.get().getPath()).isEqualTo("/products/BTC-USD/candles");
        assertThat(requested.get().getQuery()).contains("granularity=60","start=2026-09-05T01:14:00Z","end=2026-09-05T01:15:00Z");
    }

    @Test void rejectsInvalidSymbolGranularityAndOversizedRangeBeforeNetworkAccess() {
        var client=new CoinbaseMarketDataClient(base,HttpClient.newHttpClient());

        assertThatIllegalArgumentException().isThrownBy(() -> client.series("BTC-EUR",60,null,null));
        assertThatIllegalArgumentException().isThrownBy(() -> client.series("BTC-USD",120,null,null));
        assertThatIllegalArgumentException().isThrownBy(() -> client.series("BTC-USD",60,0L,18_000_001L));
        assertThat(requested.get()).isNull();
    }

    @Test void rejectsNonArrayAndRateLimitedProviderResponses() {
        respond(200,"{\"candles\":[]}");
        var client=new CoinbaseMarketDataClient(base,HttpClient.newHttpClient());
        assertThatThrownBy(client::products).isInstanceOfSatisfying(CoinbaseDataFailure.class,
                failure -> assertThat(failure.code()).isEqualTo("COINBASE_INVALID_RESPONSE"));

        server.removeContext("/");
        respond(429,"{\"message\":\"rate limit\"}");
        assertThatThrownBy(client::products).isInstanceOfSatisfying(CoinbaseDataFailure.class, failure -> {
            assertThat(failure.code()).isEqualTo("COINBASE_RATE_LIMIT");
            assertThat(failure.status()).isEqualTo(429);
        });
    }

    private void respond(int status,String body) {
        server.createContext("/",exchange -> {
            requested.set(exchange.getRequestURI());
            byte[] bytes=body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type","application/json");
            exchange.sendResponseHeaders(status,bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
    }
}
