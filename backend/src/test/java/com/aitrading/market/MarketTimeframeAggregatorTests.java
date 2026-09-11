package com.aitrading.market;

import static org.assertj.core.api.Assertions.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.core.StringRedisTemplate;
import static org.mockito.Mockito.mock;

class MarketTimeframeAggregatorTests {
    @Test void aggregatesM1WithUtcBoundariesAndDeterministicOhlcv() {
        var rows=List.of(c("2026-09-11T10:01:00Z","10","12","9","11","2"),c("2026-09-11T10:02:00Z","11","13","10","12","3"),c("2026-09-11T10:05:00Z","20","21","19","20","4"));
        var result=MarketTimeframeAggregator.aggregate(rows,"5m");
        assertThat(result).containsExactly(c("2026-09-11T10:00:00Z","10","13","9","12","5"),c("2026-09-11T10:05:00Z","20","21","19","20","4"));
        assertThat(MarketTimeframeAggregator.aggregate(rows,"5m")).isEqualTo(result);
    }
    @Test void rejectsDuplicatesAndNonMinuteBuckets(){var row=c("2026-09-11T10:01:00Z","10","10","10","10","1");assertThatThrownBy(()->MarketTimeframeAggregator.aggregate(List.of(row,row),"1h")).isInstanceOf(IllegalArgumentException.class);}
    @Test void capitalHistoricalM1ProducesMultipleClosedCandlesForEveryDisplayedTimeframe(){var from=Instant.parse("2026-09-01T00:00:00Z");var to=Instant.parse("2026-09-04T00:00:00Z");var provider=new SyntheticCapitalM1(from,to);var service=new MarketHistoryService(List.of(provider),new MarketCache(mock(StringRedisTemplate.class),false));var minimums=Map.of("1m",4000,"5m",800,"15m",200,"30m",100,"1h",50,"4h",10,"1d",2);for(var entry:minimums.entrySet()){var rows=service.history("CAPITAL","GOLD",entry.getKey(),from,to);assertThat(rows).as(entry.getKey()).hasSizeGreaterThan(entry.getValue());assertThat(rows).allMatch(row->!row.time().isBefore(from)&&row.time().isBefore(to));}assertThat(provider.requested).containsOnly("1m");}
    private static final class SyntheticCapitalM1 implements MarketDataProvider,HistoricalSourceTimeframeProvider {
        private final List<Candle> rows;private final Set<String> requested=new HashSet<>();
        SyntheticCapitalM1(Instant from,Instant to){var values=new ArrayList<Candle>();for(Instant time=from;time.isBefore(to);time=time.plusSeconds(60)){var price=BigDecimal.valueOf(100+values.size()%50);values.add(new Candle(time,price,price.add(BigDecimal.ONE),price.subtract(BigDecimal.ONE),price,BigDecimal.ONE));}rows=List.copyOf(values);}
        public String historicalSourceTimeframe(){return "1m";}
        public Capabilities capabilities(){return new Capabilities("CAPITAL","Capital test",List.of("COMMODITY"),RealtimeTimeframeAggregator.TIMEFRAMES,true,true,false,false,false,false,true,true,true,true,true,"CONDITIONAL","TEST",1000,"UTC",true,List.of());}
        public List<Instrument> search(String query){return List.of();}public Instrument instrument(String symbol){throw new UnsupportedOperationException();}
        public List<Candle> history(String symbol,String timeframe,Instant from,Instant to){requested.add(timeframe);assertThat(timeframe).isEqualTo("1m");return rows.stream().filter(row->!row.time().isBefore(from)&&row.time().isBefore(to)).toList();}
    }
    private static MarketDataProvider.Candle c(String time,String open,String high,String low,String close,String volume){return new MarketDataProvider.Candle(Instant.parse(time),new BigDecimal(open),new BigDecimal(high),new BigDecimal(low),new BigDecimal(close),new BigDecimal(volume));}
}
