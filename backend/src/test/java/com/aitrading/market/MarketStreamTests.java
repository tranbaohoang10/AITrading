package com.aitrading.market;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.math.BigDecimal;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class MarketStreamTests {
    @Test void recoveryDropsRetiredSocketEventsAndRevealsAnHonestPartialSnapshot() {
        var service=new MarketStreamService(mock(MarketCache.class));
        var hub=service.new Hub("BTC-USD|1m","BTC-USD","1m",60);
        hub.clients.add(mock(org.springframework.web.servlet.mvc.method.annotation.SseEmitter.class));
        var old=mock(java.net.http.WebSocket.class);var replacement=mock(java.net.http.WebSocket.class);
        Instant bucket=Instant.ofEpochSecond(Instant.now().getEpochSecond()/60*60-120);
        java.util.function.BiFunction<Long,Instant,String> event=(id,time)->
                "{\"type\":\"match\",\"product_id\":\"BTC-USD\",\"trade_id\":"+id+",\"time\":\""+time+"\",\"price\":\"100\",\"size\":\"1\"}";
        try {
            hub.onOpen(old);
            hub.onText(old,event.apply(1L,bucket.plusSeconds(30)),true);
            hub.onText(old,event.apply(2L,bucket.plusSeconds(60)),true);
            assertEquals("LIVE",hub.status);
            hub.onError(old,new java.io.IOException("Synthetic disconnect"));
            hub.retry.cancel(false);
            assertEquals("RECONNECTING",hub.status);assertNull(hub.snapshot());verify(old).abort();
            hub.onOpen(replacement);
            hub.onText(old,event.apply(999L,bucket.plusSeconds(90)),true);
            assertNull(hub.snapshot());
            hub.onText(replacement,event.apply(3L,bucket.plusSeconds(90)),true);
            assertEquals("DELAYED",hub.status);assertEquals(true,hub.snapshot().get("partial"));
            hub.onClose(old,1006,"Late close");assertEquals("DELAYED",hub.status);
            hub.onText(replacement,event.apply(4L,bucket.plusSeconds(120)),true);
            assertEquals("LIVE",hub.status);assertEquals(false,hub.snapshot().get("partial"));
            var snapshot=hub.snapshot();
            hub.onText(replacement,event.apply(4L,bucket.plusSeconds(120)),true);
            assertEquals(snapshot,hub.snapshot());
        } finally { hub.stop();service.shutdown(); }
    }
    private final Instant start=Instant.parse("2025-01-01T00:00:00Z");
    private boolean tick(CoinbaseCandleAccumulator a,long id,int second,String price,String size){return a.accept(id,start.plusSeconds(second),new BigDecimal(price),new BigDecimal(size),start.plusSeconds(600));}
    @Test void midBucketIsPartialThenFullNextBucketHasExactOhlcvAndDeduplication() {
        var a=new CoinbaseCandleAccumulator(60);
        assertTrue(tick(a,10,30,"100","1"));assertTrue(a.partial());
        assertTrue(tick(a,11,60,"105","2"));assertFalse(a.partial());
        assertTrue(tick(a,12,61,"110","3"));assertTrue(tick(a,13,62,"103","4"));
        assertFalse(tick(a,13,62,"999","999"));
        var bar=a.candle();assertEquals(start.plusSeconds(60),bar.time());
        assertEquals(new BigDecimal("105"),bar.open());assertEquals(new BigDecimal("110"),bar.high());assertEquals(new BigDecimal("103"),bar.low());assertEquals(new BigDecimal("103"),bar.close());assertEquals(new BigDecimal("9"),bar.volume());
        assertFalse(tick(a,14,59,"999","1"));assertEquals(bar,a.candle());
    }
    @Test void missingTradeIdsMarkIncompleteVolumeAndMalformedTradesDoNotPoisonState() {
        var a=new CoinbaseCandleAccumulator(60);
        tick(a,1,30,"100","1");tick(a,2,60,"101","1");assertFalse(a.partial());
        tick(a,4,61,"102","1");assertTrue(a.partial());
        var before=a.candle();assertThrows(IllegalArgumentException.class,()->tick(a,5,62,"-1","1"));assertEquals(before,a.candle());
        assertTrue(tick(a,5,62,"103","1"));
        assertFalse(a.accept(6,start.plusSeconds(1000),BigDecimal.ONE,BigDecimal.ONE,start.plusSeconds(60)));
    }
}
