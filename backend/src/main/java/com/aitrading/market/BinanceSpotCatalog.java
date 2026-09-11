package com.aitrading.market;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

final class BinanceSpotCatalog {
    private List<MarketDataProvider.Instrument> snapshot=List.of();
    private long expires, retryAfter;
    synchronized List<MarketDataProvider.Instrument> instruments() {
        if(System.nanoTime()<expires)return snapshot;
        if(System.nanoTime()<retryAfter)throw new CoinbaseDataFailure("BINANCE_CATALOG_UNAVAILABLE",503);
        try {
            var http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
            byte[] bytes=BinanceArchiveProvider.fetch(http,URI.create("https://data-api.binance.vision/api/v3/exchangeInfo?permissions=SPOT&symbolStatus=TRADING"),8_000_000,System.nanoTime()+Duration.ofSeconds(15).toNanos());
            snapshot=parse(new String(bytes,java.nio.charset.StandardCharsets.UTF_8));
            expires=System.nanoTime()+Duration.ofMinutes(5).toNanos(); return snapshot;
        } catch(Exception failure) { if(failure instanceof InterruptedException)Thread.currentThread().interrupt(); retryAfter=System.nanoTime()+Duration.ofSeconds(30).toNanos(); throw new CoinbaseDataFailure("BINANCE_CATALOG_UNAVAILABLE",502); }
    }
    static List<MarketDataProvider.Instrument> parse(String raw) {
        var rows=JsonMapper.builder().build().readTree(raw).path("symbols");
        if(!rows.isArray()||rows.size()>20000)throw new IllegalArgumentException("Invalid catalog");
        var result=new TreeMap<String,MarketDataProvider.Instrument>();
        for(var row:rows) {
            if(!row.path("isSpotTradingAllowed").asBoolean()||!row.path("status").asString().equals("TRADING"))continue;
            String symbol=row.path("symbol").asString(),base=row.path("baseAsset").asString(),quote=row.path("quoteAsset").asString();
            if(!symbol.matches("[A-Z0-9]{2,32}")||!base.matches("[A-Z0-9]{1,20}")||!quote.matches("[A-Z0-9]{1,20}")||!symbol.equals(base+quote))continue;
            BigDecimal tick=null;
            for(var filter:row.path("filters"))if(filter.path("filterType").asString().equals("PRICE_FILTER"))tick=new BigDecimal(filter.path("tickSize").asString()).stripTrailingZeros();
            if(tick==null||tick.signum()<=0||tick.scale()>12)continue;
            var instrument=new MarketDataProvider.Instrument("BINANCE:"+symbol,base+"/"+quote,symbol,"BINANCE","CRYPTO",base,quote,"Binance",quote,"SPOT","UTC",tick,null,null,null,null,"BASE_QUANTITY",null,BigDecimal.ONE,null,"QUANTITY_ONLY",List.of("HISTORICAL","REALTIME"),List.of("1m","5m","15m","30m","1h","4h","1d"),"UNKNOWN",base+"/"+quote);
            if(result.putIfAbsent(symbol,instrument)!=null)throw new IllegalArgumentException("Duplicate catalog identity");
        }
        return List.copyOf(result.values());
    }
}
