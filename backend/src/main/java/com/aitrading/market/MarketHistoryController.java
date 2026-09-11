package com.aitrading.market;

import java.time.Instant;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/market/providers")
public class MarketHistoryController {
    private final MarketHistoryService service;
    private final InstrumentCatalogStore catalog;
    public MarketHistoryController(MarketHistoryService service,InstrumentCatalogStore catalog){this.service=service;this.catalog=catalog;}
    @GetMapping("/capabilities") public Map<String,Object> capabilities(){return Map.of("items",service.capabilities(),"cacheStatus",service.cacheStatus());}
    @GetMapping("/catalog") public Object unifiedCatalog(@RequestParam(defaultValue="")String query,
            @RequestParam(defaultValue="")String assetClass,@RequestParam(defaultValue="")String exchange,
            @RequestParam(defaultValue="")String country,@RequestParam(defaultValue="true")boolean active,
            @RequestParam(required=false)String cursor){return catalog.search(query,assetClass,exchange,country,active,cursor);}
    @GetMapping("/catalog/status") public Object catalogStatus(){return Map.of("counts",catalog.counts(),"providers",catalog.syncStatus());}
    @GetMapping("/{provider}/instruments") public Object search(@PathVariable String provider,@RequestParam(defaultValue="")String query){return service.search(provider,query);}
    @GetMapping("/{provider}/catalog") public Object catalog(@PathVariable String provider,@RequestParam(defaultValue="")String query,
            @RequestParam(defaultValue="")String assetClass,@RequestParam(required=false)String cursor){return service.catalog(provider,query,assetClass,cursor);}
    @GetMapping("/{provider}/coverage") public Object coverage(@PathVariable String provider,@RequestParam String symbol,
            @RequestParam String timeframe,@RequestParam Instant from,@RequestParam Instant to){return service.coverage(provider,symbol,timeframe,from,to);}
    @GetMapping("/{provider}/history") public Object history(@PathVariable String provider,@RequestParam String symbol,
            @RequestParam String timeframe,@RequestParam Instant from,@RequestParam Instant to){return service.history(provider,symbol,timeframe,from,to);}
    @ExceptionHandler(CoinbaseDataFailure.class) ResponseEntity<Map<String,String>> failure(CoinbaseDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
    @ExceptionHandler(AlpacaDataFailure.class) ResponseEntity<Map<String,String>> failure(AlpacaDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
    @ExceptionHandler(OandaDataFailure.class) ResponseEntity<Map<String,String>> failure(OandaDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
    @ExceptionHandler(CtraderDataFailure.class) ResponseEntity<Map<String,String>> failure(CtraderDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
    @ExceptionHandler(FrankfurterDataFailure.class) ResponseEntity<Map<String,String>> failure(FrankfurterDataFailure error){return ResponseEntity.status(error.status()).body(Map.of("code",error.code()));}
}
