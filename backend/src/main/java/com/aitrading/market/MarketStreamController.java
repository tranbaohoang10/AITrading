package com.aitrading.market;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/market/stream")
public class MarketStreamController {
    private final MarketStreamService service;
    public MarketStreamController(MarketStreamService service){this.service=service;}
    @GetMapping(produces="text/event-stream") public SseEmitter subscribe(@RequestParam String symbol,@RequestParam String timeframe){return service.subscribe(symbol,timeframe);}
}
