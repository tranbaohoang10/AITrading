package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.time.Duration;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class MarketCacheTests {
    private static final Duration TTL=Duration.ofMinutes(5);
    private static final String KEY=MarketCache.key("history","COINBASE","BTC-USD|1h");
    @Test void keysSeparateProvidersAndRejectNamespaceInjection() {
        var cache=new MarketCache(mock(StringRedisTemplate.class),false);
        assertNotEquals(KEY,MarketCache.key("history","BINANCE","BTC-USD|1h"));
        assertFalse(KEY.contains("BTC-USD"));
        assertThrows(IllegalArgumentException.class,()->MarketCache.key("history:session","COINBASE","x"));
        assertThrows(IllegalArgumentException.class,()->cache.store("aitrading:v1:market:session:user","x",TTL));
        assertThrows(IllegalArgumentException.class,()->cache.load(KEY,Duration.ofDays(2),v->true,()->"x"));
    }
    @Test @SuppressWarnings("unchecked") void hitSkipsProviderAndMalformedCacheIsReplacedWithBoundedTtl() {
        var redis=mock(StringRedisTemplate.class);
        ValueOperations<String,String> values=mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(values);
        when(values.get(KEY)).thenReturn("valid","broken");
        when(values.setIfAbsent(eq(KEY+":lock"),anyString(),eq(Duration.ofSeconds(65)))).thenReturn(true);
        var cache=new MarketCache(redis,true);var calls=new AtomicInteger();
        assertEquals("valid",cache.load(KEY,TTL,"valid"::equals,()->{calls.incrementAndGet();return "valid";}));
        assertEquals(0,calls.get());
        assertEquals("valid",cache.load(KEY,TTL,"valid"::equals,()->{calls.incrementAndGet();return "valid";}));
        assertEquals(1,calls.get());verify(redis).delete(KEY);verify(values).set(KEY,"valid",TTL);
        assertEquals("HEALTHY",cache.status());
    }
    @Test void redisFailureFallsBackAndOpensCircuitWithoutLosingSource() {
        var redis=mock(StringRedisTemplate.class);when(redis.opsForValue()).thenThrow(new IllegalStateException("offline"));
        var cache=new MarketCache(redis,true);
        assertEquals("fresh",cache.load(KEY,TTL,"fresh"::equals,()->"fresh"));
        assertEquals("fresh",cache.load(KEY,TTL,"fresh"::equals,()->"fresh"));
        assertEquals("DEGRADED",cache.status());verify(redis,times(1)).opsForValue();
    }
    @Test void concurrentMissesShareOneProviderCallAndFailedSourceDoesNotPoisonRetry() throws Exception {
        var cache=new MarketCache(mock(StringRedisTemplate.class),false);
        var entered=new CountDownLatch(1);var release=new CountDownLatch(1);var calls=new AtomicInteger();
        try(var pool=Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->cache.load(KEY,TTL,"fresh"::equals,()->{
                calls.incrementAndGet();entered.countDown();
                try{if(!release.await(5,TimeUnit.SECONDS))throw new IllegalStateException();}
                catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
                return "fresh";
            }));
            assertTrue(entered.await(5,TimeUnit.SECONDS));
            var secondStarted=new CountDownLatch(1);
            var second=pool.submit(()->{secondStarted.countDown();return cache.load(KEY,TTL,"fresh"::equals,()->{calls.incrementAndGet();return "fresh";});});
            assertTrue(secondStarted.await(5,TimeUnit.SECONDS));
            // Wait until the second caller is blocked on the shared future, not on a guessed sleep.
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while(!second.isDone()&&System.nanoTime()<deadline) {
                if(Thread.getAllStackTraces().values().stream().anyMatch(stack->java.util.Arrays.stream(stack).anyMatch(f->f.getClassName().equals("java.util.concurrent.CompletableFuture")&&f.getMethodName().equals("timedGet"))))break;
                Thread.onSpinWait();
            }
            release.countDown();assertEquals("fresh",first.get(5,TimeUnit.SECONDS));assertEquals("fresh",second.get(5,TimeUnit.SECONDS));assertEquals(1,calls.get());
        }
        assertThrows(CoinbaseDataFailure.class,()->cache.load(KEY,TTL,"fresh"::equals,()->"invalid"));
        assertEquals("fresh",cache.load(KEY,TTL,"fresh"::equals,()->"fresh"));
    }
}
