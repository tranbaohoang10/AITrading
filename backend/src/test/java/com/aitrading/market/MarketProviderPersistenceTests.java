package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

@SpringBootTest(properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class MarketProviderPersistenceTests {
    @Autowired MarketSymbolRegistry registry;@Autowired MarketProviderCandleStore store;@Autowired JdbcTemplate jdbc;
    @BeforeEach void clean(){jdbc.update("DELETE FROM trading.provider_market_candle");jdbc.update("DELETE FROM trading.provider_market_sync_state");}
    @Test void upsertsM1ReadsAggregatesAndRecordsCoverage(){var route=registry.resolve("BTC/USDT");var rows=List.of(c("2026-09-10T10:00:00Z","10"),c("2026-09-10T10:01:00Z","11"),c("2026-09-10T10:02:00Z","12"));assertThat(store.upsert(route,rows)).isEqualTo(3);assertThat(store.upsert(route,rows)).isEqualTo(3);assertThat(jdbc.queryForObject("SELECT count(*) FROM trading.provider_market_candle WHERE instrument_id=?",Long.class,route.instrumentId())).isEqualTo(3);var aggregated=store.read(route,"5m",Instant.parse("2026-09-10T10:00:00Z"),Instant.parse("2026-09-10T10:05:00Z"),10);assertThat(aggregated).hasSize(1);assertThat(aggregated.getFirst().open()).isEqualByComparingTo("10");assertThat(aggregated.getFirst().close()).isEqualByComparingTo("12");store.state(route,route.declaredAvailableFrom(),rows.getLast().time(),"READY",null);assertThat(store.coverage(route)).satisfies(coverage->{assertThat(coverage.candleCount()).isEqualTo(3);assertThat(coverage.status()).isEqualTo("READY");});}
    @Test void providerDatasetHashUsesTheCanonicalBacktestIdentity(){var rows=List.of(c("2026-09-10T10:00:00Z","10.0"));assertThat(ProviderDatasetMaterializer.dataHash("BTC-USDT","1m",rows)).isEqualTo(MarketCsvParser.hash("ohlcv-v1\nBTC-USDT\n1m\nUTC\n2026-09-10T10:00:00Z,10,10,10,10,1\n"));}
    private static MarketDataProvider.Candle c(String at,String price){var value=new BigDecimal(price);return new MarketDataProvider.Candle(Instant.parse(at),value,value,value,value,BigDecimal.ONE);}
}
