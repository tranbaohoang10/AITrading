package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;

/** A subscription starting mid-bucket cannot claim complete OHLCV for that bucket. */
final class CoinbaseCandleAccumulator {
    private final int seconds;
    private long lastTrade=-1;
    private Instant lastTime;
    private MarketDataProvider.Candle candle;
    private boolean partial=true;
    CoinbaseCandleAccumulator(int seconds){if(seconds<60||seconds>86400)throw new IllegalArgumentException();this.seconds=seconds;}
    MarketDataProvider.Candle candle(){return candle;}
    boolean partial(){return partial;}
    boolean accept(long trade,Instant time,BigDecimal price,BigDecimal size,Instant now) {
        if(trade<0||trade<=lastTrade||time==null||time.isAfter(now.plusSeconds(5))||lastTime!=null&&time.isBefore(lastTime))return false;
        // Validate before mutating any deduplication state.
        var next=MarketStreamService.aggregate(candle,time,price,size,seconds);
        boolean gap=lastTrade>=0&&trade!=lastTrade+1;
        if(candle!=null&&next.time().isAfter(candle.time()))partial=gap;
        else if(gap)partial=true;
        candle=next;lastTime=time;lastTrade=trade;return true;
    }
}
