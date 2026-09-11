package com.aitrading.market;

import java.math.BigDecimal;
import java.time.*;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public final class MarketLiveStateStore {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final StringRedisTemplate redis;private final boolean enabled;private volatile String status;
    public MarketLiveStateStore(StringRedisTemplate redis,@Value("${aitrading.market.redis.enabled:false}")boolean enabled){this.redis=redis;this.enabled=enabled;this.status=enabled?"CONNECTING":"DEGRADED";}
    public record Keys(String latest,String current,String status) {}
    public Keys keys(String provider,String symbol){String prefix="aitrading:v2:market:"+token(provider)+":"+token(symbol);return new Keys(prefix+":latest",prefix+":M1:current",prefix+":status");}
    public boolean write(String provider,String symbol,BigDecimal price,Instant eventAt,MarketDataProvider.Candle candle,String liveStatus,long eventCount) {
        if(price==null||price.signum()<=0||eventAt==null||candle==null||liveStatus==null||eventCount<0)throw new IllegalArgumentException("Invalid live state");
        if(!enabled){status="DEGRADED";return false;}var keys=keys(provider,symbol);
        try {redis.opsForValue().set(keys.latest(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"price",price,"lastEventAt",eventAt,"eventCount",eventCount)),Duration.ofSeconds(30));redis.opsForValue().set(keys.current(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"timeframe","1m","candle",candle,"partial",true,"eventCount",eventCount)),Duration.ofMinutes(3));redis.opsForValue().set(keys.status(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"status",liveStatus,"lastEventAt",eventAt,"eventCount",eventCount)),Duration.ofSeconds(45));status="HEALTHY";return true;}catch(RuntimeException failure){status="DEGRADED";return false;}
    }
    public void status(String provider,String symbol,String liveStatus){if(!enabled)return;try{redis.opsForValue().set(keys(provider,symbol).status(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"status",liveStatus,"updatedAt",Instant.now())),Duration.ofSeconds(45));status="HEALTHY";}catch(RuntimeException failure){status="DEGRADED";}}
    public String read(String key){if(!enabled)return null;try{return redis.opsForValue().get(key);}catch(RuntimeException failure){status="DEGRADED";return null;}}
    public String health(){return status;}
    private static String token(String value){if(value==null){throw new IllegalArgumentException("Invalid live state key");}String token=value.toUpperCase(java.util.Locale.ROOT).replace("/","").replace("-","").replace("_","").replace(":","");if(!token.matches("[A-Z0-9]{2,64}"))throw new IllegalArgumentException("Invalid live state key");return token;}
}
