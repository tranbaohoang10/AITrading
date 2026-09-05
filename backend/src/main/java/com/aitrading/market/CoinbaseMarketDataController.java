package com.aitrading.market;

import com.aitrading.auth.UserPrincipal;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market/coinbase")
public class CoinbaseMarketDataController {
    private final CoinbaseMarketDataClient client;
    public record Error(String code) { }
    public CoinbaseMarketDataController(CoinbaseMarketDataClient client) { this.client=client; }
    @GetMapping(value="/catalog",produces=MediaType.APPLICATION_JSON_VALUE)
    public String catalog(@AuthenticationPrincipal UserPrincipal user) { return client.products(); }
    @GetMapping(value="/series/{symbol}/{step}",produces=MediaType.APPLICATION_JSON_VALUE)
    public String latest(@AuthenticationPrincipal UserPrincipal user,@PathVariable String symbol,@PathVariable int step) { return client.series(symbol,step,null,null); }
    @GetMapping(value="/series/{symbol}/{step}/{from}/{to}",produces=MediaType.APPLICATION_JSON_VALUE)
    public String range(@AuthenticationPrincipal UserPrincipal user,@PathVariable String symbol,@PathVariable int step,@PathVariable long from,@PathVariable long to) { return client.series(symbol,step,from,to); }
    @ExceptionHandler(CoinbaseDataFailure.class) ResponseEntity<Error> coinbase(CoinbaseDataFailure failure) { return ResponseEntity.status(failure.status()).body(new Error(failure.code())); }
}
