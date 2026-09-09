package com.aitrading.market;

import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.json.JsonMapper;

@Service
public class CtraderStreamProvider implements MarketStreamProvider {
    private static final JsonMapper JSON=JsonMapper.builder().build();private final CtraderMarketDataClient client;private final MarketCache cache;private final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();private final ScheduledExecutorService scheduler=Executors.newSingleThreadScheduledExecutor(Thread.ofPlatform().daemon().factory());
    public CtraderStreamProvider(CtraderMarketDataClient client,MarketCache cache){this.client=client;this.cache=cache;}public String providerId(){return "CTRADER";}public boolean configured(){return client.configured();}
    public SseEmitter subscribe(String symbol,String timeframe){long id=parse(symbol);int seconds=MarketDataProvider.seconds(timeframe);if(client.catalog().stream().noneMatch(item->item.id()==id))throw new IllegalArgumentException("Unsupported cTrader instrument");String key=symbol+"|"+timeframe;
        synchronized(hubs){if(!hubs.containsKey(key)&&hubs.size()>=16)throw new CtraderDataFailure("CTRADER_STREAM_CAPACITY",503);var hub=hubs.computeIfAbsent(key,k->new Hub(k,symbol,id,timeframe,seconds));if(hub.clients.size()>=128)throw new CtraderDataFailure("CTRADER_STREAM_CAPACITY",503);var emitter=new SseEmitter(30*60_000L);hub.clients.add(emitter);Runnable remove=()->{hub.clients.remove(emitter);if(hub.clients.isEmpty())hub.stop();};emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(error->remove.run());hub.send(emitter,"status",Map.of("status",hub.status,"provider","CTRADER"));var snapshot=hub.snapshot();if(snapshot!=null)hub.send(emitter,"snapshot",snapshot);if(!hub.started){hub.started=true;hub.connect();}return emitter;}}
    final class Hub{final String key,symbol,timeframe;final long id;final int seconds;final CopyOnWriteArrayList<SseEmitter> clients=new CopyOnWriteArrayList<>();volatile String status="CONNECTING";volatile boolean started,stopped;volatile MarketDataProvider.Candle bar;volatile Instant lastEvent;volatile Thread worker;volatile CtraderMarketDataClient.Session session;long lastCacheWrite;ScheduledFuture<?> heartbeat;
        Hub(String key,String symbol,long id,String timeframe,int seconds){this.key=key;this.symbol=symbol;this.id=id;this.timeframe=timeframe;this.seconds=seconds;}
        synchronized Map<String,Object> snapshot(){return bar==null?null:Map.of("provider","CTRADER","symbol",symbol,"timeframe",timeframe,"candle",bar,"partial",true);}
        void connect(){if(stopped)return;worker=Thread.ofVirtual().name("ctrader-stream-"+symbol).start(()->{long delay=1000;while(!stopped){try{status=lastEvent==null?"CONNECTING":"RECONNECTING";publish("status",Map.of("status",status,"provider","CTRADER"));session=client.openStream(id);while(!stopped){var message=session.read();if(message.type()==CtraderProtoCodec.HEARTBEAT){session.send(CtraderProtoCodec.heartbeat());continue;}if(message.type()==CtraderProtoCodec.ERROR_RES)throw new CtraderDataFailure(CtraderProtoCodec.error(message.payload()),502);if(message.type()!=CtraderProtoCodec.SPOT_EVENT)continue;var spot=CtraderProtoCodec.spot(message.payload(),id,Instant.now());if(spot.isPresent()){var price=spot.get();synchronized(this){bar=MarketStreamService.aggregate(bar,price.time(),price.price(),BigDecimal.ZERO,seconds);lastEvent=price.time();status="LIVE";publish("candle",snapshot());cache();}delay=1000;}}}catch(Exception failure){closeSession();if(stopped)return;status="RECONNECTING";publish("status",Map.of("status",status,"provider","CTRADER"));try{Thread.sleep(delay);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();return;}delay=Math.min(delay*2,30000);}}});if(heartbeat==null)heartbeat=scheduler.scheduleAtFixedRate(()->{if(lastEvent!=null&&Duration.between(lastEvent,Instant.now()).getSeconds()>30){status="DELAYED";publish("status",Map.of("status",status,"provider","CTRADER"));}publish("heartbeat",Map.of("at",Instant.now().toString(),"status",status));},10,10,TimeUnit.SECONDS);}
        void cache(){long now=System.nanoTime();if(bar!=null&&now-lastCacheWrite>TimeUnit.SECONDS.toNanos(1)){lastCacheWrite=now;cache.store(MarketCache.key("bar","CTRADER",key),JSON.writeValueAsString(snapshot()),Duration.ofMinutes(5));}}
        void send(SseEmitter emitter,String event,Object value){try{emitter.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){clients.remove(emitter);}}void publish(String event,Object value){for(var emitter:clients)send(emitter,event,value);if(clients.isEmpty())stop();}void closeSession(){var current=session;session=null;if(current!=null)current.close();}
        synchronized void stop(){if(stopped)return;stopped=true;closeSession();if(worker!=null)worker.interrupt();if(heartbeat!=null)heartbeat.cancel(false);hubs.remove(key,this);}
    }
    private static long parse(String symbol){try{long value=Long.parseLong(symbol);if(value<=0)throw new IllegalArgumentException();return value;}catch(RuntimeException invalid){throw new IllegalArgumentException("Invalid cTrader stream symbol");}}
    @PreDestroy void close(){for(var hub:hubs.values()){hub.clients.clear();hub.stop();}scheduler.shutdownNow();}
}
