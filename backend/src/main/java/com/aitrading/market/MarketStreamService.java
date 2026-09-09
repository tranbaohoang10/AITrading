package com.aitrading.market;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.json.JsonMapper;

/** Shared public Coinbase trades; no REST polling and no private account data in events. */
@Service
public class MarketStreamService implements MarketStreamProvider {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final ScheduledExecutorService scheduler=Executors.newScheduledThreadPool(2,Thread.ofPlatform().daemon().factory());
    private final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();
    private final MarketCache cache;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    public MarketStreamService(MarketCache cache){this.cache=cache;}
    public String providerId(){return "COINBASE";}
    public boolean configured(){return true;}
    public SseEmitter subscribe(String symbol,String timeframe) {
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9]{0,14}-USD"))throw new IllegalArgumentException("Invalid stream symbol");
        int step=MarketDataProvider.seconds(timeframe);
        String key=symbol+"|"+timeframe;
        synchronized(hubs) {
            if(!hubs.containsKey(key)&&hubs.size()>=16)throw new CoinbaseDataFailure("STREAM_CAPACITY",503);
            Hub hub=hubs.computeIfAbsent(key,k->new Hub(k,symbol,timeframe,step));
            if(hub.clients.size()>=128)throw new CoinbaseDataFailure("STREAM_CAPACITY",503);
            SseEmitter emitter=new SseEmitter(30*60_000L);hub.clients.add(emitter);
            Runnable remove=()->{hub.clients.remove(emitter);if(hub.clients.isEmpty())hub.stop();};
            emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(e->remove.run());
            hub.send(emitter,"status",Map.of("status",hub.status,"provider","COINBASE"));
            var snapshot=hub.snapshot();if(snapshot!=null)hub.send(emitter,"snapshot",snapshot);
            if(!hub.started){hub.started=true;hub.connect();}
            return emitter;
        }
    }
    final class Hub implements WebSocket.Listener {
        final String key,symbol,timeframe;final int seconds;
        final CopyOnWriteArrayList<SseEmitter> clients=new CopyOnWriteArrayList<>();
        volatile WebSocket socket;volatile String status="CONNECTING";volatile boolean started,stopped;
        volatile MarketDataProvider.Candle bar;volatile Instant lastEvent;long lastCacheWrite;
        CoinbaseCandleAccumulator accumulator;
        final StringBuilder text=new StringBuilder();ScheduledFuture<?> heartbeat,retry;
        Hub(String key,String symbol,String timeframe,int seconds){this.key=key;this.symbol=symbol;this.timeframe=timeframe;this.seconds=seconds;accumulator=new CoinbaseCandleAccumulator(seconds);}
        synchronized Map<String,Object> snapshot(){return bar==null?null:Map.of("provider","COINBASE","symbol",symbol,"timeframe",timeframe,"candle",bar,"partial",accumulator.partial());}
        void connect() {
            if(stopped)return;
            publish("status",Map.of("status",status,"provider","COINBASE"));
            http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(8)).buildAsync(URI.create("wss://ws-feed.exchange.coinbase.com"),this)
                    .exceptionally(error->{reconnect();return null;});
            if(heartbeat==null)heartbeat=scheduler.scheduleAtFixedRate(()->{
                if(lastEvent!=null&&Duration.between(lastEvent,Instant.now()).getSeconds()>30){status="DELAYED";publish("status",Map.of("status",status));}
                publish("heartbeat",Map.of("at",Instant.now().toString(),"status",status));
            },10,10,TimeUnit.SECONDS);
        }
        public synchronized void onOpen(WebSocket ws) {
            if(stopped){ws.abort();return;}socket=ws;
            ws.sendText(JSON.writeValueAsString(Map.of("type","subscribe","product_ids",List.of(symbol),"channels",List.of("matches","heartbeat"))),true);
            ws.request(1);
        }
        public CompletionStage<?> onText(WebSocket ws,CharSequence data,boolean last) {
            synchronized(this) {
                if(stopped||ws!=socket)return null;
                if(text.length()+data.length()>65536){text.setLength(0);ws.abort();reconnect();return null;}
                text.append(data);
                if(last) {
                    try {
                        var event=JSON.readTree(text.toString());
                        if(event.path("type").asString().equals("match")&&event.path("product_id").asString().equals(symbol)&&event.path("trade_id").isIntegralNumber()) {
                            long trade=event.path("trade_id").asLong();
                            Instant time=Instant.parse(event.path("time").asString());
                            var price=new BigDecimal(event.path("price").asString());var size=new BigDecimal(event.path("size").asString());
                            if(accumulator.accept(trade,time,price,size,Instant.now())) {
                                var next=accumulator.candle();boolean partial=accumulator.partial();
                                lastEvent=Instant.now();bar=next;status="LIVE";
                                var state=Map.of("provider","COINBASE","symbol",symbol,"timeframe",timeframe,"candle",next,"lastEventAt",time.toString(),"partial",partial);
                                publish("candle",state);
                                publish("status",Map.of("status",status,"provider","COINBASE","partial",partial));
                                if(System.nanoTime()-lastCacheWrite>=Duration.ofSeconds(1).toNanos()) {
                                lastCacheWrite=System.nanoTime();
                                cache.store(MarketCache.key("bar","COINBASE",key),JSON.writeValueAsString(state),Duration.ofSeconds(Math.min(86400,Math.max(seconds*2,120))));
                                cache.store(MarketCache.key("latest","COINBASE",symbol),JSON.writeValueAsString(Map.of("price",price,"lastEventAt",time.toString())),Duration.ofSeconds(15));
                                cache.store(MarketCache.key("health","COINBASE",key),JSON.writeValueAsString(Map.of("status",status,"lastEventAt",time.toString(),"partial",partial)),Duration.ofSeconds(30));
                                }
                            }
                        }
                    }catch(RuntimeException malformed){/* Untrusted provider events never execute or enter state. */}
                    finally{text.setLength(0);}
                }
            }
            ws.request(1);return null;
        }
        public synchronized CompletionStage<?> onClose(WebSocket ws,int code,String reason){if(ws==socket)reconnect();return null;}
        public synchronized void onError(WebSocket ws,Throwable error){if(ws==socket)reconnect();}
        synchronized void reconnect() {
            if(stopped||retry!=null&&!retry.isDone())return;
            var retired=socket;socket=null;if(retired!=null)retired.abort();
            text.setLength(0);status="RECONNECTING";bar=null;lastEvent=null;accumulator=new CoinbaseCandleAccumulator(seconds);publish("status",Map.of("status",status));
            retry=scheduler.schedule(this::connect,3,TimeUnit.SECONDS);
        }
        void send(SseEmitter client,String event,Object value){try{client.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){clients.remove(client);}}
        void publish(String event,Object value){for(var client:clients)send(client,event,value);if(clients.isEmpty())stop();}
        void stop(){stopped=true;if(socket!=null)socket.abort();if(heartbeat!=null)heartbeat.cancel(false);if(retry!=null)retry.cancel(false);hubs.remove(key,this);}
    }
    static MarketDataProvider.Candle aggregate(MarketDataProvider.Candle current,Instant time,BigDecimal price,BigDecimal volume,int seconds) {
        Instant bucket=Instant.ofEpochSecond(Math.floorDiv(time.getEpochSecond(),seconds)*seconds);
        var tick=new MarketDataProvider.Candle(bucket,price,price,price,price,volume);
        if(current==null||bucket.isAfter(current.time()))return tick;
        if(bucket.isBefore(current.time()))return current;
        return new MarketDataProvider.Candle(bucket,current.open(),current.high().max(price),current.low().min(price),price,current.volume().add(volume));
    }
    @PreDestroy void shutdown(){hubs.values().forEach(Hub::stop);scheduler.shutdownNow();}
}
