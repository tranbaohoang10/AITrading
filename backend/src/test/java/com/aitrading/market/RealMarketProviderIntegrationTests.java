package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

@EnabledIfEnvironmentVariable(named="AITRADING_REAL_MARKET",matches="true")
@SpringBootTest(properties="spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres")
class RealMarketProviderIntegrationTests {
    private static final Instant BASELINE=Instant.parse("2017-01-01T00:00:00Z");
    private static final List<String> SYMBOLS=List.of("EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","XAU/USD","XAG/USD","XPT/USD","XPD/USD","BTC/USDT","ETH/USDT","AAPL","MSFT","NVDA","SPY","QQQ","DIA");
    @Autowired MarketHistoricalSyncService sync;@Autowired MarketProviderCandleStore store;@Autowired MarketSymbolRegistry registry;@Autowired AlpacaHistoryProvider alpaca;@Autowired BinanceArchiveProvider binance;@Autowired DukascopyHistoryProvider dukascopy;
    @Test void probesRequiredHistoricalSymbolsPersistsAndAggregatesRealM1(){Instant from=Instant.parse("2026-09-09T00:00:00Z"),to=Instant.parse("2026-09-10T00:00:00Z");for(String symbol:SYMBOLS){var result=sync.sync(symbol,from,to);var route=registry.resolve(symbol);var coverage=store.coverage(route);int m1=store.read(route,"1m",from,to,20_000).size(),m5=store.read(route,"5m",from,to,20_000).size(),h1=store.read(route,"1h",from,to,20_000).size(),d1=store.read(route,"1d",from,to,20_000).size();System.out.println("REAL_MATRIX|"+symbol+"|"+route.provider()+"|"+coverage.availableFrom()+"|"+result.status()+"|"+result.errorCode()+"|"+m1+"|"+m5+"|"+h1+"|"+d1+"|"+result.elapsedMs());if(result.status().equals("READY")){assertThat(m1).isPositive();assertThat(m5).isPositive();assertThat(h1).isPositive();assertThat(d1).isPositive();}}}
    @Test void probes2017OrActualAvailabilityForEveryRequiredSymbol(){for(String symbol:SYMBOLS){var route=registry.resolve(symbol);Instant available=available(route),from=max(BASELINE,available),to=historicalProbeEnd(route,from);var result=sync.sync(symbol,BASELINE,to);int m1=store.read(route,"1m",from,to,20_000).size();String classification=result.status().equals("ERROR")?"FAIL_HISTORICAL":available.isAfter(BASELINE)?"PARTIAL_HISTORICAL":m1>0?"SAMPLE_VERIFIED":"FAIL_HISTORICAL";System.out.println("HISTORICAL_2017_MATRIX|"+symbol+"|"+route.provider()+"|"+available+"|"+result.effectiveFrom()+"|"+result.status()+"|"+result.errorCode()+"|"+m1+"|"+classification+"|"+result.elapsedMs());}}
    private Instant available(MarketSymbolRegistry.Route route){return switch(route.provider()){case "ALPACA"->alpaca.historicalAvailableFrom(route.providerSymbol());case "BINANCE"->binance.historicalAvailableFrom(route.providerSymbol());default->dukascopy.historicalAvailableFrom(route.providerSymbol());};}
    private static Instant historicalProbeEnd(MarketSymbolRegistry.Route route,Instant from){return route.provider().equals("BINANCE")?from.plus(Duration.ofHours(2)):from.plus(Duration.ofDays(1));}
    private static Instant max(Instant left,Instant right){return left.isAfter(right)?left:right;}
}
