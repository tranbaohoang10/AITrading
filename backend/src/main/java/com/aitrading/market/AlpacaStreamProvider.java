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
public class AlpacaStreamProvider implements MarketStreamProvider,WebSocket.Listener {
    private static final JsonMapper JSON=JsonMapper.builder().build();
    private final AlpacaMarketDataClient client;
    private final MarketCache cache;
    private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ScheduledExecutorService scheduler=Executors.newScheduledThreadPool(2,Thread.ofPlatform().daemon().factory());
    final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();
    final StringBuilder text=new StringBuilder();
    volatile WebSocket socket;
    volatile String status="CONNECTING";
    volatile boolean started,stopped,authenticated;
    long reconnectDelayMillis=1000;
    ScheduledFuture<?> heartbeat,retry,watchdog;

    public AlpacaStreamProvider(AlpacaMarketDataClient client,MarketCache cache){this.client=client;this.cache=cache;}
    public String providerId(){return "ALPACA";}
    public boolean configured(){return client.configured();}

    public synchronized SseEmitter subscribe(String symbol,String timeframe){
        if(symbol==null||!symbol.matches("[A-Z][A-Z0-9.]{0,9}"))throw new IllegalArgumentException("Invalid Alpaca stream symbol");
        int step=MarketDataProvider.seconds(timeframe);String key=symbol+"|"+timeframe;
        if(!hubs.containsKey(key)&&hubs.size()>=16)throw new AlpacaDataFailure("ALPACA_STREAM_CAPACITY",503);
        boolean symbolActive=activeSymbols().contains(symbol);
        Hub hub=hubs.computeIfAbsent(key,k->new Hub(k,symbol,timeframe,step));
        if(hub.clients.size()>=128)throw new AlpacaDataFailure("ALPACA_STREAM_CAPACITY",503);
        if(authenticated&&"CONNECTING".equals(hub.status))hub.status=symbolActive?"SUBSCRIBED":"AUTHENTICATED";
        SseEmitter emitter=new SseEmitter(30*60_000L);hub.clients.add(emitter);
        Runnable remove=()->hub.remove(emitter);emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(error->remove.run());
        hub.send(emitter,"status",Map.of("status",hub.status,"provider","ALPACA"));
        var snapshot=hub.snapshot();if(snapshot!=null)hub.send(emitter,"snapshot",snapshot);
        if(!started)connect();else if(authenticated&&!symbolActive)subscribeSymbols(Set.of(symbol));
        return emitter;
    }

    synchronized void connect(){
        if(stopped||hubs.isEmpty())return;
        started=true;authenticated=false;status=socket==null&&reconnectDelayMillis==1000?"CONNECTING":"RECONNECTING";publishStatus(status);
        http.newWebSocketBuilder().connectTimeout(Duration.ofSeconds(8)).buildAsync(URI.create("wss://stream.data.alpaca.markets/v2/iex"),this).exceptionally(error->{reconnect();return null;});
        if(heartbeat==null)heartbeat=scheduler.scheduleAtFixedRate(this::heartbeat,10,10,TimeUnit.SECONDS);
    }

    public synchronized void onOpen(WebSocket ws){
        if(stopped||hubs.isEmpty()){ws.abort();return;}
        socket=ws;ws.sendText(JSON.writeValueAsString(Map.of("action","auth","key",client.keyId(),"secret",client.secretKey())),true);
        if(watchdog!=null)watchdog.cancel(false);
        watchdog=scheduler.schedule(()->{synchronized(this){if(!stopped&&!authenticated&&socket==ws){ws.abort();reconnect();}}},10,TimeUnit.SECONDS);
        ws.request(1);
    }

    public CompletionStage<?> onText(WebSocket ws,CharSequence data,boolean last){
        synchronized(this){
            if(stopped||ws!=socket)return null;
            if(text.length()+data.length()>65536){text.setLength(0);ws.abort();reconnect();return null;}
            text.append(data);
            if(last){
                String raw=text.toString();text.setLength(0);
                try{
                    var root=JSON.readTree(raw);
                    if(root==null||!root.isArray()||root.size()>1000)throw new AlpacaDataFailure("ALPACA_INVALID_STREAM_EVENT",502);
                    for(var event:root){
                        String type=event.path("T").asString();
                        if("success".equals(type)&&"authenticated".equals(event.path("msg").asString())&&!authenticated){
                            authenticated=true;status="AUTHENTICATED";reconnectDelayMillis=1000;if(watchdog!=null)watchdog.cancel(false);publishStatus(status);subscribeSymbols(activeSymbols());
                        } else if("subscription".equals(type)){
                            var trades=event.path("trades");if(!trades.isArray()||trades.size()>64)throw new AlpacaDataFailure("ALPACA_INVALID_STREAM_EVENT",502);
                            var subscribed=new HashSet<String>();for(var symbol:trades)if(symbol.isString())subscribed.add(symbol.asString());
                            for(var hub:hubs.values())if(subscribed.contains(hub.symbol))hub.publishStatus("SUBSCRIBED");
                        } else if("error".equals(type)){
                            status=authenticated?"RECONNECTING":"AUTH_FAILED";publishStatus(status);throw new AlpacaDataFailure("ALPACA_STREAM_AUTH_FAILED",503);
                        }
                    }
                    for(var trade:AlpacaRealtimeMessage.trades(raw,Instant.now()))for(var hub:hubs.values())if(hub.symbol.equals(trade.symbol()))hub.accept(trade);
                }catch(RuntimeException invalid){ws.abort();reconnect();}
            }
        }
        ws.request(1);return null;
    }

