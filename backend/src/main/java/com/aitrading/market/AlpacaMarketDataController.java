package com.aitrading.market;

import com.aitrading.auth.UserPrincipal;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/market")
public class AlpacaMarketDataController {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final AlpacaMarketDataClient client;
    private final MarketCache cache;
    public record Provider(String provider,String[] assetClasses,String[] modes,String feed,boolean configured,String status) { }
    public record Instrument(String symbol,String name,String assetClass,String exchange,String provider,String feed,double priceIncrement,int pricePrecision,String[] modes) { }
    public record Candle(String symbol,String interval,long openTime,long closeTime,String open,String high,String low,String close,String volume,boolean closed) { }
    public record Error(String code) { }
    public AlpacaMarketDataController(AlpacaMarketDataClient client,MarketCache cache) { this.client=client;this.cache=cache; }
    @GetMapping("/providers")
    public List<Provider> providers(@AuthenticationPrincipal UserPrincipal user) { return List.of(new Provider("ALPACA",new String[]{"STOCK","ETF"},new String[]{"HISTORICAL","REALTIME"},"IEX",client.configured(),"ACCEPTED")); }
    @GetMapping("/alpaca/instruments")
    public List<Instrument> instruments(@AuthenticationPrincipal UserPrincipal user,@RequestParam String query) {
        if(!client.configured())return List.of();
        return client.searchAssets(query).stream().map(item -> new Instrument(item.get("symbol"),item.get("name"),Set.of("SPY","QQQ","IWM","DIA").contains(item.get("symbol"))?"ETF":"STOCK",item.get("exchange"),"ALPACA","IEX",.01,2,new String[]{"HISTORICAL","REALTIME"})).toList();
    }
    @GetMapping("/alpaca/candles")
    public List<Candle> candles(@AuthenticationPrincipal UserPrincipal user,@RequestParam String symbol,@RequestParam String timeframe,@RequestParam(required=false) String limit,@RequestParam(required=false) String before) {
        int amount=MarketService.integer(limit,300,1,300); Instant cursor=before==null?null:parseBefore(before); Instant now=Instant.now();
        var policy=cachePolicy(timeframe,cursor,now);
        String key=MarketCache.key("latest","ALPACA",symbol+"|"+timeframe+"|"+amount+"|"+policy.marker());
        String raw=cache.load(key,policy.ttl(),value->validCachedCandles(value,symbol,timeframe,amount),()->JSON.writeValueAsString(
                client.candles(symbol,timeframe,amount,cursor,now).stream().map(item -> new Candle(symbol,timeframe,item.openTime().toEpochMilli(),item.closeTime().toEpochMilli(),item.open(),item.high(),item.low(),item.close(),item.volume(),item.closed())).toList()));
        return List.of(JSON.readValue(raw,Candle[].class));
    }
    private record CachePolicy(String marker,Duration ttl) { }
    private CachePolicy cachePolicy(String timeframe,Instant cursor,Instant now) {
        if(cursor!=null)return new CachePolicy("before-"+cursor.toEpochMilli(),Duration.ofDays(1));
        try {
            var clock=client.marketClock();
            if(!clock.open())return new CachePolicy("closed-"+clock.nextOpen().toEpochMilli(),Duration.ofHours(6));
        } catch(RuntimeException unavailable) { }
        long bucket=now.getEpochSecond()/Math.min(30,MarketDataProvider.seconds(timeframe));
        return new CachePolicy("open-"+bucket,Duration.ofSeconds(30));
    }
    private boolean validCachedCandles(String raw,String symbol,String timeframe,int amount) {
        try {
            var rows=JSON.readValue(raw,Candle[].class);
            if(rows.length>amount)return false;
            long previous=-1;
            for(var row:rows) {
                if(row==null||!symbol.equals(row.symbol())||!timeframe.equals(row.interval())||row.openTime()<=previous||row.closeTime()<row.openTime()
                        ||!decimal(row.open(),false)||!decimal(row.high(),false)||!decimal(row.low(),false)||!decimal(row.close(),false)||!decimal(row.volume(),true))return false;
                var open=new BigDecimal(row.open());var high=new BigDecimal(row.high());var low=new BigDecimal(row.low());var close=new BigDecimal(row.close());
                if(high.compareTo(open.max(close).max(low))<0||low.compareTo(open.min(close).min(high))>0)return false;
                previous=row.openTime();
            }
            return true;
        } catch(RuntimeException invalid) { return false; }
    }
    private static boolean decimal(String value,boolean zeroAllowed) {
        if(value==null||!value.matches("(?:0|[1-9][0-9]{0,18})(?:\\.[0-9]{1,12})?"))return false;
        return zeroAllowed||new BigDecimal(value).signum()>0;
    }
    private static Instant parseBefore(String value) { try { if(!value.matches("[0-9]{1,16}"))throw new IllegalArgumentException("Invalid cursor"); return Instant.ofEpochMilli(Long.parseLong(value)); } catch(RuntimeException invalid) { throw new IllegalArgumentException("Invalid cursor"); } }
    @ExceptionHandler(AlpacaDataFailure.class) ResponseEntity<Error> alpaca(AlpacaDataFailure failure) { return ResponseEntity.status(failure.status()).body(new Error(failure.code())); }
    @ExceptionHandler(CoinbaseDataFailure.class) ResponseEntity<Error> cache(CoinbaseDataFailure failure) { return ResponseEntity.status(failure.status()).body(new Error(failure.code())); }
}
