package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.*;
import org.springframework.data.redis.core.StringRedisTemplate;

@EnabledIfEnvironmentVariable(named="AITRADING_REDIS_DISPOSABLE",matches="[0-9]{4,5}")
class MarketLiveStateRedisIntegrationTests {
    LettuceConnectionFactory connection;StringRedisTemplate redis;
    @BeforeEach void connect(){int port=Integer.parseInt(System.getenv("AITRADING_REDIS_DISPOSABLE"));connection=new LettuceConnectionFactory(new RedisStandaloneConfiguration("127.0.0.1",port),LettuceClientConfiguration.builder().commandTimeout(java.time.Duration.ofSeconds(2)).build());connection.afterPropertiesSet();connection.start();redis=new StringRedisTemplate(connection);redis.afterPropertiesSet();}
    @AfterEach void close(){if(connection!=null)connection.destroy();}
    @Test void writesLatestCurrentM1AndStatusToRealRedis(){var store=new MarketLiveStateStore(redis,true);var first=c("2026-09-11T07:50:00Z","100");assertThat(store.write("BINANCE","BTCUSDT",new BigDecimal("100"),Instant.parse("2026-09-11T07:50:10Z"),first,"LIVE",1)).isTrue();var keys=store.keys("BINANCE","BTCUSDT");String firstState=store.read(keys.current());var second=new MarketDataProvider.Candle(first.time(),first.open(),new BigDecimal("101"),first.low(),new BigDecimal("101"),new BigDecimal("2"));assertThat(store.write("BINANCE","BTCUSDT",new BigDecimal("101"),Instant.parse("2026-09-11T07:50:20Z"),second,"LIVE",2)).isTrue();assertThat(store.read(keys.latest())).contains("101").contains("eventCount");assertThat(store.read(keys.current())).isNotEqualTo(firstState).contains("101");assertThat(store.read(keys.status())).contains("LIVE");}
    @Test void writesAllCapitalTimeframesWithMidProvenance(){var store=new MarketLiveStateStore(redis,true);var frames=new java.util.LinkedHashMap<String,MarketDataProvider.Candle>();for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES)frames.put(timeframe,c("2026-09-11T00:00:00Z","100"));assertThat(store.writeFrames("CAPITAL","EURUSD",new BigDecimal("100"),Instant.parse("2026-09-11T07:50:20Z"),frames,"LIVE",2,"MID")).isTrue();for(String timeframe:RealtimeTimeframeAggregator.TIMEFRAMES){var key=store.keys("CAPITAL","EURUSD",timeframe).current();assertThat(store.read(key)).contains("\"priceBasis\":\"MID\"").contains("\"timeframe\":\""+timeframe+"\"").contains("\"final\":false");}}
    private static MarketDataProvider.Candle c(String time,String price){var value=new BigDecimal(price);return new MarketDataProvider.Candle(Instant.parse(time),value,value,value,value,BigDecimal.ONE);}
}
