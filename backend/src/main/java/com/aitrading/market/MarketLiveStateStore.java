package com.aitrading.market;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
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
    public Keys keys(String provider,String symbol){return keys(provider,symbol,"1m");}
    public Keys keys(String provider,String symbol,String timeframe){String prefix="aitrading:v2:market:"+token(provider)+":"+token(symbol);return new Keys(prefix+":latest",prefix+":"+frame(timeframe)+":current",prefix+":status");}
    public boolean write(String provider,String symbol,BigDecimal price,Instant eventAt,MarketDataProvider.Candle candle,String liveStatus,long eventCount){return writeFrames(provider,symbol,price,eventAt,Map.of("1m",candle),liveStatus,eventCount,"LAST");}
    public boolean writeFrames(String provider,String symbol,BigDecimal price,Instant eventAt,Map<String,MarketDataProvider.Candle> candles,String liveStatus,long eventCount,String priceBasis){
        if(price==null||price.signum()<=0||eventAt==null||candles==null||candles.isEmpty()||liveStatus==null||eventCount<0||!Set.of("MID","LAST").contains(priceBasis))throw new IllegalArgumentException("Invalid live state");
        if(!enabled){status="DEGRADED";return false;}
        try {
            var base=keys(provider,symbol);
            redis.opsForValue().set(base.latest(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"price",price,"priceBasis",priceBasis,"lastEventAt",eventAt,"eventCount",eventCount)),Duration.ofSeconds(30));
            for(var entry:candles.entrySet()){
                MarketDataProvider.seconds(entry.getKey());var candle=entry.getValue();if(candle==null)throw new IllegalArgumentException("Invalid live candle");
                var value=new LinkedHashMap<String,Object>();value.put("provider",provider);value.put("symbol",symbol);value.put("timeframe",entry.getKey());value.put("openTime",candle.time());value.put("open",candle.open());value.put("high",candle.high());value.put("low",candle.low());value.put("close",candle.close());value.put("volume",candle.volume());value.put("updatedAt",eventAt);value.put("final",false);value.put("priceBasis",priceBasis);value.put("eventCount",eventCount);value.put("candle",candle);value.put("partial",true);
                redis.opsForValue().set(keys(provider,symbol,entry.getKey()).current(),JSON.writeValueAsString(value),ttl(entry.getKey()));
            }
            redis.opsForValue().set(base.status(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"status",liveStatus,"lastEventAt",eventAt,"eventCount",eventCount)),Duration.ofSeconds(45));status="HEALTHY";return true;
        }catch(RuntimeException failure){status="DEGRADED";return false;}
    }
    public void status(String provider,String symbol,String liveStatus){if(!enabled)return;try{redis.opsForValue().set(keys(provider,symbol).status(),JSON.writeValueAsString(Map.of("provider",provider,"symbol",symbol,"status",liveStatus,"updatedAt",Instant.now())),Duration.ofSeconds(45));status="HEALTHY";}catch(RuntimeException failure){status="DEGRADED";}}
    public String read(String key){if(!enabled)return null;try{return redis.opsForValue().get(key);}catch(RuntimeException failure){status="DEGRADED";return null;}}
    public String health(){return status;}
    private static Duration ttl(String timeframe){long seconds=MarketDataProvider.seconds(timeframe);return Duration.ofSeconds(Math.min(172800,Math.max(180,seconds*3L)));}
    private static String frame(String timeframe){MarketDataProvider.seconds(timeframe);return switch(timeframe){case "1m"->"M1";case "5m"->"M5";case "15m"->"M15";case "30m"->"M30";case "1h"->"H1";case "4h"->"H4";case "1d"->"D1";default->throw new IllegalArgumentException("Unsupported timeframe");};}
    private static String token(String value){if(value==null)throw new IllegalArgumentException("Invalid live state key");String token=value.toUpperCase(Locale.ROOT).replace("/","").replace("-","").replace("_","").replace(":","");if(!token.matches("[A-Z0-9]{2,64}"))throw new IllegalArgumentException("Invalid live state key");return token;}
}
