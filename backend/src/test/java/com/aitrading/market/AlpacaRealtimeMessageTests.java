package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import org.mockito.ArgumentCaptor;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

class AlpacaRealtimeMessageTests {
    @Test void mapsOnlyExpectedRealTradesAndRejectsMalformedPayloads(){
        var now=Instant.parse("2026-09-09T12:00:05Z");
        var trades=AlpacaRealtimeMessage.trades("""
                [{"T":"success","msg":"authenticated"},{"T":"t","S":"AAPL","i":42,"t":"2026-09-09T12:00:00Z","p":230.25,"s":5}]
                ""","AAPL",now);
        assertEquals(1,trades.size());assertEquals("230.25",trades.getFirst().price().toPlainString());assertEquals("5",trades.getFirst().size().toPlainString());
        var invalid=java.util.List.of("{}",
                "[{'T':'t','S':'NVDA','i':1,'t':'2026-09-09T12:00:00Z','p':1,'s':1}]".replace((char)39,(char)34),
                "[{'T':'t','S':'AAPL','i':1,'t':'2027-09-09T12:00:00Z','p':1,'s':1}]".replace((char)39,(char)34),
                "[{'T':'t','S':'AAPL','i':1,'t':'2026-09-09T12:00:00Z','p':0,'s':1}]".replace((char)39,(char)34));
        for(String raw:invalid)assertThrows(AlpacaDataFailure.class,()->AlpacaRealtimeMessage.trades(raw,"AAPL",now));
    }
    @Test void reconnectUsesBoundedExponentialBackoff(){
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var hub=provider.new Hub("AAPL|1m","AAPL","1m",60);hub.clients.add(mock(SseEmitter.class));
        try{hub.reconnect();assertEquals(2000,hub.reconnectDelayMillis);hub.retry.cancel(false);hub.reconnect();assertEquals(4000,hub.reconnectDelayMillis);}
        finally{hub.clients.clear();hub.stop();provider.close();}
    }
    @Test void publishesAuthenticatedBeforeSubscribingForTrades(){
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var hub=provider.new Hub("AAPL|1m","AAPL","1m",60);var emitter=mock(SseEmitter.class);hub.clients.add(emitter);var socket=mock(java.net.http.WebSocket.class);hub.socket=socket;
        try{
            hub.onText(socket,"[{\"T\":\"success\",\"msg\":\"authenticated\"}]",true);
            assertTrue(hub.authenticated);assertEquals("AUTHENTICATED",hub.status);
            var payload=ArgumentCaptor.forClass(CharSequence.class);verify(socket).sendText(payload.capture(),eq(true));
            var json=tools.jackson.databind.json.JsonMapper.builder().build().readTree(payload.getValue().toString());
            assertEquals("subscribe",json.path("action").asString());assertEquals("AAPL",json.path("trades").get(0).asString());
        } finally { hub.clients.clear();hub.stop();provider.close(); }
    }
}
