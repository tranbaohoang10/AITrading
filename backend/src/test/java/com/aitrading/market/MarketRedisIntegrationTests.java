package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.*;
import org.springframework.data.redis.core.StringRedisTemplate;

/** Opt-in test for the owned disposable loopback server; the last test stops that server. */
@EnabledIfEnvironmentVariable(named="AITRADING_REDIS_DISPOSABLE",matches="6387")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MarketRedisIntegrationTests {
    LettuceConnectionFactory connection;
    StringRedisTemplate redis;
    @BeforeEach void connect() {
        connection=new LettuceConnectionFactory(new RedisStandaloneConfiguration("127.0.0.1",6387),
                LettuceClientConfiguration.builder().commandTimeout(Duration.ofMillis(500)).shutdownTimeout(Duration.ofMillis(100)).build());
        connection.afterPropertiesSet();connection.start();redis=new StringRedisTemplate(connection);redis.afterPropertiesSet();
    }
    @AfterEach void close(){connection.destroy();}
    @Test @Order(1) void realRedisHitMissMalformedProviderIsolationAndTtl() throws Exception {
        String key=MarketCache.key("history","COINBASE","integration-"+java.util.UUID.randomUUID());
        String other=MarketCache.key("history","BINANCE","integration-"+java.util.UUID.randomUUID());
        var cache=new MarketCache(redis,true);var calls=new AtomicInteger();
        var source=(java.util.function.Supplier<String>)()->{calls.incrementAndGet();return "valid";};
        try {
            // Hit behavior is separate from the explicit 150ms expiry assertion below.
            // A loaded CI host must not accidentally turn the hit check into an expiry test.
            assertEquals("valid",cache.load(key,Duration.ofSeconds(30),"valid"::equals,source));
            assertEquals("valid",cache.load(key,Duration.ofSeconds(30),"valid"::equals,source));assertEquals(1,calls.get());
            assertTrue(redis.getExpire(key,java.util.concurrent.TimeUnit.MILLISECONDS)>0);
            assertTrue(redis.getExpire(key,java.util.concurrent.TimeUnit.MILLISECONDS)<=30000);
            assertNull(redis.opsForValue().get(other));
            redis.opsForValue().set(key,"malformed");
            assertEquals("valid",cache.load(key,Duration.ofMillis(150),"valid"::equals,source));assertEquals(2,calls.get());
            long deadline=System.nanoTime()+Duration.ofSeconds(3).toNanos();
            while(redis.hasKey(key)&&System.nanoTime()<deadline)Thread.sleep(20);
            assertFalse(redis.hasKey(key));assertEquals("HEALTHY",cache.status());
        } finally {redis.delete(key);redis.delete(other);}
    }
    @Test @Order(2) void separateCacheInstancesShareLeaseAndCannotReleaseAnotherOwnersLock() throws Exception {
        String key=MarketCache.key("history","BINANCE","lease-"+java.util.UUID.randomUUID());
        var firstCache=new MarketCache(redis,true);var secondCache=new MarketCache(redis,true);
        var calls=new AtomicInteger();var entered=new java.util.concurrent.CountDownLatch(1);var release=new java.util.concurrent.CountDownLatch(1);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var first=pool.submit(()->firstCache.load(key,Duration.ofMinutes(1),"valid"::equals,()->{
                calls.incrementAndGet();entered.countDown();
                try{if(!release.await(5,java.util.concurrent.TimeUnit.SECONDS))throw new IllegalStateException();}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException(e);}
                return "valid";
            }));
            assertTrue(entered.await(5,java.util.concurrent.TimeUnit.SECONDS));
            assertTrue(redis.getExpire(key+":lock")>0);
            var second=pool.submit(()->secondCache.load(key,Duration.ofMinutes(1),"valid"::equals,()->{calls.incrementAndGet();return "valid";}));
            release.countDown();assertEquals("valid",first.get(5,java.util.concurrent.TimeUnit.SECONDS));assertEquals("valid",second.get(5,java.util.concurrent.TimeUnit.SECONDS));
            assertEquals(1,calls.get());assertFalse(redis.hasKey(key+":lock"));
            redis.delete(key);
            firstCache.load(key,Duration.ofMinutes(1),"valid"::equals,()->{redis.opsForValue().set(key+":lock","replacement-owner",Duration.ofSeconds(10));return "valid";});
            assertEquals("replacement-owner",redis.opsForValue().get(key+":lock"));
        }finally {release.countDown();redis.delete(key);redis.delete(key+":lock");}
    }
    @Test @Order(3) void stoppingOwnedRedisPreservesSourceAndReportsDegraded() {
        String key=MarketCache.key("history","COINBASE","shutdown-"+java.util.UUID.randomUUID());
        var cache=new MarketCache(redis,true);
        assertEquals("first",cache.load(key,Duration.ofMinutes(1),v->true,()->"first"));
        assertEquals("HEALTHY",cache.status());
        try(var command=connection.getConnection()){command.serverCommands().shutdown();}
        assertEquals("fallback",cache.load(key,Duration.ofMinutes(1),v->true,()->"fallback"));
        assertEquals("DEGRADED",cache.status());
    }
}