    public void onError(WebSocket ws,Throwable error){synchronized(this){if(ws==socket)reconnect();}}
    public CompletionStage<?> onClose(WebSocket ws,int code,String reason){synchronized(this){if(ws==socket&&!stopped)reconnect();}return null;}

    synchronized void subscribeSymbols(Set<String> symbols){if(authenticated&&socket!=null&&!symbols.isEmpty())socket.sendText(JSON.writeValueAsString(Map.of("action","subscribe","trades",symbols.stream().sorted().toList())),true);}
    synchronized void unsubscribeSymbol(String symbol){if(authenticated&&socket!=null&&!activeSymbols().contains(symbol))socket.sendText(JSON.writeValueAsString(Map.of("action","unsubscribe","trades",List.of(symbol))),true);}
    Set<String> activeSymbols(){var symbols=new HashSet<String>();for(var hub:hubs.values())if(!hub.clients.isEmpty())symbols.add(hub.symbol);return symbols;}
    void publishStatus(String next){for(var hub:hubs.values())hub.publishStatus(next);}
    void heartbeat(){
        Instant now=Instant.now();
        for(var hub:hubs.values()){
            if(hub.lastEvent!=null&&Duration.between(hub.lastEvent,now).getSeconds()>30)hub.publishStatus("DELAYED");
            hub.publish("heartbeat",Map.of("at",now.toString(),"status",hub.status));
        }
    }
    synchronized void reconnect(){
        if(stopped||hubs.isEmpty()){stopConnection();return;}
        authenticated=false;status="RECONNECTING";publishStatus(status);if(watchdog!=null)watchdog.cancel(false);if(socket!=null)socket.abort();socket=null;
        if(retry==null||retry.isDone()){long delay=reconnectDelayMillis;reconnectDelayMillis=Math.min(reconnectDelayMillis*2,30000);retry=scheduler.schedule(this::connect,delay,TimeUnit.MILLISECONDS);}
    }
    synchronized void stopConnection(){
        if(socket!=null)socket.abort();socket=null;authenticated=false;started=false;status="CONNECTING";reconnectDelayMillis=1000;text.setLength(0);
        if(heartbeat!=null){heartbeat.cancel(false);heartbeat=null;}if(retry!=null){retry.cancel(false);retry=null;}if(watchdog!=null){watchdog.cancel(false);watchdog=null;}
    }

    final class Hub {
        final String key,symbol,timeframe;final int seconds;final CopyOnWriteArrayList<SseEmitter> clients=new CopyOnWriteArrayList<>();
        volatile String status="CONNECTING";volatile MarketDataProvider.Candle bar;volatile Instant lastEvent;long lastTrade=-1,lastCacheWrite;
        Hub(String key,String symbol,String timeframe,int seconds){this.key=key;this.symbol=symbol;this.timeframe=timeframe;this.seconds=seconds;}
        synchronized Map<String,Object> snapshot(){return bar==null?null:Map.of("provider","ALPACA","symbol",symbol,"timeframe",timeframe,"candle",bar,"partial",true);}
        synchronized void accept(AlpacaRealtimeMessage.Trade trade){if(trade.id()<=lastTrade)return;bar=MarketStreamService.aggregate(bar,trade.time(),trade.price(),trade.size(),seconds);lastTrade=trade.id();lastEvent=trade.time();publishStatus("LIVE");cache();}
        void publishStatus(String next){status=next;publish("status",Map.of("status",next,"provider","ALPACA"));}
        void cache(){long now=System.nanoTime();if(bar!=null&&now-lastCacheWrite>TimeUnit.SECONDS.toNanos(1)){lastCacheWrite=now;cache.store(MarketCache.key("bar","ALPACA",key),JSON.writeValueAsString(snapshot()),Duration.ofMinutes(5));}}
        void publish(String event,Object value){for(var emitter:clients)send(emitter,event,value);}
        void send(SseEmitter emitter,String event,Object value){try{emitter.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){remove(emitter);}}
        void remove(SseEmitter emitter){
            if(!clients.remove(emitter)||!clients.isEmpty())return;
            synchronized(AlpacaStreamProvider.this){
                hubs.remove(key,this);unsubscribeSymbol(symbol);if(hubs.isEmpty())stopConnection();
            }
        }
        void stop(){for(var emitter:clients)emitter.complete();clients.clear();hubs.remove(key,this);}
    }

    @PreDestroy synchronized void close(){stopped=true;for(var hub:List.copyOf(hubs.values()))hub.stop();stopConnection();scheduler.shutdownNow();}
}
