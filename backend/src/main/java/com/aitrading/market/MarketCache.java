package com.aitrading.market;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.concurrent.*;
import java.util.function.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

/** Optional non-security cache. Auth and durable replay commands never use this cache. */
@Service
public class MarketCache {
    private final StringRedisTemplate redis;
    private final boolean enabled;
    private volatile long retryAfter;
    private volatile String status;
    private final ConcurrentHashMap<String,CompletableFuture<String>> flights=new ConcurrentHashMap<>();
    private static final DefaultRedisScript<Long> RELEASE=new DefaultRedisScript<>(
            "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",Long.class);
    private record Lease(String token,String cached) {}
    public MarketCache(StringRedisTemplate redis,@Value("${aitrading.market.redis.enabled:false}")boolean enabled) {
        this.redis=redis;this.enabled=enabled;status=enabled?"CONNECTING":"DEGRADED";
    }
    public String status(){return status;}
    private static void validateRequest(String key,Duration ttl) {
        if(key==null||!key.matches("aitrading:v1:market:(catalog|history|coverage|bar|latest|health):(COINBASE|BINANCE|ALPACA|DUKASCOPY|OANDA|CTRADER|CAPITAL|FRANKFURTER|FRED):[a-f0-9]{64}")
                ||ttl==null||ttl.isNegative()||ttl.isZero()||ttl.compareTo(Duration.ofDays(1))>0)
            throw new IllegalArgumentException("Invalid cache request");
    }
    public void store(String key,String value,Duration ttl) {
        validateRequest(key,ttl);
        if(value==null||value.length()>4_000_000)throw new IllegalArgumentException("Invalid cache value");
        if(available())try{redis.opsForValue().set(key,value,ttl);status="HEALTHY";}catch(RuntimeException unavailable){failed();}
    }
    public static String key(String purpose,String provider,String identity) {
        if(purpose==null||!purpose.matches("catalog|history|coverage|bar|latest|health")
                ||provider==null||!provider.matches("COINBASE|BINANCE|ALPACA|DUKASCOPY|OANDA|CTRADER|CAPITAL|FRANKFURTER|FRED")
                ||identity==null||identity.length()>512)throw new IllegalArgumentException("Invalid market cache key");
        try {
            String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(identity.getBytes(StandardCharsets.UTF_8)));
            return "aitrading:v1:market:"+purpose+":"+provider+":"+hash;
        }catch(java.security.NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}
    }
    private boolean available(){return enabled&&System.nanoTime()>=retryAfter;}
    private void failed(){status="DEGRADED";retryAfter=System.nanoTime()+Duration.ofSeconds(5).toNanos();}
    private Lease lease(String key,Predicate<String> valid) {
        if(!available())return new Lease(null,null);
        String token=java.util.UUID.randomUUID().toString();long deadline=System.nanoTime()+Duration.ofSeconds(5).toNanos();
        try {
            do {
                if(Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(key+":lock",token,Duration.ofSeconds(65)))) {
                    String cached=redis.opsForValue().get(key);
                    return new Lease(token,cached!=null&&cached.length()<=4_000_000&&valid.test(cached)?cached:null);
                }
                String cached=redis.opsForValue().get(key);
                if(cached!=null&&cached.length()<=4_000_000&&valid.test(cached))return new Lease(null,cached);
                try{Thread.sleep(50);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();throw new CoinbaseDataFailure("HISTORY_BUSY",503);}
            }while(System.nanoTime()<deadline);
        }catch(CoinbaseDataFailure busy){throw busy;}
        catch(RuntimeException unavailable){failed();return new Lease(null,null);}
        throw new CoinbaseDataFailure("HISTORY_BUSY",503);
    }
    private void release(String key,Lease lease) {
        if(lease!=null&&lease.token()!=null&&available())try{redis.execute(RELEASE,java.util.List.of(key+":lock"),lease.token());}
        catch(RuntimeException unavailable){failed();}
    }
    public String load(String key,Duration ttl,Predicate<String> valid,Supplier<String> source) {
        validateRequest(key,ttl);
        if(available())try {
            String cached=redis.opsForValue().get(key);status="HEALTHY";
            if(cached!=null) {
                if(cached.length()<=4_000_000&&valid.test(cached))return cached;
                redis.delete(key);
            }
        }catch(RuntimeException unavailable){failed();}
        var promise=new CompletableFuture<String>();
        var other=flights.putIfAbsent(key,promise);
        if(other!=null)try{return other.get(60,TimeUnit.SECONDS);}
        catch(Exception failure){if(failure instanceof InterruptedException)Thread.currentThread().interrupt();throw new CoinbaseDataFailure("HISTORY_BUSY",503);}
        Lease lease=null;
        try {
            if(flights.size()>64)throw new CoinbaseDataFailure("HISTORY_BUSY",503);
            lease=lease(key,valid);
            if(lease.cached()!=null){promise.complete(lease.cached());return lease.cached();}
            String fresh=source.get();
            if(fresh==null||fresh.length()>4_000_000||!valid.test(fresh))throw new CoinbaseDataFailure("INVALID_HISTORY",502);
            if(available())try{redis.opsForValue().set(key,fresh,ttl);status="HEALTHY";}catch(RuntimeException unavailable){failed();}
            promise.complete(fresh);return fresh;
        }catch(RuntimeException failure){promise.completeExceptionally(failure);throw failure;}
        finally{release(key,lease);flights.remove(key,promise);}
    }
}
