package com.aitrading.market;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import org.mockito.ArgumentCaptor;
import java.time.Instant;
import java.util.List;
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
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var hub=provider.new Hub("AAPL|1m","AAPL","1m",60);hub.clients.add(mock(SseEmitter.class));provider.hubs.put(hub.key,hub);
        try{provider.reconnect();assertEquals(2000,provider.reconnectDelayMillis);provider.retry.cancel(false);provider.reconnect();assertEquals(4000,provider.reconnectDelayMillis);}
        finally{provider.close();}
    }
    @Test void publishesAuthenticatedBeforeSubscribingUnionOnOneSocket(){
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var aapl=provider.new Hub("AAPL|1m","AAPL","1m",60);var nvda=provider.new Hub("NVDA|5m","NVDA","5m",300);aapl.clients.add(mock(SseEmitter.class));nvda.clients.add(mock(SseEmitter.class));provider.hubs.put(aapl.key,aapl);provider.hubs.put(nvda.key,nvda);var socket=mock(java.net.http.WebSocket.class);provider.socket=socket;
        try{
            provider.onText(socket,"[{\"T\":\"success\",\"msg\":\"authenticated\"}]",true);
            assertTrue(provider.authenticated);assertEquals("AUTHENTICATED",provider.status);assertEquals("AUTHENTICATED",aapl.status);assertEquals("AUTHENTICATED",nvda.status);
            var payload=ArgumentCaptor.forClass(CharSequence.class);verify(socket).sendText(payload.capture(),eq(true));
            var json=tools.jackson.databind.json.JsonMapper.builder().build().readTree(payload.getValue().toString());
            assertEquals("subscribe",json.path("action").asString());assertEquals(List.of("AAPL","NVDA"),List.of(json.path("trades").get(0).asString(),json.path("trades").get(1).asString()));
        } finally { provider.close(); }
    }
    @Test void routesMultiplexedTradesToMatchingTimeframeHubsWithoutDuplicates(){
        var cache=mock(MarketCache.class);var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),cache);var aapl=provider.new Hub("AAPL|1m","AAPL","1m",60);var nvda=provider.new Hub("NVDA|5m","NVDA","5m",300);aapl.clients.add(mock(SseEmitter.class));nvda.clients.add(mock(SseEmitter.class));provider.hubs.put(aapl.key,aapl);provider.hubs.put(nvda.key,nvda);var socket=mock(java.net.http.WebSocket.class);provider.socket=socket;
        String raw="[{\"T\":\"subscription\",\"trades\":[\"AAPL\",\"NVDA\"]},{\"T\":\"t\",\"S\":\"AAPL\",\"i\":42,\"t\":\"2026-09-09T12:00:00Z\",\"p\":230.25,\"s\":5},{\"T\":\"t\",\"S\":\"NVDA\",\"i\":84,\"t\":\"2026-09-09T12:01:00Z\",\"p\":180.5,\"s\":3}]";
        try{
            provider.onText(socket,raw,true);var firstAapl=aapl.bar;var firstNvda=nvda.bar;assertNotNull(firstAapl);assertNotNull(firstNvda);assertEquals("230.25",firstAapl.close().toPlainString());assertEquals("180.5",firstNvda.close().toPlainString());assertEquals("LIVE",aapl.status);assertEquals("LIVE",nvda.status);
            provider.onText(socket,raw,true);assertEquals(firstAapl,aapl.bar);assertEquals(firstNvda,nvda.bar);
        } finally { provider.close(); }
    }
    @Test void unsubscribesOnlyAfterTheLastTimeframeHubForASymbolIsRemoved() throws Exception {
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var oneMinute=provider.new Hub("AAPL|1m","AAPL","1m",60);var fiveMinute=provider.new Hub("AAPL|5m","AAPL","5m",300);var first=mock(SseEmitter.class);var second=mock(SseEmitter.class);oneMinute.clients.add(first);fiveMinute.clients.add(second);provider.hubs.put(oneMinute.key,oneMinute);provider.hubs.put(fiveMinute.key,fiveMinute);var socket=mock(java.net.http.WebSocket.class);provider.socket=socket;provider.authenticated=true;
        try{
            oneMinute.remove(first);verifyNoInteractions(socket);assertTrue(provider.hubs.containsKey(fiveMinute.key));
            reset(socket);fiveMinute.remove(second);var payload=ArgumentCaptor.forClass(CharSequence.class);verify(socket).sendText(payload.capture(),eq(true));var json=tools.jackson.databind.json.JsonMapper.builder().build().readTree(payload.getValue().toString());assertEquals("unsubscribe",json.path("action").asString());assertEquals("AAPL",json.path("trades").get(0).asString());assertTrue(provider.hubs.isEmpty());
        } finally { provider.close(); }
    }
    @Test void newHubReportsSharedAuthenticationBeforeItsSubscriptionAck() {
        var provider=new AlpacaStreamProvider(new AlpacaMarketDataClient("key","secret"),mock(MarketCache.class));var existing=provider.new Hub("AAPL|1m","AAPL","1m",60);existing.clients.add(mock(SseEmitter.class));provider.hubs.put(existing.key,existing);provider.started=true;provider.authenticated=true;provider.status="AUTHENTICATED";provider.socket=mock(java.net.http.WebSocket.class);
        try{
            var emitter=provider.subscribe("NVDA","1m");assertEquals("AUTHENTICATED",provider.hubs.get("NVDA|1m").status);verify(provider.socket).sendText(org.mockito.ArgumentMatchers.contains("NVDA"),eq(true));emitter.complete();
        } finally { provider.close(); }
    }
    @Test void distinguishesMarketClosedFromAStaleOrDisconnectedStream() {
        var client=mock(AlpacaMarketDataClient.class);var provider=new AlpacaStreamProvider(client,mock(MarketCache.class));var hub=provider.new Hub("AAPL|1m","AAPL","1m",60);hub.clients.add(mock(SseEmitter.class));hub.status="SUBSCRIBED";provider.hubs.put(hub.key,hub);provider.authenticated=true;
        try{
            when(client.marketClock()).thenReturn(new AlpacaMarketDataClient.MarketClock(false,Instant.parse("2026-09-10T09:00:00Z"),Instant.parse("2026-09-10T13:30:00Z"),Instant.parse("2026-09-10T20:00:00Z")));
            provider.heartbeat();assertEquals("MARKET_CLOSED",hub.status);
            when(client.marketClock()).thenReturn(new AlpacaMarketDataClient.MarketClock(true,Instant.parse("2026-09-10T14:00:00Z"),Instant.parse("2026-09-11T13:30:00Z"),Instant.parse("2026-09-10T20:00:00Z")));
            provider.heartbeat();assertEquals("SUBSCRIBED",hub.status);
        } finally { provider.close(); }
    }
}
