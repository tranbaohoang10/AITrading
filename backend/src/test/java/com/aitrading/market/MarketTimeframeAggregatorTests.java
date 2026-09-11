package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;

class MarketTimeframeAggregatorTests {
    @Test void aggregatesM1WithUtcBoundariesAndDeterministicOhlcv() {
        var rows=List.of(c("2026-09-11T10:01:00Z","10","12","9","11","2"),c("2026-09-11T10:02:00Z","11","13","10","12","3"),c("2026-09-11T10:05:00Z","20","21","19","20","4"));
        var result=MarketTimeframeAggregator.aggregate(rows,"5m");
        assertThat(result).containsExactly(c("2026-09-11T10:00:00Z","10","13","9","12","5"),c("2026-09-11T10:05:00Z","20","21","19","20","4"));
        assertThat(MarketTimeframeAggregator.aggregate(rows,"5m")).isEqualTo(result);
    }
    @Test void rejectsDuplicatesAndNonMinuteBuckets(){var row=c("2026-09-11T10:01:00Z","10","10","10","10","1");assertThatThrownBy(()->MarketTimeframeAggregator.aggregate(List.of(row,row),"1h")).isInstanceOf(IllegalArgumentException.class);}
    private static MarketDataProvider.Candle c(String time,String open,String high,String low,String close,String volume){return new MarketDataProvider.Candle(Instant.parse(time),new BigDecimal(open),new BigDecimal(high),new BigDecimal(low),new BigDecimal(close),new BigDecimal(volume));}
}
