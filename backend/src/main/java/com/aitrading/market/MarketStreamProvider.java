package com.aitrading.market;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

interface MarketStreamProvider {
    String providerId();
    boolean configured();
    SseEmitter subscribe(String symbol,String timeframe);
}
