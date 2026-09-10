package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.*;
import org.junit.jupiter.api.Test;

class AlpacaRecentCandleCacheTests {
    @Test @SuppressWarnings("unchecked") void reusesValidatedLatestCandlesForTheSameClosedSession() {
        var client=mock(AlpacaMarketDataClient.class);var cache=mock(MarketCache.class);
        var nextOpen=Instant.now().plus(Duration.ofHours(4));
        when(client.marketClock()).thenReturn(new AlpacaMarketDataClient.MarketClock(false,Instant.now(),nextOpen,nextOpen.plus(Duration.ofHours(6))));
        when(client.candles(eq("AAPL"),eq("1m"),eq(300),isNull(),any())).thenReturn(List.of(new AlpacaMarketDataMapper.Bar(
                Instant.parse("2026-09-09T19:59:00Z"),Instant.parse("2026-09-09T19:59:59.999Z"),"100","101","99","100.5","10",true)));
        var stored=new AtomicReference<String>();
        when(cache.load(anyString(),eq(Duration.ofHours(6)),any(Predicate.class),any(Supplier.class))).thenAnswer(call->{
            Predicate<String> valid=call.getArgument(2);Supplier<String> source=call.getArgument(3);String current=stored.get();
            if(current!=null&&valid.test(current))return current;String fresh=source.get();stored.set(fresh);return fresh;
        });
        var controller=new AlpacaMarketDataController(client,cache);
        var first=controller.candles(null,"AAPL","1m","300",null);var second=controller.candles(null,"AAPL","1m","300",null);
        assertEquals(first,second);assertEquals(1,first.size());verify(client,times(1)).candles(eq("AAPL"),eq("1m"),eq(300),isNull(),any());
        verify(cache,times(2)).load(anyString(),eq(Duration.ofHours(6)),any(Predicate.class),any(Supplier.class));
    }
}
