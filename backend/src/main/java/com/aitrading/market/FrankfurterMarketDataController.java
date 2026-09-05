package com.aitrading.market;

import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/market/frankfurter")
public class FrankfurterMarketDataController {
    private final FrankfurterMarketDataClient client;
    public record Error(String code) { }
    public FrankfurterMarketDataController(FrankfurterMarketDataClient client) { this.client = client; }

    @GetMapping(value = "/candles", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<FrankfurterMarketDataClient.Candle> candles(@RequestParam String symbol, @RequestParam int limit, @RequestParam(required = false) Long before) {
        return client.candles(symbol, limit, before);
    }
    @ExceptionHandler(FrankfurterDataFailure.class) ResponseEntity<Error> frankfurter(FrankfurterDataFailure failure) { return ResponseEntity.status(failure.status()).body(new Error(failure.code())); }
    @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<Error> invalid() { return ResponseEntity.badRequest().body(new Error("FRANKFURTER_INVALID_REQUEST")); }
}
