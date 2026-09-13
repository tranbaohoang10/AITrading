package com.aitrading.market;

import java.math.*;
import java.time.*;
import java.util.*;

public final class RealtimeTimeframeAggregator {
    public static final List<String> TIMEFRAMES=List.of("1m","5m","15m","30m","1h","4h","1d");
    public record Quote(String eventId,Instant time,BigDecimal bid,BigDecimal offer) {}
    public record Update(boolean accepted,BigDecimal price,Map<String,MarketDataProvider.Candle> current,MarketDataProvider.Candle finalizedM1) {}
    private final LinkedHashMap<String,MarketDataProvider.Candle> current=new LinkedHashMap<>();
    private Instant lastTime;private String lastId;

    public synchronized Update accept(Quote quote){
        validate(quote);
        if(lastTime!=null&&quote.time().isBefore(lastTime)||Objects.equals(lastId,quote.eventId()))return new Update(false,null,Map.copyOf(current),null);
        BigDecimal price=quote.bid().add(quote.offer()).divide(BigDecimal.valueOf(2),12,RoundingMode.HALF_EVEN).stripTrailingZeros();
        MarketDataProvider.Candle finalizedM1=null;
        for(String timeframe:TIMEFRAMES){
            int seconds=MarketDataProvider.seconds(timeframe);
            Instant bucket=Instant.ofEpochSecond(Math.floorDiv(quote.time().getEpochSecond(),seconds)*seconds);
            var before=current.get(timeframe);
            if(before==null||bucket.isAfter(before.time())){
                if("1m".equals(timeframe))finalizedM1=before;
                current.put(timeframe,new MarketDataProvider.Candle(bucket,price,price,price,price,BigDecimal.ZERO));
            }else if(bucket.equals(before.time()))current.put(timeframe,new MarketDataProvider.Candle(bucket,before.open(),before.high().max(price),before.low().min(price),price,BigDecimal.ZERO));
        }
        lastTime=quote.time();lastId=quote.eventId();
        return new Update(true,price,Map.copyOf(current),finalizedM1);
    }
    public synchronized Map<String,MarketDataProvider.Candle> snapshot(){return Map.copyOf(current);}
    private static void validate(Quote quote){
        if(quote==null||quote.eventId()==null||quote.eventId().isBlank()||quote.eventId().length()>128||quote.time()==null
                ||quote.time().isBefore(Instant.parse("2000-01-01T00:00:00Z"))||quote.time().isAfter(Instant.now().plusSeconds(60))
                ||quote.bid()==null||quote.offer()==null||quote.bid().signum()<=0||quote.offer().signum()<=0
                ||quote.bid().scale()>12||quote.offer().scale()>12)throw new IllegalArgumentException("Invalid live quote");
    }
}
