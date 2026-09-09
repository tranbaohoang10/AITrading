package com.aitrading.market;

import java.util.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/market/stream")
public class MarketStreamController {
    private final Map<String,MarketStreamProvider> providers;
    public MarketStreamController(List<MarketStreamProvider> providers){var values=new TreeMap<String,MarketStreamProvider>();for(var provider:providers)values.put(provider.providerId(),provider);this.providers=Map.copyOf(values);}
    @GetMapping(produces="text/event-stream") public SseEmitter subscribe(@RequestParam(defaultValue="COINBASE")String provider,@RequestParam String symbol,@RequestParam String timeframe){
        var selected=providers.get(provider);if(selected==null||!selected.configured())throw new IllegalArgumentException("Unsupported stream provider");return selected.subscribe(symbol,timeframe);
    }
}
