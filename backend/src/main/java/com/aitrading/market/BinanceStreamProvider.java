package com.aitrading.market;

import jakarta.annotation.PreDestroy;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import tools.jackson.databind.json.JsonMapper;

@Service
public final class BinanceStreamProvider implements MarketStreamProvider {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ScheduledExecutorService scheduler=Executors.newScheduledThreadPool(2,Thread.ofPlatform().daemon().factory());
    final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();
    private final MarketSymbolRegistry registry;private final MarketProviderCandleStore candles;private final MarketLiveStateStore live;
    public BinanceStreamProvider(MarketSymbolRegistry registry,MarketProviderCandleStore candles,MarketLiveStateStore live){this.registry=registry;this.candles=candles;this.live=live;}
    public String providerId(){return "BINANCE";}public boolean configured(){return true;}
    public SseEmitter subscribe(String requested,String timeframe){var route=registry.resolve(requested);if(!route.provider().equals("BINANCE")||!route.providerSymbol().matches("[A-Z0-9]{4,32}"))throw new IllegalArgumentException("Invalid Binance stream symbol");MarketDataProvider.seconds(timeframe);String key=route.providerSymbol()+"|"+timeframe;if(!hubs.containsKey(key)&&hubs.size()>=16)throw new CoinbaseDataFailure("BINANCE_STREAM_CAPACITY",503);var hub=hubs.computeIfAbsent(key,unused->new Hub(key,requested,route,timeframe));return hub.add();}
    final class Hub implements WebSocket.Listener {
        final String key,requested,timeframe;final MarketSymbolRegistry.Route route;final int frameSeconds;final Set<SseEmitter> clients=ConcurrentHashMap.newKeySet();final StringBuilder text=new StringBuilder();final CurrentM1CandleBuilder builder=new CurrentM1CandleBuilder();final TreeMap<Instant,MarketDataProvider.Candle> minutes=new TreeMap<>();
        volatile WebSocket socket;volatile String status="CONNECTING";volatile boolean stopped;volatile long eventCount,reconnectDelay=1000;ScheduledFuture<?> retry,heartbeat;
        Hub(String key,String requested,MarketSymbolRegistry.Route route,String timeframe){this.key=key;this.requested=requested;this.route=route;this.timeframe=timeframe;this.frameSeconds=MarketDataProvider.seconds(timeframe);connect();heartbeat=scheduler.scheduleAtFixedRate(()->publish("heartbeat",Map.of("at",Instant.now(),"status",status,"eventCount",eventCount)),10,10,TimeUnit.SECONDS);}
        SseEmitter add(){if(clients.size()>=128)throw new CoinbaseDataFailure("BINANCE_STREAM_CAPACITY",503);var emitter=new SseEmitter(30*60_000L);clients.add(emitter);Runnable remove=()->{clients.remove(emitter);if(clients.isEmpty())stop();};emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(error->remove.run());send(emitter,"status",Map.of("status",status,"provider","BINANCE"));if(!minutes.isEmpty())send(emitter,"snapshot",state(frame(),true));return emitter;}
        synchronized void connect(){if(stopped)return;status="CONNECTING";live.status("BINANCE",route.providerSymbol(),status);URI uri=URI.create("wss://stream.binance.com:9443/ws/"+route.providerSymbol().toLowerCase(Locale.ROOT)+"@aggTrade");http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(10)).buildAsync(uri,this).whenComplete((value,error)->{if(error!=null)reconnect();});}
        public void onOpen(WebSocket webSocket){synchronized(this){if(stopped){webSocket.abort();return;}socket=webSocket;status="SUBSCRIBED";reconnectDelay=1000;live.status("BINANCE",route.providerSymbol(),status);publish("status",Map.of("status",status,"provider","BINANCE"));}webSocket.request(1);}
        public CompletionStage<?> onText(WebSocket webSocket,CharSequence data,boolean last){synchronized(this){if(stopped||webSocket!=socket)return null;if(text.length()+data.length()>65536){text.setLength(0);webSocket.abort();reconnect();return null;}text.append(data);if(last){try{handle(text.toString());}catch(RuntimeException malformed){}finally{text.setLength(0);}}}webSocket.request(1);return null;}
        private void handle(String raw){var event=JSON.readTree(raw);if(!event.path("e").asString().equals("aggTrade")||!event.path("s").asString().equals(route.providerSymbol())||!event.path("a").isIntegralNumber()||!event.path("T").isIntegralNumber())return;String id=Long.toString(event.path("a").asLong());Instant at=Instant.ofEpochMilli(event.path("T").asLong());var price=new BigDecimal(event.path("p").asString());var quantity=new BigDecimal(event.path("q").asString());var update=builder.accept(id,at,price,quantity);if(!update.accepted())return;eventCount++;if(update.finalized()!=null)candles.upsert(route,List.of(update.finalized()));minutes.put(update.current().time(),update.current());Instant bucket=Instant.ofEpochSecond(Math.floorDiv(update.current().time().getEpochSecond(),frameSeconds)*frameSeconds);minutes.headMap(bucket,false).clear();while(minutes.size()>Math.max(1,frameSeconds/60))minutes.pollFirstEntry();var frame=frame();status="LIVE";boolean redis=live.write("BINANCE",route.providerSymbol(),price,at,update.current(),status,eventCount);publish("candle",state(frame,true));publish("status",Map.of("status",status,"provider","BINANCE","redis",redis,"eventCount",eventCount));}
        private MarketDataProvider.Candle frame(){return MarketTimeframeAggregator.aggregate(List.copyOf(minutes.values()),timeframe).getLast();}
        private Map<String,Object> state(MarketDataProvider.Candle candle,boolean partial){return Map.of("provider","BINANCE","symbol",requested,"timeframe",timeframe,"candle",candle,"lastEventAt",Instant.now(),"partial",partial,"eventCount",eventCount,"redisKeys",live.keys("BINANCE",route.providerSymbol()));}
        public CompletionStage<?> onClose(WebSocket webSocket,int code,String reason){synchronized(this){if(webSocket==socket)reconnect();}return null;}public void onError(WebSocket webSocket,Throwable error){synchronized(this){if(webSocket==socket)reconnect();}}
        synchronized void reconnect(){if(stopped||retry!=null&&!retry.isDone())return;var old=socket;socket=null;if(old!=null)old.abort();status="RECONNECTING";live.status("BINANCE",route.providerSymbol(),status);publish("status",Map.of("status",status,"provider","BINANCE"));long delay=reconnectDelay;reconnectDelay=Math.min(30_000,reconnectDelay*2);retry=scheduler.schedule(this::connect,delay,TimeUnit.MILLISECONDS);}
        void send(SseEmitter emitter,String event,Object value){try{emitter.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){clients.remove(emitter);}}
        void publish(String event,Object value){for(var client:clients)send(client,event,value);}
        synchronized void stop(){if(stopped)return;stopped=true;if(socket!=null)socket.abort();if(retry!=null)retry.cancel(false);if(heartbeat!=null)heartbeat.cancel(false);hubs.remove(key,this);live.status("BINANCE",route.providerSymbol(),"DISCONNECTED");}
    }
    @PreDestroy void shutdown(){hubs.values().forEach(Hub::stop);scheduler.shutdownNow();}
}
