package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@EnabledIfEnvironmentVariable(named="AITRADING_REAL_MARKET",matches="true")
@SpringBootTest(properties={"spring.datasource.url=jdbc:postgresql://127.0.0.1:${AITRADING_TEST_DB_PORT}/postgres","aitrading.market.redis.enabled=true","spring.data.redis.port=${AITRADING_REDIS_DISPOSABLE}"})
class RealBinanceRealtimeIntegrationTests {
    @Autowired BinanceStreamProvider stream;@Autowired MarketLiveStateStore live;@Autowired MarketProviderCandleStore candles;@Autowired MarketSymbolRegistry registry;
    @Test void receivesRealTradesUpdatesRedisCurrentM1PublishesSseAndPersistsClosedMinute() throws Exception {var emitter=stream.subscribe("BTCUSDT","1m");var hub=stream.hubs.get("BTCUSDT|1m");var observer=mock(SseEmitter.class);hub.clients.add(observer);var keys=live.keys("BINANCE","BTCUSDT");String first=waitFor(keys.current(),null,35);String second=waitFor(keys.current(),first,35);assertThat(first).contains("BTCUSDT").contains("eventCount");assertThat(second).isNotEqualTo(first);assertThat(live.read(keys.latest())).contains("lastEventAt");assertThat(live.read(keys.status())).contains("LIVE");verify(observer,atLeastOnce()).send(any(SseEmitter.SseEventBuilder.class));var route=registry.resolve("BTC/USDT");long end=System.nanoTime()+Duration.ofSeconds(75).toNanos();while(System.nanoTime()<end&&candles.coverage(route).candleCount()==0)Thread.sleep(500);assertThat(candles.coverage(route).candleCount()).isPositive();emitter.complete();hub.clients.remove(observer);System.out.println("REALTIME_MATRIX|BTC/USDT|BINANCE|REDIS_UPDATED|SSE_PUBLISHED|M1_PERSISTED|"+keys.current()+"|"+live.read(keys.latest()));}
    private String waitFor(String key,String different,int seconds){long end=System.nanoTime()+Duration.ofSeconds(seconds).toNanos();while(System.nanoTime()<end){String value=live.read(key);if(value!=null&&!value.isBlank()&&(different==null||!value.equals(different)))return value;try{Thread.sleep(250);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();break;}}throw new AssertionError("Timed out waiting for real Binance Redis state");}
}
