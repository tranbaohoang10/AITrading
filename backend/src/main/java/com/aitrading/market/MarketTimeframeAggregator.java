package com.aitrading.market;

import java.time.Instant;
import java.util.*;

public final class MarketTimeframeAggregator {
    private MarketTimeframeAggregator() {}

    public static List<MarketDataProvider.Candle> aggregate(List<MarketDataProvider.Candle> minuteCandles, String timeframe) {
        int seconds=MarketDataProvider.seconds(timeframe);
        var rows=validateMinutes(minuteCandles);
        if(seconds==60)return rows;
        var result=new ArrayList<MarketDataProvider.Candle>();
        MarketDataProvider.Candle current=null;
        for(var minute:rows) {
            Instant bucket=Instant.ofEpochSecond(Math.floorDiv(minute.time().getEpochSecond(),seconds)*seconds);
            if(current==null||!current.time().equals(bucket)) {
                if(current!=null)result.add(current);
                current=new MarketDataProvider.Candle(bucket,minute.open(),minute.high(),minute.low(),minute.close(),minute.volume());
            } else current=new MarketDataProvider.Candle(bucket,current.open(),current.high().max(minute.high()),
                    current.low().min(minute.low()),minute.close(),current.volume().add(minute.volume()));
        }
        if(current!=null)result.add(current);
        return List.copyOf(result);
    }

    private static List<MarketDataProvider.Candle> validateMinutes(List<MarketDataProvider.Candle> rows) {
        if(rows==null||rows.size()>2_000_000)throw new IllegalArgumentException("Invalid candle set");
        Instant previous=null;var copy=new ArrayList<MarketDataProvider.Candle>(rows.size());
        for(var row:rows) {
            if(row==null||row.time().getEpochSecond()%60!=0||previous!=null&&!row.time().isAfter(previous))
                throw new IllegalArgumentException("Invalid M1 order");
            previous=row.time();copy.add(row);
        }
        return List.copyOf(copy);
    }
}
