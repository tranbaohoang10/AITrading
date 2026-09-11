package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.LinkedHashSet;

public final class CurrentM1CandleBuilder {
    public record Update(MarketDataProvider.Candle current, MarketDataProvider.Candle finalized, boolean accepted) {}
    private final LinkedHashSet<String> eventIds=new LinkedHashSet<>();
    private MarketDataProvider.Candle current;

    public synchronized Update accept(String eventId, Instant time, BigDecimal price, BigDecimal volume) {
        if(eventId==null||eventId.length()>128||time==null||price==null||price.signum()<=0||volume==null||volume.signum()<0)
            throw new IllegalArgumentException("Invalid market event");
        Instant bucket=Instant.ofEpochSecond(Math.floorDiv(time.getEpochSecond(),60)*60);
        if((current!=null&&bucket.isBefore(current.time()))||!eventIds.add(eventId))return new Update(current,null,false);
        MarketDataProvider.Candle finalized=null;
        if(current==null||bucket.isAfter(current.time())) {
            finalized=current;current=new MarketDataProvider.Candle(bucket,price,price,price,price,volume);eventIds.clear();eventIds.add(eventId);
        } else current=new MarketDataProvider.Candle(bucket,current.open(),current.high().max(price),current.low().min(price),price,current.volume().add(volume));
        while(eventIds.size()>4096)eventIds.remove(eventIds.iterator().next());
        return new Update(current,finalized,true);
    }
}
