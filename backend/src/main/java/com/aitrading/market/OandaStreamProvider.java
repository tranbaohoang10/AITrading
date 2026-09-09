package com.aitrading.market;

import java.io.*;
import java.math.BigDecimal;
import java.net.http.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.json.JsonMapper;

@Service
public class OandaStreamProvider implements MarketStreamProvider {
    private static final JsonMapper JSON=JsonMapper.builder().build();private final OandaMarketDataClient client;private final MarketCache cache;private final ConcurrentHashMap<String,Hub> hubs=new ConcurrentHashMap<>();private final ScheduledExecutorService scheduler=Executors.newSingleThreadScheduledExecutor(Thread.ofPlatform().daemon().factory());
    public OandaStreamProvider(OandaMarketDataClient client,MarketCache cache){this.client=client;this.cache=cache;}public String providerId(){return "OANDA";}public boolean configured(){return client.configured();}
    public SseEmitter subscribe(String symbol,String timeframe){if(symbol==null||!symbol.matches("[A-Z0-9_]{3,31}"))throw new IllegalArgumentException("Invalid OANDA stream symbol");int seconds=MarketDataProvider.seconds(timeframe);client.pricing(symbol);String key=symbol+"|"+timeframe;
        synchronized(hubs){if(!hubs.containsKey(key)&&hubs.size()>=16)throw new OandaDataFailure("OANDA_STREAM_CAPACITY",503);var hub=hubs.computeIfAbsent(key,k->new Hub(k,symbol,timeframe,seconds));if(hub.clients.size()>=128)throw new OandaDataFailure("OANDA_STREAM_CAPACITY",503);var emitter=new SseEmitter(30*60_000L);hub.clients.add(emitter);Runnable remove=()->{hub.clients.remove(emitter);if(hub.clients.isEmpty())hub.stop();};emitter.onCompletion(remove);emitter.onTimeout(remove);emitter.onError(error->remove.run());hub.send(emitter,"status",Map.of("status",hub.status,"provider","OANDA"));var snapshot=hub.snapshot();if(snapshot!=null)hub.send(emitter,"snapshot",snapshot);if(!hub.started){hub.started=true;hub.connect();}return emitter;}}
    final class Hub{final String key,symbol,timeframe;final int seconds;final CopyOnWriteArrayList<SseEmitter> clients=new CopyOnWriteArrayList<>();volatile String status="CONNECTING";volatile boolean started,stopped;volatile MarketDataProvider.Candle bar;volatile Instant lastEvent;volatile Thread worker;long lastCacheWrite;ScheduledFuture<?> heartbeat;
        Hub(String key,String symbol,String timeframe,int seconds){this.key=key;this.symbol=symbol;this.timeframe=timeframe;this.seconds=seconds;}
        synchronized Map<String,Object> snapshot(){return bar==null?null:Map.of("provider","OANDA","symbol",symbol,"timeframe",timeframe,"candle",bar,"partial",true);}
        void connect(){if(stopped)return;worker=Thread.ofVirtual().name("oanda-stream-"+symbol).start(()->{long delay=1000;while(!stopped){try{status=lastEvent==null?"CONNECTING":"RECONNECTING";publish("status",Map.of("status",status,"provider","OANDA"));var response=client.http().send(client.streamRequest(symbol),HttpResponse.BodyHandlers.ofInputStream());if(response.statusCode()==401||response.statusCode()==403)throw new OandaDataFailure("OANDA_AUTH_FAILED",503);if(response.statusCode()==429)throw new OandaDataFailure("OANDA_RATE_LIMIT",429);if(response.statusCode()!=200)throw new OandaDataFailure("OANDA_STREAM_UNAVAILABLE",502);try(var reader=new BufferedReader(new InputStreamReader(response.body()))){String line;while(!stopped&&(line=reader.readLine())!=null){if(line.length()>65536)throw new OandaDataFailure("OANDA_INVALID_STREAM_EVENT",502);var event=OandaPricingMessage.parse(line,symbol,Instant.now());if(event.isPresent()){var price=event.get();synchronized(this){bar=MarketStreamService.aggregate(bar,price.time(),price.midpoint(),BigDecimal.ZERO,seconds);lastEvent=price.time();status="LIVE";publish("candle",snapshot());cache();}delay=1000;}}}}catch(InterruptedException interrupted){Thread.currentThread().interrupt();return;}catch(Exception failure){if(stopped)return;status="RECONNECTING";publish("status",Map.of("status",status,"provider","OANDA"));try{Thread.sleep(delay);}catch(InterruptedException interrupted){Thread.currentThread().interrupt();return;}delay=Math.min(delay*2,30000);}}});if(heartbeat==null)heartbeat=scheduler.scheduleAtFixedRate(()->{if(lastEvent!=null&&Duration.between(lastEvent,Instant.now()).getSeconds()>30){status="DELAYED";publish("status",Map.of("status",status,"provider","OANDA"));}publish("heartbeat",Map.of("at",Instant.now().toString(),"status",status));},10,10,TimeUnit.SECONDS);}
        void cache(){long now=System.nanoTime();if(bar!=null&&now-lastCacheWrite>TimeUnit.SECONDS.toNanos(1)){lastCacheWrite=now;cache.store(MarketCache.key("bar","OANDA",key),JSON.writeValueAsString(snapshot()),Duration.ofMinutes(5));}}
        void send(SseEmitter emitter,String event,Object value){try{emitter.send(SseEmitter.event().name(event).data(value));}catch(Exception disconnected){clients.remove(emitter);}}void publish(String event,Object value){for(var emitter:clients)send(emitter,event,value);if(clients.isEmpty())stop();}
        synchronized void stop(){if(stopped)return;stopped=true;if(worker!=null)worker.interrupt();if(heartbeat!=null)heartbeat.cancel(false);hubs.remove(key,this);}
    }
    @PreDestroy void close(){for(var hub:hubs.values()){hub.clients.clear();hub.stop();}scheduler.shutdownNow();}
}
