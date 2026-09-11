package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.json.JsonMapper;

@EnabledIfEnvironmentVariable(named="AITRADING_REAL_CAPITAL",matches="true")
@SpringBootTest(properties={"spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres","aitrading.market.redis.enabled=true","spring.data.redis.port=${AITRADING_REDIS_DISPOSABLE}","aitrading.market.catalog.scheduler=false"})
class RealCapitalMarketDataIntegrationTests {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private static final List<String> SYMBOLS=List.of("EUR/USD","GBP/USD","USD/JPY","AUD/USD","USD/CAD","USD/CHF","NZD/USD","XAU/USD","XAG/USD","XPT/USD","XPD/USD");
    @Autowired MarketHistoricalSyncService sync;@Autowired MarketProviderCandleStore candles;@Autowired MarketSymbolRegistry registry;@Autowired CapitalStreamProvider stream;@Autowired MarketLiveStateStore live;

    @Test void persistsRealCapitalM1ForAllSymbolsAndAggregatesLocally(){Instant from=Instant.parse("2024-01-03T12:00:00Z"),to=Instant.parse("2024-01-03T13:01:00Z");for(String symbol:SYMBOLS){var route=registry.resolve(symbol);assertThat(route.provider()).isEqualTo("CAPITAL");var result=sync.sync(symbol,from,to);assertThat(result.status()).isEqualTo("READY");long count=candles.read(route,"1m",from,to,100).size();assertThat(count).isBetween(57L,61L);for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES)assertThat(candles.read(route,timeframe,from,to,100)).isNotEmpty();long before=candles.coverage(route).candleCount();assertThat(sync.sync(symbol,from,to).status()).isEqualTo("READY");assertThat(candles.coverage(route).candleCount()).isEqualTo(before);System.out.println("CAPITAL_HISTORICAL_MATRIX|"+symbol+"|"+route.providerSymbol()+"|"+count+"|MID|POSTGRES_IDEMPOTENT|AGGREGATED_7TF");}}

    @Test void loadsMultipleClosedRealGoldCandlesForAllSevenHistoricalTimeframes(){Instant from=Instant.parse("2024-01-03T00:00:00Z"),to=Instant.parse("2024-01-08T00:00:00Z");var route=registry.resolve("XAU/USD");for(int attempt=0;attempt<3&&candles.read(route,"1m",from,to,20_000).size()<1000;attempt++){var result=sync.sync("XAU/USD",from,to);System.out.println("CAPITAL_COMMODITY_SYNC|XAU/USD|"+result.status()+"|"+result.errorCode()+"|"+result.fetched()+"|"+result.stored());assertThat(result.status()).as(result.toString()).isEqualTo("READY");}var minimums=Map.of("1m",1000,"5m",200,"15m",60,"30m",30,"1h",10,"4h",2,"1d",1);for(var entry:minimums.entrySet()){var rows=candles.read(route,entry.getKey(),from,to,20_000);assertThat(rows).as("real GOLD closed "+entry.getKey()).hasSizeGreaterThan(entry.getValue());assertThat(rows).allMatch(row->!row.time().isBefore(from)&&row.time().isBefore(to));System.out.println("CAPITAL_COMMODITY_HISTORY|XAU/USD|"+entry.getKey()+"|"+rows.size()+"|MULTIPLE_CLOSED_CANDLES");}}

    @Test void streamsRealEurUsdQuoteThroughSevenFramesRedisSseAndFinalizedM1() throws Exception {var emitters=new ArrayList<SseEmitter>();for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES)emitters.add(stream.subscribe("EUR/USD",timeframe));var hub=stream.hubs.get("EURUSD");assertThat(hub).isNotNull();var observer=mock(SseEmitter.class);hub.subscriptions.add(new CapitalStreamProvider.Subscription("EUR/USD","1m",observer));var latest=live.keys("CAPITAL","EURUSD").latest();String first=waitFor(latest,null,60),second=waitFor(latest,first,60);assertThat(second).isNotEqualTo(first);BigDecimal expected=null;for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES){var keys=live.keys("CAPITAL","EURUSD",timeframe);String raw=waitFor(keys.current(),null,10);var node=JSON.readTree(raw);assertThat(node.path("priceBasis").asString()).isEqualTo("MID");assertThat(node.path("final").asBoolean()).isFalse();var close=node.path("close").decimalValue();if(expected==null)expected=close;else assertThat(close).isEqualByComparingTo(expected);long seconds=MarketDataProvider.seconds(timeframe);assertThat(Instant.parse(node.path("openTime").asString()).getEpochSecond()%seconds).isZero();System.out.println("CAPITAL_REALTIME_MATRIX|EUR/USD|"+timeframe+"|"+keys.current()+"|CURRENT_UPDATED|MID");}verify(observer,atLeastOnce()).send(any(SseEmitter.SseEventBuilder.class));var route=registry.resolve("EUR/USD");long end=System.nanoTime()+Duration.ofSeconds(75).toNanos();while(System.nanoTime()<end&&candles.coverage(route).candleCount()==0)Thread.sleep(500);assertThat(candles.coverage(route).candleCount()).isPositive();emitters.forEach(SseEmitter::complete);hub.subscriptions.removeIf(subscription->subscription.emitter()==observer);System.out.println("CAPITAL_E2E|EUR/USD|WEBSOCKET|REDIS_7TF|SSE|POSTGRES_M1|PASS");}
    private String waitFor(String key,String different,int seconds)throws InterruptedException{long end=System.nanoTime()+Duration.ofSeconds(seconds).toNanos();while(System.nanoTime()<end){String value=live.read(key);if(value!=null&&!value.isBlank()&&(different==null||!value.equals(different)))return value;Thread.sleep(250);}throw new AssertionError("Timed out waiting for Capital live state");}
}
