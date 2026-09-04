package com.aitrading.market;

import com.aitrading.auth.UserPrincipal;
import java.time.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market")
public class AlpacaMarketDataController {
    private final AlpacaMarketDataClient client;
    public record Provider(String provider,String[] assetClasses,String[] modes,String feed,boolean configured,String status) { }
    public record Instrument(String symbol,String name,String assetClass,String exchange,String provider,String feed,double priceIncrement,int pricePrecision,String[] modes) { }
    public record Candle(String symbol,String interval,long openTime,long closeTime,String open,String high,String low,String close,String volume,boolean closed) { }
    public record Error(String code) { }
    public AlpacaMarketDataController(AlpacaMarketDataClient client) { this.client=client; }
    @GetMapping("/providers")
    public List<Provider> providers(@AuthenticationPrincipal UserPrincipal user) { return List.of(new Provider("ALPACA",new String[]{"STOCK","ETF"},new String[]{"HISTORICAL","DELAYED"},"IEX",client.configured(),"ACCEPTED")); }
    @GetMapping("/alpaca/instruments")
    public List<Instrument> instruments(@AuthenticationPrincipal UserPrincipal user,@RequestParam String query) {
        if(!client.configured())return List.of();
        return client.searchAssets(query).stream().map(item -> new Instrument(item.get("symbol"),item.get("name"),"STOCK",item.get("exchange"),"ALPACA","IEX",.01,2,new String[]{"HISTORICAL","DELAYED"})).toList();
    }
    @GetMapping("/alpaca/candles")
    public List<Candle> candles(@AuthenticationPrincipal UserPrincipal user,@RequestParam String symbol,@RequestParam String timeframe,@RequestParam(required=false) String limit,@RequestParam(required=false) String before) {
        int amount=MarketService.integer(limit,300,1,300); Instant cursor=before==null?null:parseBefore(before); Instant now=Instant.now();
        return client.candles(symbol,timeframe,amount,cursor,now).stream().map(item -> new Candle(symbol,timeframe,item.openTime().toEpochMilli(),item.closeTime().toEpochMilli(),item.open(),item.high(),item.low(),item.close(),item.volume(),item.closed())).toList();
    }
    private static Instant parseBefore(String value) { try { if(!value.matches("[0-9]{1,16}"))throw new IllegalArgumentException("Invalid cursor"); return Instant.ofEpochMilli(Long.parseLong(value)); } catch(RuntimeException invalid) { throw new IllegalArgumentException("Invalid cursor"); } }
    @ExceptionHandler(AlpacaDataFailure.class) ResponseEntity<Error> alpaca(AlpacaDataFailure failure) { return ResponseEntity.status(failure.status()).body(new Error(failure.code())); }
}
