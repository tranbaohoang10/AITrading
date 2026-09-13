package com.aitrading.market;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import jakarta.annotation.PreDestroy;
import tools.jackson.databind.json.JsonMapper;

@Service
public class CtraderStreamProvider implements MarketStreamProvider {
    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final CtraderMarketDataClient client;
    private final MarketCache cache;
    private final MarketSymbolRegistry registry;
    private final MarketProviderCandleStore candles;
    private final MarketLiveStateStore live;
    private final ConcurrentHashMap<String, Hub> hubs = new ConcurrentHashMap<>();
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().factory());

    public CtraderStreamProvider(CtraderMarketDataClient client, MarketCache cache, MarketSymbolRegistry registry,
            MarketProviderCandleStore candles, MarketLiveStateStore live) {
        this.client = client;
        this.cache = cache;
        this.registry = registry;
        this.candles = candles;
        this.live = live;
    }

    public String providerId() { return "CTRADER"; }
    public boolean configured() { return client.configured(); }

    public SseEmitter subscribe(String symbol, String timeframe) {
        var route = registry.resolveProviderSymbol("CTRADER", symbol);
        MarketDataProvider.seconds(timeframe);
        var key = route.providerSymbol();
        synchronized (hubs) {
            if (!hubs.containsKey(key) && hubs.size() >= 16)
                throw new CtraderDataFailure("CTRADER_STREAM_CAPACITY", 503);
            var hub = hubs.computeIfAbsent(key, unused -> new Hub(key, route));
            if (hub.subscriptions.size() >= 128) throw new CtraderDataFailure("CTRADER_STREAM_CAPACITY", 503);
            var emitter = new SseEmitter(30 * 60_000L);
            var subscription = new Subscription(timeframe, emitter);
            hub.subscriptions.add(subscription);
            Runnable remove = () -> {
                hub.subscriptions.remove(subscription);
                if (hub.subscriptions.isEmpty()) hub.stop();
            };
            emitter.onCompletion(remove);
            emitter.onTimeout(remove);
            emitter.onError(error -> remove.run());
            hub.send(subscription, "status", Map.of("status", hub.status, "provider", "CTRADER"));
            var snapshot = hub.snapshot(timeframe);
            if (snapshot != null) hub.send(subscription, "snapshot", snapshot);
            if (!hub.started) { hub.started = true; hub.connect(); }
            return emitter;
        }
    }

    final class Hub {
        final String key;
        final MarketSymbolRegistry.Route route;
        final CopyOnWriteArrayList<Subscription> subscriptions = new CopyOnWriteArrayList<>();
        final RealtimeTimeframeAggregator aggregator = new RealtimeTimeframeAggregator();
        volatile String status = "CONNECTING";
        volatile boolean started;
        volatile boolean stopped;
        volatile Thread worker;
        volatile CtraderMarketDataClient.Session session;
        volatile Instant lastEvent;
        volatile long eventCount;
        ScheduledFuture<?> heartbeat;
        long lastCacheWrite;

        Hub(String key, MarketSymbolRegistry.Route route) { this.key = key; this.route = route; }

        synchronized Map<String, Object> snapshot(String timeframe) {
            var candle = aggregator.snapshot().get(timeframe);
            return candle == null ? null : state(timeframe, candle);
        }

        void connect() {
            if (stopped) return;
            worker = Thread.ofVirtual().name("ctrader-stream-" + key).start(() -> {
                long delay = 1_000;
                while (!stopped) {
                    try {
                        status = lastEvent == null ? "CONNECTING" : "RECONNECTING";
                        publish("status", Map.of("status", status, "provider", "CTRADER"));
                        session = client.openStream(Long.parseLong(route.providerSymbol()));
                        while (!stopped) {
                            var message = session.read();
                            if (message.type() == CtraderProtoCodec.HEARTBEAT) {
                                session.send(CtraderProtoCodec.heartbeat());
                                continue;
                            }
                            if (message.type() != CtraderProtoCodec.SPOT_EVENT) continue;
                            var spot = CtraderProtoCodec.spot(message.payload(), Long.parseLong(route.providerSymbol()), Instant.now());
                            if (spot.isEmpty()) continue;
                            var value = spot.get();
                            var eventId = key + ":" + value.time().toEpochMilli() + ":" + value.price().toPlainString();
                            var update = aggregator.accept(new RealtimeTimeframeAggregator.Quote(eventId, value.time(), value.price(), value.price()));
                            if (!update.accepted()) continue;
                            eventCount++;
                            if (update.finalizedM1() != null) candles.upsert(route, List.of(update.finalizedM1()));
                            lastEvent = value.time();
                            status = "LIVE";
                            live.writeFrames("CTRADER", key, update.price(), value.time(), update.current(), status, eventCount, "MID");
                            for (var subscription : subscriptions) {
                                var candle = update.current().get(subscription.timeframe());
                                if (candle != null) send(subscription, "candle", state(subscription.timeframe(), candle));
                            }
                            cache();
                            publish("status", Map.of("status", status, "provider", "CTRADER", "eventCount", eventCount,
                                    "redis", live.health()));
                            delay = 1_000;
                        }
                    } catch (Exception failure) {
                        closeSession();
                        if (stopped) return;
                        status = "RECONNECTING";
                        publish("status", Map.of("status", status, "provider", "CTRADER"));
                        try { Thread.sleep(delay); } catch (InterruptedException interrupted) {
                            Thread.currentThread().interrupt(); return;
                        }
                        delay = Math.min(delay * 2, 30_000);
                    }
                }
            });
            if (heartbeat == null) heartbeat = scheduler.scheduleAtFixedRate(() -> {
                if (lastEvent != null && Duration.between(lastEvent, Instant.now()).getSeconds() > 30) {
                    status = "DELAYED";
                    publish("status", Map.of("status", status, "provider", "CTRADER"));
                }
                publish("heartbeat", Map.of("at", Instant.now().toString(), "status", status, "provider", "CTRADER"));
            }, 10, 10, TimeUnit.SECONDS);
        }

        void cache() {
            long now = System.nanoTime();
            if (now - lastCacheWrite > TimeUnit.SECONDS.toNanos(1)) {
                lastCacheWrite = now;
                var current = aggregator.snapshot();
                if (!current.isEmpty()) cache.store(MarketCache.key("bar", "CTRADER", key),
                        JSON.writeValueAsString(Map.of("provider", "CTRADER", "symbol", key, "candles", current)),
                        Duration.ofMinutes(5));
            }
        }

        Map<String, Object> state(String timeframe, MarketDataProvider.Candle candle) {
            var value = new LinkedHashMap<String, Object>();
            value.put("provider", "CTRADER"); value.put("symbol", key); value.put("timeframe", timeframe);
            value.put("openTime", candle.time()); value.put("open", candle.open()); value.put("high", candle.high());
            value.put("low", candle.low()); value.put("close", candle.close()); value.put("volume", candle.volume());
            value.put("candle", candle); value.put("partial", true); value.put("final", false);
            value.put("priceBasis", "MID"); value.put("eventCount", eventCount);
            return Map.copyOf(value);
        }

        void send(Subscription subscription, String event, Object value) {
            try { subscription.emitter().send(SseEmitter.event().name(event).data(value)); }
            catch (Exception disconnected) { subscriptions.remove(subscription); }
        }
        void publish(String event, Object value) { for (var subscription : subscriptions) send(subscription, event, value); if (subscriptions.isEmpty()) stop(); }
        void closeSession() { var current = session; session = null; if (current != null) current.close(); }
        synchronized void stop() { if (stopped) return; stopped = true; closeSession(); if (worker != null) worker.interrupt(); if (heartbeat != null) heartbeat.cancel(false); hubs.remove(key, this); }
    }

    record Subscription(String timeframe, SseEmitter emitter) {}

    @PreDestroy void close() { for (var hub : hubs.values()) { hub.subscriptions.clear(); hub.stop(); } scheduler.shutdownNow(); }
}
