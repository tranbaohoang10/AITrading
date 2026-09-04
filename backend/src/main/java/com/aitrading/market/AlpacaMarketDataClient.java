package com.aitrading.market;

import java.net.*;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tools.jackson.databind.json.JsonMapper;

@Service
public class AlpacaMarketDataClient {
    private static final URI DATA=URI.create("https://data.alpaca.markets/v2");
    private static final URI TRADING=URI.create("https://api.alpaca.markets/v2");
    private static final Duration ASSET_CACHE_TTL=Duration.ofMinutes(5);
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
    private final String keyId,secretKey;
    private volatile AssetSnapshot assets;
    private record AssetSnapshot(String body, Instant expiresAt) {}
    public AlpacaMarketDataClient(@Value("${aitrading.market.alpaca.key-id:}") String keyId,@Value("${aitrading.market.alpaca.secret-key:}") String secretKey) { this.keyId=keyId==null?"":keyId.strip(); this.secretKey=secretKey==null?"":secretKey.strip(); }
    public boolean configured() { return !keyId.isEmpty()&&!secretKey.isEmpty()&&keyId.length()<=256&&secretKey.length()<=512; }
    public List<AlpacaMarketDataMapper.Bar> candles(String symbol,String timeframe,int limit,Instant before,Instant now) {
        requireConfigured(); validSymbol(symbol); if(limit<1||limit>AlpacaMarketDataMapper.MAX_BARS)throw new IllegalArgumentException("Invalid candle limit");
        String nativeTimeframe=switch(timeframe) { case "1m"->"1Min"; case "5m"->"5Min"; case "15m"->"15Min"; case "30m"->"30Min"; case "1h"->"1Hour"; case "4h"->"4Hour"; case "1d"->"1Day"; default->throw new IllegalArgumentException("Invalid timeframe"); };
        StringBuilder query=new StringBuilder("timeframe=").append(nativeTimeframe).append("&limit=").append(limit).append("&feed=iex&sort=asc"); if(before!=null)query.append("&end=").append(URLEncoder.encode(before.toString(),StandardCharsets.UTF_8));
        return AlpacaMarketDataMapper.bars(request(DATA.resolve("/stocks/"+symbol+"/bars?"+query)),timeframe,now);
    }
    public List<Map<String,String>> searchAssets(String query) {
        requireConfigured(); if(query==null||query.strip().length()>64)throw new IllegalArgumentException("Invalid search");
        String raw=assetSnapshot();
        final var json=JsonMapper.builder().build(); final var root=json.readTree(raw); if(root==null||!root.isArray())throw new AlpacaDataFailure("ALPACA_INVALID_RESPONSE",502);
        String needle=query.strip().toLowerCase(Locale.ROOT); List<Map<String,String>> result=new ArrayList<>();
        for(var item:root) { String symbol=item.path("symbol").asString(), name=item.path("name").asString(), exchange=item.path("exchange").asString(); if(symbol.toLowerCase(Locale.ROOT).contains(needle)||name.toLowerCase(Locale.ROOT).contains(needle)) { result.add(Map.of("symbol",symbol,"name",name,"exchange",exchange)); if(result.size()==50)break; } }
        return result;
    }
    private String assetSnapshot() {
        AssetSnapshot current=assets;
        if(current!=null&&current.expiresAt().isAfter(Instant.now())) return current.body();
        synchronized(this) {
            current=assets;
            if(current!=null&&current.expiresAt().isAfter(Instant.now())) return current.body();
            String body=request(TRADING.resolve("/assets?status=active&asset_class=us_equity"));
            assets=new AssetSnapshot(body,Instant.now().plus(ASSET_CACHE_TTL));
            return body;
        }
    }
    private String request(URI uri) {
        try {
            HttpRequest request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(15)).header("APCA-API-KEY-ID",keyId).header("APCA-API-SECRET-KEY",secretKey).header("Accept","application/json").GET().build();
            HttpResponse<String> response=http.send(request,HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if(response.statusCode()==429)throw new AlpacaDataFailure("ALPACA_RATE_LIMIT",429);
            if(response.statusCode()<200||response.statusCode()>299)throw new AlpacaDataFailure("ALPACA_PROVIDER_UNAVAILABLE",502);
            if(response.body().length()>8_000_000)throw new AlpacaDataFailure("ALPACA_RESPONSE_TOO_LARGE",502);
            return response.body();
        } catch(AlpacaDataFailure failure) { throw failure; } catch(Exception failure) { throw new AlpacaDataFailure("ALPACA_PROVIDER_UNAVAILABLE",502); }
    }
    private void requireConfigured() { if(!configured())throw new AlpacaDataFailure("ALPACA_UNCONFIGURED",503); }
    private static void validSymbol(String value) { if(value==null||!value.matches("[A-Z][A-Z0-9.]{0,9}"))throw new IllegalArgumentException("Invalid symbol"); }
}
