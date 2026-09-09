package com.aitrading.market;

import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.json.JsonMapper;

@Service
public class AlpacaStreamProvider implements MarketStreamProvider {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final AlpacaMarketDataClient client;
    private final MarketCache cache;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ScheduledExecutorService scheduler=Executors.newScheduledThreadPool(2,Thread.ofPlatform().daemon().factory());
    private final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();
    public AlpacaStreamProvider(AlpacaMarketDataClient client,MarketCache cache){this.client=client;this.cache=cache;}
    public String providerId(){return "ALPACA";}
    public boolean configured(){return client.configured();}
    public SseEmitter subscribe(String symbol,String timeframe){
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9.]{0,9}"))throw new IllegalArgumentException("Invalid Alpaca stream symbol");
        int step=MarketDataProvider.seconds(timeframe);String key=symbol+"|"+timeframe;
        synchronized(hubs){
            if(!hubs.containsKey(key)&&hubs.size()>=16)throw new AlpacaDataFailure("ALPACA_STREAM_CAPACITY",503);
            Hub hub=hubs.computeIfAbsent(key,k->new Hub(k,symbol,timeframe,step));
            if(hub.clients.size()>=128)throw new AlpacaDataFailure("ALPACA_STREAM_CAPACITY",503);
            SseEmitter emitter=new SseEmitter(30*60_000L);hub.clients.add(emitter);Runnable remove=()->{hub.clients.remove(emitter);if(hub.clients.isEmpty())hub.stop();};
            emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(error->remove.run());hub.send(emitter,"status",Map.of("status",hub.status,"provider","ALPACA"));
            var snapshot=hub.snapshot();if(snapshot!=null)hub.send(emitter,"snapshot",snapshot);if(!hub.started){hub.started=true;hub.connect();}return emitter;
        }
    }
    final class Hub implements WebSocket.Listener {
        final String key,symbol,timeframe;final int seconds;final CopyOnWriteArrayList<SseEmitter> clients=new CopyOnWriteArrayList<>();final StringBuilder text=new StringBuilder();
        volatile WebSocket socket;volatile String status="CONNECTING";volatile boolean started,stopped,authenticated;volatile MarketDataProvider.Candle bar;volatile Instant lastEvent;long lastTrade=-1,lastCacheWrite,reconnectDelayMillis=1000;ScheduledFuture<?> heartbeat,retry,watchdog;
        Hub(String key,String symbol,String timeframe,int seconds){this.key=key;this.symbol=symbol;this.timeframe=timeframe;this.seconds=seconds;}
        synchronized Map<String,Object> snapshot(){return bar==null?null:Map.of("provider","ALPACA","symbol",symbol,"timeframe",timeframe,"candle",bar,"partial",true);}
        void connect(){
            if(stopped)return;publish("status",Map.of("status",status,"provider","ALPACA"));authenticated=false;
            http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(8)).buildAsync(URI.create("wss://stream.data.alpaca.markets/v2/iex"),this).exceptionally(error->{reconnect();return null;});
            if(heartbeat==null)heartbeat=scheduler.scheduleAtFixedRate(()->{if(lastEvent!=null&&Duration.between(lastEvent,Instant.now()).getSeconds()>30){status="DELAYED";publish("status",Map.of("status",status,"provider","ALPACA"));}publish("heartbeat",Map.of("at",Instant.now().toString(),"status",status));},10,10,TimeUnit.SECONDS);
        }
        public synchronized void onOpen(WebSocket ws){if(stopped){ws.abort();return;}socket=ws;ws.sendText(JSON.writeValueAsString(Map.of("action","auth","key",client.keyId(),"secret",client.secretKey())),true);if(watchdog!=null)watchdog.cancel(false);watchdog=scheduler.schedule(()->{synchronized(this){if(!stopped&&!authenticated&&socket==ws){ws.abort();reconnect();}}},10,TimeUnit.SECONDS);ws.request(1);}
        public CompletionStage<?> onText(WebSocket ws,CharSequence data,boolean last){
            synchronized(this){if(stopped||ws!=socket)return null;if(text.length()+data.length()>65536){text.setLength(0);ws.abort();reconnect();return null;}text.append(data);
                if(last){String raw=text.toString();text.setLength(0);try{
                    var root=JSON.readTree(raw);if(root!=null&&root.isArray()&&root.size()<=1000)for(var event:root){
                        if("success".equals(event.path("T").asString())&&"authenticated".equals(event.path("msg").asString())&&!authenticated){authenticated=true;reconnectDelayMillis=1000;if(watchdog!=null)watchdog.cancel(false);ws.sendText(JSON.writeValueAsString(Map.of("action","subscribe","trades",List.of(symbol))),true);}
                        if("error".equals(event.path("T").asString()))throw new AlpacaDataFailure("ALPACA_STREAM_AUTH_FAILED",503);
                    }
                    for(var trade:AlpacaRealtimeMessage.trades(raw,symbol,Instant.now()))if(trade.id()>lastTrade){bar=MarketStreamService.aggregate(bar,trade.time(),trade.price(),trade.size(),seconds);lastTrade=trade.id();lastEvent=trade.time();reconnectDelayMillis=1000;status="LIVE";publish("candle",snapshot());cache();}
                }catch(RuntimeException invalid){ws.abort();reconnect();}}
            }ws.request(1);return null;
        }
        public void onError(WebSocket ws,Throwable error){if(ws==socket)reconnect();}
        public CompletionStage<?> onClose(WebSocket ws,int code,String reason){if(ws==socket&&!stopped)reconnect();return null;}
        synchronized void reconnect(){if(stopped)return;status="RECONNECTING";publish("status",Map.of("status",status,"provider","ALPACA"));if(watchdog!=null)watchdog.cancel(false);if(socket!=null)socket.abort();socket=null;if(retry==null||retry.isDone()){long delay=reconnectDelayMillis;reconnectDelayMillis=Math.min(reconnectDelayMillis*2,30000);retry=scheduler.schedule(()->{if(!stopped)connect();},delay,TimeUnit.MILLISECONDS);}}
        void cache(){long now=System.nanoTime();if(bar!=null&&now-lastCacheWrite>TimeUnit.SECONDS.toNanos(1)){lastCacheWrite=now;cache.store(MarketCache.key("bar","ALPACA",key),JSON.writeValueAsString(snapshot()),Duration.ofMinutes(5));}}
        void publish(String event,Object value){for(var emitter:clients)send(emitter,event,value);}
        void send(SseEmitter emitter,String event,Object value){try{emitter.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){clients.remove(emitter);}}
        synchronized void stop(){if(!clients.isEmpty()||stopped)return;stopped=true;if(socket!=null)socket.abort();if(heartbeat!=null)heartbeat.cancel(false);if(retry!=null)retry.cancel(false);if(watchdog!=null)watchdog.cancel(false);hubs.remove(key,this);}
    }
    @PreDestroy void close(){for(var hub:hubs.values()){hub.clients.clear();hub.stop();}scheduler.shutdownNow();}
}
