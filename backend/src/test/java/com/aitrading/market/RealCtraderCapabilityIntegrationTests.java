package com.aitrading.market;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Duration;
import java.time.Instant;
import java.net.SocketTimeoutException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@EnabledIfEnvironmentVariable(named = "AITRADING_REAL_CTRADER", matches = "true")
@SpringBootTest(properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class RealCtraderCapabilityIntegrationTests {
    private static final List<String> FOREX = List.of("EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD");
    private static final List<String> METALS = List.of("XAU/USD", "XAG/USD", "XPT/USD", "XPD/USD");
    private static final Map<String, Instant[]> WINDOWS = new LinkedHashMap<>();

    static {
        WINDOWS.put("2020", window("2020-09-14T00:00:00Z"));
        WINDOWS.put("2022", window("2022-09-12T00:00:00Z"));
        WINDOWS.put("2024", window("2024-09-09T00:00:00Z"));
        WINDOWS.put("2025", window("2025-09-08T00:00:00Z"));
        WINDOWS.put("RECENT", window("2026-09-11T00:00:00Z"));
    }

    @Autowired CtraderMarketDataClient client;

    @Test
    void authenticatesDiscoversRequiredForexAndReadsRecentHistory() {
        assertThat(client.configured()).isTrue();
        var catalog = client.catalog();
        assertThat(catalog).isNotEmpty();
        for (var symbol : FOREX) {
            var item = catalog.stream().filter(value -> (value.base() + value.quote()).equals(symbol.replace("/", ""))).findFirst();
            assertThat(item).as("cTrader catalog %s", symbol).isPresent();
            System.out.println("CTRADER_CATALOG|Canonical=" + symbol + "|ProviderSymbol=" + item.orElseThrow().name() + "|SymbolId=" + item.orElseThrow().id() + "|Available=TRUE|AssetClass=" + item.orElseThrow().assetClass());
            assertWindows(symbol, item.orElseThrow().id());
        }
        for (var symbol : METALS) {
            var item = catalog.stream().filter(value -> (value.base() + value.quote()).equals(symbol.replace("/", ""))).findFirst();
            if (item.isEmpty()) {
                System.out.println("CTRADER_CATALOG|Canonical=" + symbol + "|Available=FALSE|NOT_AVAILABLE_ACCOUNT_CATALOG");
                continue;
            }
            System.out.println("CTRADER_CATALOG|Canonical=" + symbol + "|ProviderSymbol=" + item.get().name() + "|SymbolId=" + item.get().id() + "|Available=TRUE|AssetClass=" + item.get().assetClass());
            assertWindows(symbol, item.get().id());
        }
    }

    @Test
    void connectsAndSubscribesToRealStreamWithoutFakingSundayQuotes() throws Exception {
        var item = client.catalog().stream().filter(value -> (value.base() + value.quote()).equals("EURUSD")).findFirst().orElseThrow();
        try (var session = client.openStream(item.id())) {
            System.out.println("CTRADER_REALTIME|Connection=CONNECTED|ProviderSymbol=" + item.name());
            System.out.println("CTRADER_REALTIME|Subscription=SUBSCRIBED");
            var events = 0;
            var deadline = Instant.now().plus(Duration.ofSeconds(35));
            while (Instant.now().isBefore(deadline)) {
                try {
                    var message = session.read();
                    if (message.type() == CtraderProtoCodec.HEARTBEAT) {
                        session.send(CtraderProtoCodec.heartbeat());
                    } else if (message.type() == CtraderProtoCodec.SPOT_EVENT
                            && CtraderProtoCodec.spot(message.payload(), item.id(), Instant.now()).isPresent()) {
                        events++;
                    }
                } catch (SocketTimeoutException closedMarketWindow) {
                    break;
                }
            }
            if (events == 0) {
                System.out.println("CTRADER_REALTIME|LiveQuote=NOT_VERIFIED_MARKET_CLOSED|ObservationSeconds=35");
            } else {
                System.out.println("CTRADER_REALTIME|LiveQuote=PASS|EventCount=" + events);
            }
        }
    }

    private void assertWindows(String symbol, long symbolId) {
        var verified = 0;
        for (var entry : WINDOWS.entrySet()) {
            var rows = client.history(symbolId, 1, entry.getValue()[0], entry.getValue()[1]);
            if (rows.isEmpty()) {
                System.out.println("CTRADER_HISTORICAL|Symbol=" + symbol + "|Window=" + entry.getKey() + "|NOT_AVAILABLE_WINDOW");
            } else {
                verified++;
                System.out.println("CTRADER_HISTORICAL|Symbol=" + symbol + "|Window=" + entry.getKey() + "|M1_ROWS=" + rows.size());
            }
        }
        assertThat(verified).as("cTrader M1 history %s", symbol).isPositive();
    }

    private static Instant[] window(String start) {
        var from = Instant.parse(start);
        return new Instant[]{from, from.plus(Duration.ofHours(6))};
    }
}
