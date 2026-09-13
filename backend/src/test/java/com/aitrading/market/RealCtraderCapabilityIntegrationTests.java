package com.aitrading.market;

import static org.assertj.core.api.Assertions.assertThat;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@EnabledIfEnvironmentVariable(named = "AITRADING_REAL_CTRADER", matches = "true")
@SpringBootTest(properties = "spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class RealCtraderCapabilityIntegrationTests {
    private static final List<String> FOREX = List.of("EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "USD/CHF", "NZD/USD");

    @Autowired CtraderMarketDataClient client;

    @Test
    void authenticatesDiscoversRequiredForexAndReadsRecentHistory() {
        assertThat(client.configured()).isTrue();
        var catalog = client.catalog();
        assertThat(catalog).isNotEmpty();
        for (var symbol : FOREX) {
            var item = catalog.stream().filter(value -> (value.base() + value.quote()).equals(symbol.replace("/", ""))).findFirst();
            assertThat(item).as("cTrader catalog %s", symbol).isPresent();
            var rows = client.history(item.orElseThrow().id(), 1, Instant.now().minus(Duration.ofHours(6)), Instant.now());
            assertThat(rows).as("cTrader M1 history %s", symbol).isNotEmpty();
            System.out.println("CTRADER_REAL|" + symbol + "|CATALOG_PRESENT|M1_ROWS=" + rows.size());
        }
    }
}
